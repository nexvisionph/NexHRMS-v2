import { NextRequest, NextResponse } from "next/server";
import { createDecipheriv } from "crypto";
import { nanoid } from "nanoid";
import { createAdminSupabaseClient } from "@/services/supabase-server";
import { getT800AllowedDeviceIds, getT800RequestCode } from "@/lib/env";
import { validateKioskAuth } from "@/lib/kiosk-auth";

export const runtime = "nodejs";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const BLOCK_TTL_MS = 30 * 60 * 1000;

type BlockState = {
  lastBlockNo: number;
  updatedAt: number;
  chunks: Buffer[];
};

const pendingBlocks = new Map<string, BlockState>();

const AES_KEY = Buffer.from([
  1, 2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31, 32,
]);

type T800Payload = {
  request_code?: unknown;
  biometricId?: unknown;
  user_id?: unknown;
  userId?: unknown;
  enroll_id?: unknown;
  enrollId?: unknown;
  pin?: unknown;
  uid?: unknown;
  id?: unknown;
  card_no?: unknown;
  cardNo?: unknown;
  employeeId?: unknown;
  dev_id?: unknown;
  device_id?: unknown;
  deviceId?: unknown;
  dev?: unknown;
  io_mode?: unknown;
  io_time?: unknown;
  timestamp?: unknown;
  timestampUTC?: unknown;
  scanTime?: unknown;
  time?: unknown;
  block?: unknown;
};

function firstScalar(body: T800Payload, keys: Array<keyof T800Payload>): string {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return "";
}

function parseDeviceTimestamp(raw: string) {
  if (!raw) return null;

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      ) - MANILA_OFFSET_MS
    ).toISOString();
  }

  const normalized = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (normalized) {
    const [, year, month, day, hour, minute, second = "00"] = normalized;
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      ) - MANILA_OFFSET_MS
    ).toISOString();
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return null;
}

function getManilaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}:${byType.second}`,
  };
}

function calculateHours(checkIn: string, checkOut: string) {
  const [inH, inM, inS = 0] = checkIn.split(":").map(Number);
  const [outH, outM, outS = 0] = checkOut.split(":").map(Number);
  const inTotal = inH * 3600 + inM * 60 + inS;
  const outTotal = outH * 3600 + outM * 60 + outS;
  const diffSeconds = outTotal >= inTotal
    ? outTotal - inTotal
    : 24 * 3600 - inTotal + outTotal;
  if (diffSeconds > 0 && diffSeconds < 60) return 0.01;
  return Math.round((diffSeconds / 3600) * 100) / 100;
}

function buildResponse(responseCode: string, transId?: string | null, cmdCode?: string | null) {
  const headers: Record<string, string> = {
    response_code: responseCode,
    "Content-Type": "application/octet-stream",
    "Content-Length": "0",
  };

  if (transId) {
    headers.trans_id = transId;
  }
  if (cmdCode) {
    headers.cmd_code = cmdCode;
  }

  return new NextResponse(null, {
    status: 200,
    headers,
  });
}

function buildJson(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function decodeEncrypted(buffer: Buffer, encryptHeader: string | null) {
  if (!encryptHeader) return buffer;

  const enc = encryptHeader.toLowerCase();
  if (enc === "base64only") {
    const base64Text = buffer.toString("utf8").replace(/\0+$/g, "");
    return Buffer.from(base64Text, "base64");
  }

  if (enc === "yes") {
    const decipher = createDecipheriv("aes-256-ecb", AES_KEY, null);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([decipher.update(buffer), decipher.final()]);
    const base64Text = decrypted.toString("utf8").replace(/\0+$/g, "");
    return Buffer.from(base64Text, "base64");
  }

  return buffer;
}

function getJsonBlock(buffer: Buffer) {
  if (buffer.length < 4) return "";
  const len = buffer.readInt32LE(0);
  if (len <= 0 || len > buffer.length - 4) return "";
  let slice = buffer.slice(4, 4 + len);
  if (slice.length > 0 && slice[slice.length - 1] === 0) {
    slice = slice.slice(0, -1);
  }
  return slice.toString("utf8");
}

function isAllowedDevice(devId: string | null) {
  const allowedIds = getT800AllowedDeviceIds();
  if (allowedIds.length === 0) return true;
  if (!devId) return false;
  return allowedIds.includes(devId);
}

function getManilaDayUtcRange(scanDay: string) {
  const [year, month, day] = scanDay.split("-").map(Number);
  const startMs = Date.UTC(year, month - 1, day) - MANILA_OFFSET_MS;
  const endMs = startMs + 24 * 60 * 60 * 1000;

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

function inferEventType(
  existingLog: { check_in?: string | null; check_out?: string | null } | null,
  latestEvent: { event_type?: string | null; timestamp_utc?: string | null } | null
) {
  if (existingLog?.check_in && !existingLog?.check_out) return "OUT";
  if (latestEvent?.event_type === "IN") return "OUT";
  if (!existingLog?.check_in) return "IN";
  return null;
}

function pruneStaleBlocks(now = Date.now()) {
  for (const [devId, state] of pendingBlocks.entries()) {
    if (now - state.updatedAt > BLOCK_TTL_MS) {
      pendingBlocks.delete(devId);
    }
  }
}

function saveBlockChunk(devId: string, blockNo: number, chunk: Buffer) {
  pruneStaleBlocks();
  const current = pendingBlocks.get(devId);
  if (!current || blockNo === 1) {
    pendingBlocks.set(devId, {
      lastBlockNo: blockNo,
      updatedAt: Date.now(),
      chunks: [chunk],
    });
    return;
  }

  if (current.lastBlockNo !== blockNo - 1) {
    pendingBlocks.set(devId, {
      lastBlockNo: blockNo,
      updatedAt: Date.now(),
      chunks: [chunk],
    });
    return;
  }

  current.lastBlockNo = blockNo;
  current.updatedAt = Date.now();
  current.chunks.push(chunk);
}

function getCombinedBlocks(devId: string, tailChunk: Buffer) {
  pruneStaleBlocks();
  const current = pendingBlocks.get(devId);
  if (!current) {
    return tailChunk;
  }

  pendingBlocks.delete(devId);
  return Buffer.concat([...current.chunks, tailChunk]);
}

/**
 * GET /api/attendance/t800
 * Health check for the T800 attendance adapter.
 */
export async function GET() {
  try {
    const supabase = await createAdminSupabaseClient();
    const [{ count: mappedEmployeeCount }, { data: latestEvent }] = await Promise.all([
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .not("biometric_id", "is", null),
      supabase
        .from("attendance_events")
        .select("id, employee_id, event_type, timestamp_utc, device_id, created_at")
        .not("device_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return buildJson({
      ok: true,
      endpoint: "/api/attendance/t800",
      requestCode: getT800RequestCode(),
      allowedDeviceIds: getT800AllowedDeviceIds().length ? getT800AllowedDeviceIds() : "any",
      mappedEmployeeCount: mappedEmployeeCount ?? 0,
      latestDeviceEvent: latestEvent ?? null,
      testPayload: {
        request_code: getT800RequestCode(),
        user_id: "T800_USER_ID_HERE",
        io_mode: "1",
        io_time: "20260430143000",
      },
    });
  } catch (error) {
    console.error("[t800] Health check error:", error);
    return buildJson({ ok: false, error: "T800 endpoint health check failed" }, 500);
  }
}

/**
 * POST /api/attendance/t800
 * Accepts realtime_glog events from a T800 device.
 */
export async function POST(request: NextRequest) {
  const auth = validateKioskAuth(request.headers);
  if (!auth.ok) {
    return buildResponse("ERROR_UNAUTHORIZED");
  }

  const contentType = request.headers.get("content-type") || "";
  const encryptHeader = request.headers.get("encrypt");
  const headerDevId = request.headers.get("dev_id");
  const headerRequestCode = request.headers.get("request_code");
  const transId = request.headers.get("trans_id");
  const blkNo = Number(request.headers.get("blk_no") || "0");

  try {
    let buffer: Buffer = Buffer.alloc(0);
    let jsonBody: Record<string, unknown> | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);
      if (body && typeof body === "object") {
        jsonBody = body as Record<string, unknown>;
      }
      if (jsonBody?.block && typeof jsonBody.block === "string") {
        buffer = Buffer.from(jsonBody.block, "base64");
      }
    } else {
      buffer = Buffer.from(await request.arrayBuffer());
    }

    if (buffer.length > 0) {
      buffer = decodeEncrypted(buffer, encryptHeader);
    }

    if (blkNo > 0) {
      if (headerDevId) {
        saveBlockChunk(headerDevId, blkNo, buffer);
      }
      return buildResponse("OK", transId);
    }

    if (headerDevId) {
      buffer = getCombinedBlocks(headerDevId, buffer);
    }

    let payload: Record<string, unknown> | null = null;
    if (buffer.length > 0) {
      const jsonText = getJsonBlock(buffer);
      if (jsonText) {
        payload = JSON.parse(jsonText) as Record<string, unknown>;
      }
    }

    if (!payload && jsonBody) {
      payload = jsonBody;
    }

    if (!payload) {
      return buildResponse("ERROR_NO_PAYLOAD");
    }

    const payloadDevId = firstScalar(payload, ["dev_id", "device_id", "deviceId", "dev"]);
    const devId = headerDevId || payloadDevId;
    if (!isAllowedDevice(devId)) {
      return buildResponse("ERROR_DEVICE_NOT_ALLOWED");
    }

    const requestCode = String(headerRequestCode || payload.request_code || "").trim().toLowerCase();
    if (requestCode !== getT800RequestCode()) {
      return buildResponse("OK");
    }

    const biometricId = firstScalar(payload, [
      "biometricId",
      "user_id",
      "userId",
      "enroll_id",
      "enrollId",
      "pin",
      "uid",
      "id",
      "card_no",
      "cardNo",
      "employeeId",
    ]);
    const ioTime = firstScalar(payload, ["io_time", "timestampUTC", "timestamp", "scanTime", "time"]);

    if (!biometricId || !ioTime) {
      return buildResponse("ERROR_INVALID_LOG");
    }

    const timestampUTC = parseDeviceTimestamp(ioTime);
    if (!timestampUTC) {
      return buildResponse("ERROR_INVALID_TIME");
    }

    const scanDate = new Date(timestampUTC);
    const { date: scanDay, time: timeStr } = getManilaParts(scanDate);
    const dayRange = getManilaDayUtcRange(scanDay);
    const supabase = await createAdminSupabaseClient();

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, biometric_id, status, updated_at, created_at")
      .eq("biometric_id", biometricId)
      .eq("status", "active")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (employeeError) {
      console.error("[t800] Employee lookup error:", employeeError);
      return buildResponse("ERROR_EMPLOYEE_LOOKUP");
    }

    if (!employee?.id) {
      console.warn("[t800] Unmapped or inactive biometric ID:", biometricId, "dev_id:", devId);
      return buildResponse("OK");
    }

    const { data: existingLog } = await supabase
      .from("attendance_logs")
      .select("id, check_in, check_out, check_in_method")
      .eq("employee_id", employee.id)
      .eq("date", scanDay)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: existingEvent } = await supabase
      .from("attendance_events")
      .select("id, event_type")
      .eq("employee_id", employee.id)
      .eq("timestamp_utc", timestampUTC)
      .eq("device_id", devId || "T800")
      .maybeSingle();

    if (existingEvent) {
      return buildResponse("OK");
    }

    const { data: latestTodayEvent } = await supabase
      .from("attendance_events")
      .select("event_type, timestamp_utc")
      .eq("employee_id", employee.id)
      .gte("timestamp_utc", dayRange.start)
      .lt("timestamp_utc", dayRange.end)
      .order("timestamp_utc", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLog?.check_in && existingLog?.check_out) {
      return buildResponse("OK");
    }

    const eventType = inferEventType(existingLog, latestTodayEvent);
    if (!eventType) {
      return buildResponse("OK");
    }

    const eventId = `EVT-${nanoid(8)}`;
    const nowISO = new Date().toISOString();

    const { error: eventError } = await supabase.from("attendance_events").insert({
      id: eventId,
      employee_id: employee.id,
      event_type: eventType,
      timestamp_utc: timestampUTC,
      device_id: devId || "T800",
      created_at: nowISO,
    });

    if (eventError) {
      console.error("[t800] Event insert error:", eventError);
      return buildResponse("ERROR_EVENT_INSERT");
    }

    if (eventType === "IN") {
      const { error: logError } = await supabase.from("attendance_logs").upsert(
        {
          id: existingLog?.id || `ATT-${scanDay}-${employee.id}`,
          employee_id: employee.id,
          date: scanDay,
          check_in: timeStr,
          check_in_method: "biometric",
          status: "present",
          updated_at: nowISO,
        },
        { onConflict: "employee_id,date" }
      );

      if (logError) {
        console.error("[t800] Check-in log upsert error:", logError);
        return buildResponse("ERROR_LOG_UPSERT");
      }
    }

    if (eventType === "OUT") {
      const checkIn = existingLog?.check_in || (
        latestTodayEvent?.event_type === "IN" && latestTodayEvent.timestamp_utc
          ? getManilaParts(new Date(latestTodayEvent.timestamp_utc)).time
          : null
      );

      if (!checkIn) {
        return buildResponse("ERROR_MISSING_CHECK_IN");
      }

      // Enforce same-method rule: if checked in via non-biometric, block biometric check-out
      const existingMethod = (existingLog as Record<string, unknown>)?.check_in_method as string | undefined;
      if (existingMethod && existingMethod !== "biometric" && existingMethod !== "manual") {
        // Employee checked in via web/QR — can't check out via biometric
        return buildResponse("OK"); // Silently ignore (device can't show errors)
      }

      const logUpdate = {
        check_in: checkIn,
        check_out: timeStr,
        check_out_method: "biometric",
        hours: calculateHours(checkIn, timeStr),
        status: "present",
        updated_at: nowISO,
      };

      const logResult = existingLog?.id
        ? await supabase
          .from("attendance_logs")
          .update(logUpdate)
          .eq("id", existingLog.id)
        : await supabase
          .from("attendance_logs")
          .upsert({
            id: `ATT-${scanDay}-${employee.id}`,
            employee_id: employee.id,
            date: scanDay,
            ...logUpdate,
          }, { onConflict: "employee_id,date" });

      const logError = logResult.error;

      if (logError) {
        console.error("[t800] Check-out log update error:", logError);
        return buildResponse("ERROR_LOG_UPDATE");
      }
    }

    return buildResponse("OK");
  } catch (error) {
    console.error("[t800] Error:", error);
    return buildResponse("ERROR_INTERNAL");
  }
}
