import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/services/supabase-server";
import { nanoid } from "nanoid";
import { createDecipheriv } from "crypto";

export const runtime = "nodejs";

const REQ_CODE_REALTIME_GLOG = "realtime_glog";
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

const AES_KEY = Buffer.from([
  1, 2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31, 32,
]);

function parseIoTime(ioTime: string) {
  if (!ioTime) return null;
  const compact = ioTime.replace(/[^0-9]/g, "");
  if (compact.length === 14) {
    const year = Number(compact.slice(0, 4));
    const month = Number(compact.slice(4, 6));
    const day = Number(compact.slice(6, 8));
    const hour = Number(compact.slice(8, 10));
    const minute = Number(compact.slice(10, 12));
    const second = Number(compact.slice(12, 14));
    return { year, month, day, hour, minute, second };
  }
  return null;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeIoMode(rawMode: string) {
  const trimmed = rawMode.trim();
  const asNum = Number(trimmed);
  if (!Number.isNaN(asNum)) {
    switch (asNum) {
      case 1:
        return "IN";
      case 0:
      case 2:
        return "OUT";
      case 3:
        return "BRK_IN";
      case 4:
        return "BRK_OUT";
      case 5:
        return "OVT_IN";
      case 6:
        return "OVT_OUT";
      default:
        return "C_" + trimmed;
    }
  }
  const upper = trimmed.toUpperCase();
  if (["IN", "CHECK IN", "CHECK-IN", "CLOCK IN", "CLOCK-IN"].includes(upper)) return "IN";
  if (["OUT", "CHECK OUT", "CHECK-OUT", "CLOCK OUT", "CLOCK-OUT"].includes(upper)) return "OUT";
  if (["BREAK IN", "BREAK-IN", "BRK IN", "BRK_IN"].includes(upper)) return "BRK_IN";
  if (["BREAK OUT", "BREAK-OUT", "BRK OUT", "BRK_OUT"].includes(upper)) return "BRK_OUT";
  return upper;
}

function mapEventType(ioMode: string) {
  switch (ioMode) {
    case "IN":
      return "IN";
    case "OUT":
      return "OUT";
    case "BRK_IN":
      return "BREAK_START";
    case "BRK_OUT":
      return "BREAK_END";
    case "OVT_IN":
      return "IN";
    case "OVT_OUT":
      return "OUT";
    default:
      return null;
  }
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

function buildResponse(responseCode: string) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "response_code": responseCode,
      "Content-Type": "application/octet-stream",
      "Content-Length": "0",
    },
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

function isAllowedDevice(devId: string | null) {
  const allowed = process.env.BIOMETRIC_DEVICE_IDS;
  if (!allowed) return true;
  if (!devId) return false;
  const allowedIds = allowed.split(",").map((id) => id.trim()).filter(Boolean);
  if (allowedIds.length === 0) return true;
  return allowedIds.includes(devId);
}

export async function GET() {
  try {
    const supabase = await createAdminSupabaseClient();
    const allowedDeviceIds = (process.env.BIOMETRIC_DEVICE_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

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
      accepts: "T800 realtime_glog POSTs",
      allowedDeviceIds: allowedDeviceIds.length ? allowedDeviceIds : "any",
      mappedEmployeeCount: mappedEmployeeCount ?? 0,
      latestDeviceEvent: latestEvent ?? null,
      testPayload: {
        request_code: REQ_CODE_REALTIME_GLOG,
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

function inferEventType(
  eventType: ReturnType<typeof mapEventType>,
  existingLog: { check_in?: string | null; check_out?: string | null } | null
) {
  // T800 devices often send the same io_mode for every successful face scan.
  // For attendance, treat scans as a daily IN/OUT toggle.
  if (!existingLog?.check_in) return "IN";
  if (!existingLog.check_out) return "OUT";
  if (eventType && eventType !== "IN" && eventType !== "OUT") return eventType;
  return null;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const encryptHeader = request.headers.get("encrypt");
  const devId = request.headers.get("dev_id");
  const headerRequestCode = request.headers.get("request_code");
  const blkNo = Number(request.headers.get("blk_no") || "0");

  if (!isAllowedDevice(devId)) {
    return buildResponse("ERROR_DEVICE_NOT_ALLOWED");
  }

  try {
    let buffer: Buffer = Buffer.alloc(0);
    let jsonBody: Record<string, unknown> | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (body && typeof body === "object") {
        jsonBody = body as Record<string, unknown>;
      }
      if (jsonBody?.block && typeof jsonBody.block === "string") {
        buffer = Buffer.from(jsonBody.block, "base64");
      }
    } else {
      const arrayBuffer = await request.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    if (buffer.length > 0) {
      buffer = decodeEncrypted(buffer, encryptHeader);
    }

    if (blkNo > 0) {
      return buildResponse("OK");
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

    const requestCode = String(headerRequestCode || payload.request_code || "");
    if (requestCode !== REQ_CODE_REALTIME_GLOG) {
      return buildResponse("OK");
    }

    const userId = String(payload.user_id || "").trim();
    const ioModeRaw = String(payload.io_mode || "").trim();
    const ioTime = String(payload.io_time || "").trim();

    if (!userId || !ioModeRaw || !ioTime) {
      return buildResponse("ERROR_INVALID_LOG");
    }

    const ioMode = normalizeIoMode(ioModeRaw);
    const mappedEventType = mapEventType(ioMode);

    const timeParts = parseIoTime(ioTime);
    if (!timeParts) {
      return buildResponse("ERROR_INVALID_TIME");
    }

    const { year, month, day, hour, minute, second } = timeParts;
    const eventLocalDate = `${year}-${pad2(month)}-${pad2(day)}`;
    const eventLocalTime = `${pad2(hour)}:${pad2(minute)}`;
    const timestampUtc = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second) - MANILA_OFFSET_MS
    ).toISOString();

    const supabase = await createAdminSupabaseClient();

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("biometric_id", userId)
      .maybeSingle();

    if (employeeError) {
      console.error("[t800] Employee lookup error:", employeeError);
      return buildResponse("ERROR_EMPLOYEE_LOOKUP");
    }

    if (!employee?.id) {
      console.warn("[t800] Unmapped user_id:", userId, "dev_id:", devId);
      return buildResponse("OK");
    }

    const { data: existingLog } = await supabase
      .from("attendance_logs")
      .select("check_in, check_out")
      .eq("employee_id", employee.id)
      .eq("date", eventLocalDate)
      .maybeSingle();

    const eventType = inferEventType(mappedEventType, existingLog);
    if (!eventType) {
      console.warn("[t800] Unsupported or duplicate io_mode:", ioModeRaw, "user_id:", userId);
      return buildResponse("OK");
    }

    if (eventType === "IN" || eventType === "OUT") {
      if (eventType === "IN" && existingLog?.check_in) {
        return buildResponse("OK");
      }
      if (eventType === "OUT" && !existingLog?.check_in) {
        return buildResponse("OK");
      }
      if (eventType === "OUT" && existingLog?.check_out) {
        return buildResponse("OK");
      }
    }

    const eventId = `EVT-${nanoid(8)}`;
    const nowISO = new Date().toISOString();

    const { error: eventError } = await supabase.from("attendance_events").insert({
      id: eventId,
      employee_id: employee.id,
      event_type: eventType,
      timestamp_utc: timestampUtc,
      device_id: devId,
      created_at: nowISO,
    });

    if (eventError) {
      console.error("[t800] Event insert error:", eventError);
      return buildResponse("ERROR_EVENT_INSERT");
    }

    if (eventType === "IN") {
      const { error: logError } = await supabase.from("attendance_logs").upsert(
        {
          id: `ATT-${eventLocalDate}-${employee.id}`,
          employee_id: employee.id,
          date: eventLocalDate,
          check_in: eventLocalTime,
          status: "present",
          face_verified: true,
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
      const { data: existing } = await supabase
        .from("attendance_logs")
        .select("check_in")
        .eq("employee_id", employee.id)
        .eq("date", eventLocalDate)
        .maybeSingle();

      let hours: number | null = null;
      if (existing?.check_in) {
        const [inH, inM] = String(existing.check_in).split(":").map(Number);
        const diffMin = (hour * 60 + minute) - (inH * 60 + inM);
        hours = Math.round((Math.max(0, diffMin) / 60) * 10) / 10;
      }

      const { error: logError } = await supabase
        .from("attendance_logs")
        .update({ check_out: eventLocalTime, hours, updated_at: nowISO })
        .eq("employee_id", employee.id)
        .eq("date", eventLocalDate);

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
