// Biometric Integration Types

export type BiometricMethod = "fingerprint" | "face" | "palm" | "rfid" | "pin" | "manual";
export type BiometricLogType = "time_in" | "time_out";

export interface BiometricDevice {
  id: string;
  companyId: string;
  name: string;
  location?: string;
  deviceType?: string;
  supportedMethods: BiometricMethod[];
  isActive: boolean;
  lastSyncedAt?: string;
  apiKeyLast4?: string;
  createdBy?: string;
  createdAt: string;
}

export interface BiometricEnrollment {
  id: string;
  companyId: string;
  employeeId: string;
  method: Exclude<BiometricMethod, "manual">;
  externalId?: string;
  enrolledAt: string;
  enrolledBy: string;
  isActive: boolean;
}

export interface BiometricLog {
  id: string;
  companyId: string;
  employeeId: string;
  deviceId: string;
  recognitionMethod: BiometricMethod;
  logType: BiometricLogType;
  loggedAt: string;
  confidenceScore?: number;
  lowConfidence: boolean;
  rawPayload?: Record<string, unknown>;
  payloadHash?: string;
  deviceLogId?: string;
  syncedAt: string;
}
