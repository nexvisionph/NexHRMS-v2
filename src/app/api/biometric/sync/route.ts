import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/services/supabase-server";
import { createHash, randomBytes } from "crypto";

export const runtime = "nodejs";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const METHOD_SET = new Set(["fingerprint", "face", "palm", "rfid", "pin", "manual"]);

function toManilaParts(utcIso: string) {
  const ms = new Date(utcIso).getTime() + MANILA_OFFSET_MS;
  const manila = new Date(ms);
  return {
    date: manila.toISOString().slice(0, 10),
    time: manila.toISOString().slice(11, 16),
  };
}

function manilaDayRange(date: string) {
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(`${date}T23:59:59.999+08:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `"${k}":${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(payload: Record<string, unknown>) {
  const stable = stableStringify(payload);
  return createHash("sha256").update(stable).digest("hex");
}

function normalizeMethod(raw: unknown) {
  const method = String(raw || "").toLowerCase().trim();
  return METHOD_SET.has(method) ? method : null;
}

function computeLateMinutes(checkInTime: string, shiftStart: string, graceMinutes: number) {
  const [inH, inM] = checkInTime.split(":").map(Number);
  const [shH, shM] = shiftStart.split(":").map(Number);
  if ([inH, inM, shH, shM].some((n) => Number.isNaN(n))) return null;
  const checkInMinutes = inH * 60 + inM;
  const shiftMinutes = shH * 60 + shM + graceMinutes;
  if (checkInMinutes <= shiftMinutes) return 0;
  return checkInMinutes - shiftMinutes;
}

export async function POST(request: NextRequest) {
  const deviceKey = request.headers.get("x-device-key")?.trim();
  if (!deviceKey) {
    return NextResponse.json({ error: "Missing X-Device-Key" }, { status: 401 });
  }

  const supabase = await createAdminSupabaseClient();
  const deviceKeyHash = createHash("sha256").update(deviceKey).digest("hex");

  const { data: device } = await supabase
    .from("biometric_devices")
    .select("id, company_id, is_active, supported_methods")
    .eq("api_key_hash", deviceKeyHash)
    .maybeSingle();

  if (!device || !device.is_active) {
    return NextResponse.json({ error: "Invalid device key" }, { status: 401 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const method = normalizeMethod(
    payload.method ?? payload.recognition_method ?? payload.recognitionMethod
  );

  if (!method) {
    return NextResponse.json({ error: "Invalid recognition method" }, { status: 400 });
  }

  const supported = Array.isArray(device.supported_methods)
    ? device.supported_methods.map((m: string) => m.toLowerCase())
    : [];

  if (supported.length > 0 && !supported.includes(method)) {
    return NextResponse.json({ error: "Method not supported by device" }, { status: 400 });
  }

  const loggedAt = String(payload.logged_at ?? payload.loggedAt ?? payload.timestamp ?? new Date().toISOString());
  const { date: manilaDate, time: manilaTime } = toManilaParts(loggedAt);
  const payloadHash = hashPayload(payload);
  const deviceLogId = String(payload.device_log_id ?? payload.log_id ?? payload.id ?? "").trim() || null;

  const { data: existingByDeviceLog } = deviceLogId
    ? await supabase
        .from("biometric_logs")
        .select("id")
        .eq("device_id", device.id)
        .eq("device_log_id", deviceLogId)
        .maybeSingle()
    : { data: null };

  const { data: existingByHash } = await supabase
    .from("biometric_logs")
    .select("id")
    .eq("payload_hash", payloadHash)
    .maybeSingle();

  if (existingByDeviceLog || existingByHash) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const employeeIdFromPayload = String(payload.employee_id ?? payload.employeeId ?? "").trim() || null;
  const externalId = String(payload.external_id ?? payload.user_id ?? payload.employee_external_id ?? "").trim() || null;

  let employeeId: string | null = employeeIdFromPayload;
  let enrollmentCompanyId: string | null = null;

  if (!employeeId && externalId) {
    const { data: enrollment } = await supabase
      .from("biometric_enrollments")
      .select("employee_id, company_id")
      .eq("external_id", externalId)
      .eq("method", method)
      .eq("is_active", true)
      .maybeSingle();

    if (enrollment?.employee_id) {
      employeeId = enrollment.employee_id;
      enrollmentCompanyId = enrollment.company_id;
    }
  }

  if (!employeeId && payload.biometric_id) {
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("biometric_id", String(payload.biometric_id))
      .maybeSingle();
    employeeId = employee?.id ?? null;
  }

  if (!employeeId) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  if (method !== "manual") {
    const { data: checkEnrollment } = await supabase
      .from("biometric_enrollments")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("method", method)
      .eq("is_active", true)
      .maybeSingle();

    if (!checkEnrollment) {
      return NextResponse.json({ error: "Employee not enrolled for this method" }, { status: 400 });
    }
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, shift_id, company_id")
    .eq("id", employeeId)
    .single();

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const companyId = enrollmentCompanyId || employee.company_id || device.company_id;

  const { start, end } = manilaDayRange(manilaDate);
  const { data: lastLog } = await supabase
    .from("biometric_logs")
    .select("log_type")
    .eq("employee_id", employeeId)
    .gte("logged_at", start)
    .lte("logged_at", end)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: existingLog } = await supabase
    .from("attendance_logs")
    .select("check_in, check_out, late_minutes, needs_review")
    .eq("employee_id", employeeId)
    .eq("date", manilaDate)
    .maybeSingle();

  let logType: "time_in" | "time_out" = "time_in";
  if (!existingLog?.check_in) {
    logType = "time_in";
  } else if (!existingLog.check_out) {
    logType = "time_out";
  } else {
    logType = lastLog?.log_type === "time_in" ? "time_out" : "time_in";
  }

  const confidenceRaw = payload.confidence_score ?? payload.confidence;
  const confidenceScore = confidenceRaw === null || confidenceRaw === undefined ? null : Number(confidenceRaw);
  const lowConfidence = (method === "face" || method === "fingerprint") && confidenceScore !== null && confidenceScore < 60;

  const needsReview = method === "pin" || method === "manual";

  const { data: insertedLog, error: logError } = await supabase
    .from("biometric_logs")
    .insert({
      company_id: companyId,
      employee_id: employeeId,
      device_id: device.id,
      recognition_method: method,
      log_type: logType,
      logged_at: loggedAt,
      confidence_score: confidenceScore,
      low_confidence: lowConfidence,
      raw_payload: payload,
      payload_hash: payloadHash,
      device_log_id: deviceLogId,
      synced_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (logError) {
    return NextResponse.json({ error: "Failed to save biometric log" }, { status: 500 });
  }

  await supabase
    .from("biometric_devices")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", device.id);

  const shouldUpdateAttendance =
    (logType === "time_in" && !existingLog?.check_in) ||
    (logType === "time_out" && !existingLog?.check_out);

  if (shouldUpdateAttendance) {
    let shiftId = employee.shift_id as string | null;
    const { data: employeeShift } = await supabase
      .from("employee_shifts")
      .select("shift_id")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (employeeShift?.shift_id) {
      shiftId = employeeShift.shift_id;
    }

    let lateMinutes: number | null = null;
    if (logType === "time_in" && shiftId) {
      const { data: shift } = await supabase
        .from("shift_templates")
        .select("start_time, grace_period")
        .eq("id", shiftId)
        .maybeSingle();

      if (shift?.start_time) {
        lateMinutes = computeLateMinutes(manilaTime, shift.start_time, shift.grace_period ?? 0);
      }
    }

    if (logType === "time_in") {
      await supabase.from("attendance_logs").upsert(
        {
          id: `ATT-${manilaDate}-${employeeId}`,
          employee_id: employeeId,
          date: manilaDate,
          check_in: manilaTime,
          check_in_method: method,
          check_in_device_id: device.id,
          source: "biometric",
          needs_review: (existingLog?.needs_review ?? false) || needsReview,
          status: "present",
          late_minutes: lateMinutes ?? existingLog?.late_minutes ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "employee_id,date" }
      );
    }

    if (logType === "time_out") {
      let hours: number | null = null;
      if (existingLog?.check_in) {
        const [inH, inM] = String(existingLog.check_in).split(":").map(Number);
        const [outH, outM] = manilaTime.split(":").map(Number);
        if (!Number.isNaN(inH) && !Number.isNaN(inM) && !Number.isNaN(outH) && !Number.isNaN(outM)) {
          const diffMin = outH * 60 + outM - (inH * 60 + inM);
          hours = Math.round((Math.max(0, diffMin) / 60) * 10) / 10;
        }
      }

      await supabase
        .from("attendance_logs")
        .update({
          check_out: manilaTime,
          check_out_method: method,
          check_out_device_id: device.id,
          source: "biometric",
          needs_review: (existingLog?.needs_review ?? false) || needsReview,
          hours: hours ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("employee_id", employeeId)
        .eq("date", manilaDate);
    }

    const eventType = logType === "time_in" ? "IN" : "OUT";
    await supabase.from("attendance_events").insert({
      id: `EVT-${randomBytes(6).toString("hex")}`,
      employee_id: employeeId,
      event_type: eventType,
      timestamp_utc: loggedAt,
      device_id: device.id,
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, log: insertedLog });
}
