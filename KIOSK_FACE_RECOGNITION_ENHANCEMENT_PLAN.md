# Kiosk Face Recognition & QR Code Enhancement Plan

**Document Version:** 1.0  
**Date:** March 27, 2026  
**Author:** Lead Full-Stack Developer  
**Status:** Approved for Implementation  

---

## Executive Summary

This plan outlines the implementation of a **secure, flexible attendance verification system** with:

1. **Face Recognition Enrollment** - First-time face registration for employees assigned to face recognition projects
2. **Project-Level Verification Method Control** - Admins choose face recognition vs QR code per project
3. **Manual Check-in Fallback** - Traditional attendance logging when biometrics unavailable
4. **Enhanced QR Security** - Location-validated, kiosk-only QR scanning with anti-spoofing
5. **Dual Kiosk Pages** - Separate QR and Face Recognition kiosks with password protection
6. **Qwen AI Optimization** - Proper model selection and liveness detection

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Requirements Specification](#2-requirements-specification)
3. [Architecture Design](#3-architecture-design)
4. [Database Schema Changes](#4-database-schema-changes)
5. [Implementation Plan](#5-implementation-plan)
6. [Security Considerations](#6-security-considerations)
7. [Testing Strategy](#7-testing-strategy)
8. [Rollout Plan](#8-rollout-plan)

---

## 1. Current State Analysis

### 1.1 Existing Features

| Feature | Status | Location |
|---------|--------|----------|
| Face Recognition Simulator | ✅ Implemented | `src/components/attendance/face-recognition.tsx` |
| QR Code Generation | ✅ Implemented | `src/lib/qr-utils.ts` |
| Kiosk Page | ✅ Implemented | `src/app/kiosk/page.tsx` |
| Kiosk Settings | ✅ Implemented | `src/app/[role]/settings/kiosk/page.tsx` |
| Face Verification API | ✅ Implemented | `src/app/api/attendance/verify-face/route.ts` |
| Qwen AI Integration | ✅ Implemented | Uses `qwen-vl-plus` |

### 1.2 Current Limitations

| Issue | Severity | Impact |
|-------|----------|--------|
| No face enrollment workflow | HIGH | Employees can't register faces for first time |
| No project-level verification control | HIGH | Can't enforce face vs QR per project |
| QR codes work anywhere | CRITICAL | Security vulnerability - no location validation |
| Single kiosk page | MEDIUM | Confusing UX for different check-in methods |
| No kiosk entry password | MEDIUM | Anyone can access kiosk mode |
| Qwen model not optimized | MEDIUM | Using `qwen-vl-plus` instead of `qwen-vl-max` for better accuracy |
| No manual check-in fallback | HIGH | No backup when biometrics fail |

---

## 2. Requirements Specification

### 2.1 Functional Requirements

#### FR-1: Face Recognition Enrollment
- **FR-1.1:** Employees assigned to face recognition projects must enroll their face before first check-in
- **FR-1.2:** Face enrollment requires capturing 3 clear images from different angles
- **FR-1.3:** Admin/HR can view enrollment status per employee
- **FR-1.4:** Employees can re-enroll if face recognition fails repeatedly
- **FR-1.5:** Face data stored securely with encryption

#### FR-2: Project-Level Verification Control
- **FR-2.1:** Admin can select verification method per project:
  - Face Recognition Only
  - QR Code Only
  - Face Recognition OR QR Code (employee choice)
  - Manual Check-in Only
- **FR-2.2:** Verification method displayed on project card
- **FR-2.3:** Employees see required method when assigned to project

#### FR-3: Manual Check-in Fallback
- **FR-3.1:** Admin/HR can manually check in employees
- **FR-3.2:** Manual check-in requires reason selection
- **FR-3.3:** Manual check-ins logged with `performedBy` field
- **FR-3.4:** Manual check-ins flagged in reports

#### FR-4: Enhanced QR Security
- **FR-4.1:** QR codes only valid when scanned at kiosk location
- **FR-4.2:** QR codes expire after 30 seconds (dynamic tokens)
- **FR-4.3:** QR codes single-use only
- **FR-4.4:** Geofence validation required for QR scan
- **FR-4.5:** Device binding for kiosk scanners

#### FR-5: Dual Kiosk Pages
- **FR-5.1:** Separate kiosk pages:
  - `/kiosk/face` - Face recognition only
  - `/kiosk/qr` - QR code scanning only
- **FR-5.2:** Password protection for kiosk entry (6-digit PIN)
- **FR-5.3:** Kiosk pages show only enabled methods for employee's project
- **FR-5.4:** Admin can configure kiosk access in settings

#### FR-6: Qwen AI Optimization
- **FR-6.1:** Use `qwen-vl-max` for production (better accuracy)
- **FR-6.2:** Use `qwen-vl-plus` for demo/testing (faster, cheaper)
- **FR-6.3:** Implement retry logic with fallback
- **FR-6.4:** Cache face templates for faster verification

### 2.2 Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Face Recognition Accuracy | ≥95% true positive rate |
| Liveness Detection | ≥90% spoof detection rate |
| QR Scan Response Time | <2 seconds |
| Kiosk Load Time | <3 seconds |
| Data Encryption | AES-256 at rest, TLS 1.3 in transit |
| Availability | 99.9% uptime |

---

## 3. Architecture Design

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ /kiosk/face  │  │  /kiosk/qr   │  │ /attendance  │          │
│  │  Face Kiosk  │  │   QR Kiosk   │  │   Employee   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └─────────────────┴──────────────────┘                   │
│                           │                                      │
│                  ┌────────▼────────┐                             │
│                  │  Auth Guard     │                             │
│                  │  (Kiosk PIN)    │                             │
│                  └────────┬────────┘                             │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Routes (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ /api/attendance/ │  │ /api/attendance/ │                     │
│  │   verify-face    │  │   validate-qr    │                     │
│  └────────┬─────────┘  └────────┬─────────┘                     │
│           │                     │                                │
└───────────┼─────────────────────┼────────────────────────────────┘
            │                     │
            ▼                     ▼
┌───────────────────┐   ┌───────────────────┐
│   Qwen AI API     │   │   Supabase DB     │
│  (qwen-vl-max)    │   │  (PostgreSQL +    │
│                   │   │   RLS Policies)   │
└───────────────────┘   └───────────────────┘
```

### 3.2 Data Flow

#### Face Recognition Flow
```
Employee → Kiosk Face Tab → Camera Capture → /api/attendance/verify-face
    → Qwen AI (liveness + face match) → Attendance Event → Success/Failure
```

#### QR Code Flow
```
Employee → Kiosk QR Tab → Camera Scan → Validate Location → /api/attendance/validate-qr
    → Check Token Validity → Check Geofence → Attendance Event → Success/Failure
```

#### Manual Check-in Flow
```
Admin/HR → Attendance Page → Select Employee → Manual Check-in
    → Select Reason → Append Event → Audit Log → Success
```

---

## 4. Database Schema Changes

### 4.1 New Tables

```sql
-- Face enrollment tracking
CREATE TABLE face_enrollments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  face_template_hash TEXT NOT NULL,  -- Encrypted face template
  enrollment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified TIMESTAMPTZ,
  verification_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  enrolled_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project verification method configuration
CREATE TABLE project_verification_methods (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  verification_method TEXT NOT NULL CHECK (verification_method IN (
    'face_only', 
    'qr_only', 
    'face_or_qr', 
    'manual_only'
  )),
  require_geofence BOOLEAN DEFAULT true,
  geofence_radius_meters INTEGER DEFAULT 100,
  allow_manual_override BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Dynamic QR tokens (replaces static QR)
CREATE TABLE qr_tokens (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES kiosk_devices(id),
  employee_id TEXT REFERENCES employees(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  used_by_kiosk_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manual check-in reasons
CREATE TABLE manual_checkin_reasons (
  id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manual check-in log
CREATE TABLE manual_checkins (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('IN', 'OUT')),
  reason_id TEXT REFERENCES manual_checkin_reasons(id),
  custom_reason TEXT,
  performed_by TEXT NOT NULL REFERENCES employees(id),
  timestamp_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id TEXT REFERENCES projects(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kiosk access PINs
CREATE TABLE kiosk_pins (
  id TEXT PRIMARY KEY,
  kiosk_device_id TEXT REFERENCES kiosk_devices(id),
  pin_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Indexes for performance
CREATE INDEX idx_face_enrollments_employee ON face_enrollments(employee_id);
CREATE INDEX idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX idx_qr_tokens_expires ON qr_tokens(expires_at);
CREATE INDEX idx_manual_checkins_employee ON manual_checkins(employee_id);
CREATE INDEX idx_manual_checkins_timestamp ON manual_checkins(timestamp_utc);
```

### 4.2 Migration File

Create: `supabase/migrations/022_kiosk_face_recognition_enhancement.sql`

```sql
-- Migration 022: Kiosk Face Recognition Enhancement
-- Adds face enrollment, project verification methods, dynamic QR tokens

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- [Insert all CREATE TABLE statements from above]

-- Add RLS policies
ALTER TABLE face_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_verification_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_pins ENABLE ROW LEVEL SECURITY;

-- Face enrollments: employees can view own, admin/HR can view all
CREATE POLICY fe_select_own ON face_enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM employees e WHERE e.id = face_enrollments.employee_id AND e.profile_id = auth.uid())
    OR public.is_admin_or_hr()
  );

CREATE POLICY fe_insert ON face_enrollments
  FOR INSERT WITH CHECK (public.is_admin_or_hr());

-- Project verification methods: read for all, write for admin
CREATE POLICY pvm_select ON project_verification_methods
  FOR SELECT USING (true);

CREATE POLICY pvm_insert ON project_verification_methods
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY pvm_update ON project_verification_methods
  FOR UPDATE USING (public.is_admin());

-- QR tokens: service role only (generated by kiosk)
-- No RLS policies - accessed via service role only

-- Manual check-ins: employees view own, admin/HR view all
CREATE POLICY mci_select ON manual_checkins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM employees e WHERE e.id = manual_checkins.employee_id AND e.profile_id = auth.uid())
    OR public.is_admin_or_hr()
  );

CREATE POLICY mci_insert ON manual_checkins
  FOR INSERT WITH CHECK (public.is_admin_or_hr());

-- Kiosk PINs: admin only
CREATE POLICY kp_select ON kiosk_pins
  FOR SELECT USING (public.is_admin());

CREATE POLICY kp_insert ON kiosk_pins
  FOR INSERT WITH CHECK (public.is_admin());

-- Seed default manual check-in reasons
INSERT INTO manual_checkin_reasons (id, reason) VALUES
  ('MCR-001', 'Biometric system unavailable'),
  ('MCR-002', 'Employee forgot QR code'),
  ('MCR-003', 'Face recognition failed multiple attempts'),
  ('MCR-004', 'Visitor/Contractor check-in'),
  ('MCR-005', 'Emergency check-in'),
  ('MCR-006', 'System maintenance'),
  ('MCR-007', 'Other');
```

---

## 5. Implementation Plan

### 5.1 Phase 1: Database & Types (Day 1-2)

#### Task 1.1: Create Database Migration
- [ ] Create `022_kiosk_face_recognition_enhancement.sql`
- [ ] Test migration on local Supabase
- [ ] Run migration on production

#### Task 1.2: Update TypeScript Types
**File:** `src/types/index.ts`

```typescript
// Add new types
export type VerificationMethod = "face_only" | "qr_only" | "face_or_qr" | "manual_only";

export interface FaceEnrollment {
  id: string;
  employeeId: string;
  faceTemplateHash: string;
  enrollmentDate: string;
  lastVerified?: string;
  verificationCount: number;
  isActive: boolean;
  enrolledBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVerificationMethod {
  id: string;
  projectId: string;
  verificationMethod: VerificationMethod;
  requireGeofence: boolean;
  geofenceRadiusMeters: number;
  allowManualOverride: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QRToken {
  id: string;
  deviceId: string;
  employeeId?: string;
  token: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  usedByKioskId?: string;
  createdAt: string;
}

export interface ManualCheckinReason {
  id: string;
  reason: string;
  isActive: boolean;
  createdAt: string;
}

export interface ManualCheckin {
  id: string;
  employeeId: string;
  eventType: "IN" | "OUT";
  reasonId?: string;
  customReason?: string;
  performedBy: string;
  timestampUtc: string;
  projectId?: string;
  notes?: string;
  createdAt: string;
}

// Extend Project interface
export interface Project {
  // ... existing fields
  verificationMethod?: VerificationMethod;
}
```

### 5.2 Phase 2: Backend Services (Day 3-5)

#### Task 2.1: Create Face Recognition Service
**File:** `src/services/face-recognition.service.ts`

```typescript
"use server";

import { createServerSupabaseClient } from "./supabase-server";
import { createAdminSupabaseClient } from "./supabase-server";

export async function enrollFace(employeeId: string, faceImages: string[]) {
  // Validate images
  // Call Qwen AI to extract face template
  // Store encrypted template
}

export async function verifyFace(employeeId: string, faceImage: string) {
  // Fetch face template
  // Call Qwen AI for verification
  // Update verification count
}

export async function getFaceEnrollmentStatus(employeeId: string) {
  // Check if employee has active enrollment
}
```

#### Task 2.2: Create QR Token Service
**File:** `src/services/qr-token.service.ts`

```typescript
"use server";

export async function generateDynamicQRToken(employeeId: string, deviceId: string) {
  // Generate single-use token
  // Set 30-second expiry
  // Store in database
}

export async function validateQRToken(token: string, kioskId: string, location: {lat: number, lng: number}) {
  // Check token exists and not expired
  // Check token not used
  // Validate location matches kiosk
  // Mark as used
}
```

#### Task 2.3: Create Manual Check-in Service
**File:** `src/services/manual-checkin.service.ts`

```typescript
"use server";

export async function createManualCheckin(data: {
  employeeId: string;
  eventType: "IN" | "OUT";
  reasonId?: string;
  customReason?: string;
  performedBy: string;
  projectId?: string;
  notes?: string;
}) {
  // Validate caller has permission
  // Create manual check-in record
  // Append attendance event
  // Log audit trail
}

export async function getManualCheckinReasons() {
  // Fetch active reasons
}
```

### 5.3 Phase 3: Project Verification Settings (Day 6-7)

#### Task 3.1: Project Settings UI
**File:** `src/app/[role]/projects/page.tsx`

Add verification method selector to project creation/edit dialog:

```tsx
<Row label="Verification Method" hint="How employees check in for this project">
  <Select 
    value={verificationMethod} 
    onValueChange={(v: VerificationMethod) => setVerificationMethod(v)}
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="face_only">Face Recognition Only</SelectItem>
      <SelectItem value="qr_only">QR Code Only</SelectItem>
      <SelectItem value="face_or_qr">Face OR QR (Employee Choice)</SelectItem>
      <SelectItem value="manual_only">Manual Check-in Only</SelectItem>
    </SelectContent>
  </Select>
</Row>
```

#### Task 3.2: Project Verification Service
**File:** `src/services/project-verification.service.ts`

```typescript
export async function setProjectVerificationMethod(
  projectId: string, 
  method: VerificationMethod,
  options: { requireGeofence?: boolean; geofenceRadiusMeters?: number }
) {
  // Upsert project_verification_methods
}

export async function getProjectVerificationMethod(projectId: string) {
  // Fetch verification method
}
```

### 5.4 Phase 4: Dual Kiosk Pages (Day 8-10)

#### Task 4.1: Kiosk Entry with PIN
**File:** `src/app/kiosk/page.tsx` (new landing page)

```tsx
"use client";

export default function KioskLandingPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  
  const handlePinSubmit = async () => {
    // Verify PIN against kiosk_pins table
    // On success, redirect to /kiosk/face or /kiosk/qr based on settings
  };
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-950">
      <Card className="w-full max-w-md p-8">
        <CardHeader>
          <CardTitle className="text-white text-2xl">Kiosk Access</CardTitle>
          <p className="text-white/60">Enter your 6-digit PIN to access the kiosk</p>
        </CardHeader>
        <CardContent>
          <Input 
            type="password" 
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl tracking-[0.5em] font-mono"
            placeholder="000000"
          />
          {error && <p className="text-red-500 mt-2">{error}</p>}
          <Button onClick={handlePinSubmit} className="w-full mt-4">
            Access Kiosk
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Task 4.2: Face Recognition Kiosk
**File:** `src/app/kiosk/face/page.tsx`

```tsx
"use client";

export default function FaceKioskPage() {
  // Similar to current kiosk page but:
  // - Only shows face recognition tab
  // - Shows enrollment prompt if employee not enrolled
  // - Fetches verification method from project settings
}
```

#### Task 4.3: QR Code Kiosk
**File:** `src/app/kiosk/qr/page.tsx`

```tsx
"use client";

export default function QRKioskPage() {
  // Similar to current kiosk page but:
  // - Only shows QR scanner tab
  // - Validates location before accepting scan
  // - Uses dynamic QR tokens (30-second expiry)
}
```

#### Task 4.4: Update Kiosk Settings
**File:** `src/app/[role]/settings/kiosk/page.tsx`

Add new sections:
- Kiosk PIN configuration
- Default kiosk type (face/qr)
- Auto-redirect settings

### 5.5 Phase 5: Enhanced QR Security (Day 11-12)

#### Task 5.1: Dynamic QR Token Generation
**File:** `src/lib/qr-utils.ts`

```typescript
// Replace static HMAC with dynamic tokens
export async function generateDynamicQRToken(employeeId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30000); // 30 seconds
  
  // Store in database via API
  await fetch('/api/attendance/generate-qr-token', {
    method: 'POST',
    body: JSON.stringify({ employeeId, token, expiresAt })
  });
  
  return `NEXHRMS-DYN:${employeeId}:${token}`;
}
```

#### Task 5.2: Location-Validated QR Scan
**File:** `src/app/api/attendance/validate-qr/route.ts`

```typescript
export async function POST(request: Request) {
  const { token, kioskId, location } = await request.json();
  
  // 1. Validate token exists and not expired
  // 2. Validate token not used
  // 3. Validate location matches kiosk location (within 50m)
  // 4. Mark token as used
  // 5. Create attendance event
}
```

### 5.6 Phase 6: Manual Check-in UI (Day 13-14)

#### Task 6.1: Manual Check-in Dialog
**File:** `src/app/[role]/attendance/_views/admin-view.tsx`

Add manual check-in button and dialog:

```tsx
<Dialog open={manualCheckinOpen} onOpenChange={setManualCheckinOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Manual Check-in</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
        <SelectTrigger>
          <SelectValue placeholder="Select employee" />
        </SelectTrigger>
        <SelectContent>
          {employees.map(emp => (
            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select value={reasonId} onValueChange={setReasonId}>
        <SelectTrigger>
          <SelectValue placeholder="Select reason" />
        </SelectTrigger>
        <SelectContent>
          {reasons.map(r => (
            <SelectItem key={r.id} value={r.id}>{r.reason}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {reasonId === 'MCR-007' && (
        <Input 
          placeholder="Enter custom reason" 
          value={customReason}
          onChange={(e) => setCustomReason(e.target.value)}
        />
      )}
      
      <Button onClick={handleManualCheckin}>
        {mode === 'in' ? 'Check In' : 'Check Out'}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

### 5.7 Phase 7: Qwen AI Optimization (Day 15-16)

#### Task 7.1: Model Selection Logic
**File:** `src/app/api/attendance/verify-face/route.ts`

```typescript
// Use different models based on environment
const QWEN_MODEL = process.env.NODE_ENV === 'production' 
  ? 'qwen-vl-max'    // Production: best accuracy
  : 'qwen-vl-plus';  // Development: faster, cheaper

// Enhanced prompt for liveness detection
const systemPrompt = `You are an expert face verification system with advanced liveness detection.
Analyze the image for:

FACE PRESENCE:
- Exactly one human face clearly visible
- Face occupies 30-70% of image
- No heavy occlusion (masks, sunglasses)

LIVENESS INDICATORS (score each 0-100):
- Natural skin texture and pores
- 3D depth from lighting/shadows
- Micro-expressions or slight motion
- Natural eye reflection
- Background consistency

SPOOF INDICATORS (score each 0-100):
- Screen pixels or moiré patterns
- Paper edges or photo borders
- Flat appearance (no depth)
- Uniform lighting (suspicious)
- Mask-like smoothness

Respond with JSON:
{
  "verified": boolean,
  "confidence": "high" | "medium" | "low",
  "liveness_score": number (0-100),
  "face_detected": boolean,
  "reason": string,
  "spoof_indicators": string[]
}

Threshold: verified=true only if liveness_score >= 70 AND face_detected=true`;
```

#### Task 7.2: Retry Logic with Fallback
```typescript
async function verifyFaceWithRetry(imageBase64: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await callQwenAPI(imageBase64);
      if (result.confidence !== 'low') return result;
      
      // Wait before retry (exponential backoff)
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
  
  // Final fallback: allow with low confidence
  return { verified: true, confidence: 'low', reason: 'Fallback after retries' };
}
```

---

## 6. Security Considerations

### 6.1 Face Data Protection

| Measure | Implementation |
|---------|---------------|
| Encryption | AES-256 encryption for face templates |
| Storage | Store hash only, not raw images |
| Access Control | RLS policies restrict to admin/HR |
| Retention | Auto-delete after employee resignation + 90 days |
| Consent | Require explicit consent checkbox during enrollment |

### 6.2 QR Code Security

| Measure | Implementation |
|---------|---------------|
| Token Expiry | 30-second validity window |
| Single Use | Tokens marked as used immediately |
| Location Binding | Validate scan location matches kiosk |
| Device Binding | Kiosk device ID required |
| HMAC Signature | Prevent token tampering |

### 6.3 Kiosk Access Control

| Measure | Implementation |
|---------|---------------|
| PIN Protection | 6-digit PIN required for kiosk entry |
| PIN Hashing | bcrypt hash stored in database |
| Rate Limiting | Lock after 5 failed attempts |
| Audit Trail | Log all kiosk access attempts |
| Session Timeout | Auto-logout after 5 minutes idle |

### 6.4 API Security

| Measure | Implementation |
|---------|---------------|
| Authentication | Supabase JWT required |
| Authorization | Role-based access checks |
| Rate Limiting | 10 requests/minute per user |
| Input Validation | Zod schemas for all inputs |
| CORS | Restrict to allowed origins |

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// __tests__/features/kiosk-face-recognition.test.ts
describe('Face Recognition', () => {
  test('should enroll face with 3 images', async () => {
    // Test enrollment flow
  });
  
  test('should verify enrolled face', async () => {
    // Test verification flow
  });
  
  test('should reject spoofed face', async () => {
    // Test liveness detection
  });
});

describe('QR Token', () => {
  test('should generate valid token', () => {
    // Test token generation
  });
  
  test('should expire token after 30 seconds', async () => {
    // Test token expiry
  });
  
  test('should reject used token', async () => {
    // Test single-use validation
  });
  
  test('should validate location', () => {
    // Test geofence validation
  });
});

describe('Manual Check-in', () => {
  test('should create manual check-in with reason', () => {
    // Test manual check-in creation
  });
  
  test('should log performedBy field', () => {
    // Test audit trail
  });
});
```

### 7.2 Integration Tests

```typescript
// __tests__/integration/kiosk-flow.test.ts
describe('Kiosk Flow', () => {
  test('complete face recognition check-in', async () => {
    // PIN entry → Face enrollment → Face verification → Check-in
  });
  
  test('complete QR check-in', async () => {
    // PIN entry → QR scan → Location validation → Check-in
  });
  
  test('manual check-in by admin', async () => {
    // Admin login → Select employee → Manual check-in → Verify event
  });
});
```

### 7.3 E2E Tests (Playwright)

```typescript
// e2e/kiosk-face-recognition.spec.ts
test('employee face recognition enrollment and check-in', async ({ page }) => {
  // Navigate to kiosk
  await page.goto('/kiosk');
  
  // Enter PIN
  await page.fill('input[type="password"]', '123456');
  await page.click('button:has-text("Access Kiosk")');
  
  // Navigate to face kiosk
  await page.click('button:has-text("Face Recognition")');
  
  // Enroll face (simulated)
  await page.click('button:has-text("Open Camera")');
  // ... simulate camera capture
  
  // Verify enrollment success
  await expect(page.locator('text=Face Enrolled')).toBeVisible();
  
  // Check in
  await page.click('button:has-text("Check In")');
  await expect(page.locator('text=Checked In')).toBeVisible();
});
```

### 7.4 Performance Tests

| Test | Target |
|------|--------|
| Face verification latency | <3 seconds |
| QR token generation | <500ms |
| QR validation | <1 second |
| Kiosk page load | <2 seconds |
| Concurrent kiosk sessions | 100+ simultaneous |

---

## 8. Rollout Plan

### 8.1 Phase 1: Internal Testing (Week 1)
- [ ] Deploy to staging environment
- [ ] Test with development team
- [ ] Fix critical bugs
- [ ] Update documentation

### 8.2 Phase 2: Pilot Program (Week 2-3)
- [ ] Select 2-3 pilot projects
- [ ] Enroll faces for pilot employees
- [ ] Monitor usage and feedback
- [ ] Iterate on UX issues

### 8.3 Phase 3: Gradual Rollout (Week 4-5)
- [ ] Enable for all admin users
- [ ] Create tutorial videos
- [ ] Update user documentation
- [ ] Train HR team

### 8.4 Phase 4: Full Deployment (Week 6)
- [ ] Enable for all employees
- [ ] Deprecate old QR system
- [ ] Monitor system health
- [ ] Collect metrics

### 8.5 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Face enrollment rate | ≥80% of employees | Database count |
| Face recognition success rate | ≥95% | Verification logs |
| QR scan success rate | ≥98% | Validation logs |
| Manual check-in rate | ≤5% of total | Manual check-in logs |
| User satisfaction | ≥4.5/5 | Post-deployment survey |
| System uptime | ≥99.9% | Monitoring dashboard |

---

## Appendix A: Environment Variables

```env
# Qwen AI Configuration
QWEN_API_KEY=sk-xxxxxxxxxxxxx
QWEN_MODEL_PRODUCTION=qwen-vl-max
QWEN_MODEL_DEVELOPMENT=qwen-vl-plus

# Kiosk Configuration
KIOSK_PIN_LENGTH=6
KIOSK_SESSION_TIMEOUT_MINUTES=5
KIOSK_MAX_FAILED_ATTEMPTS=5

# QR Token Configuration
QR_TOKEN_EXPIRY_SECONDS=30
QR_TOKEN_LENGTH=32

# Face Recognition Configuration
FACE_ENROLLMENT_IMAGES=3
FACE_VERIFICATION_THRESHOLD=0.7
FACE_TEMPLATE_ENCRYPTION_KEY=xxxxxxxxxxxxx

# Geofence Configuration
GEOFENCE_DEFAULT_RADIUS_METERS=100
GEOFENCE_QR_VALIDATION_RADIUS_METERS=50
```

---

## Appendix B: API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/attendance/verify-face` | POST | Verify face with AI |
| `/api/attendance/generate-qr-token` | POST | Generate dynamic QR token |
| `/api/attendance/validate-qr` | POST | Validate QR token + location |
| `/api/attendance/manual-checkin` | POST | Create manual check-in |
| `/api/face-recognition/enroll` | POST | Enroll new face |
| `/api/face-recognition/status` | GET | Get enrollment status |
| `/api/kiosk/verify-pin` | POST | Verify kiosk PIN |
| `/api/project-verification/set-method` | POST | Set project verification method |
| `/api/project-verification/get-method` | GET | Get project verification method |

---

## Appendix C: File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/022_*.sql` | CREATE | Database schema |
| `src/types/index.ts` | MODIFY | Add new types |
| `src/services/face-recognition.service.ts` | CREATE | Face enrollment/verification |
| `src/services/qr-token.service.ts` | CREATE | Dynamic QR tokens |
| `src/services/manual-checkin.service.ts` | CREATE | Manual check-in logic |
| `src/services/project-verification.service.ts` | CREATE | Project verification settings |
| `src/app/kiosk/page.tsx` | MODIFY | Add PIN entry landing |
| `src/app/kiosk/face/page.tsx` | CREATE | Face recognition kiosk |
| `src/app/kiosk/qr/page.tsx` | CREATE | QR code kiosk |
| `src/app/api/attendance/validate-qr/route.ts` | CREATE | QR validation endpoint |
| `src/app/api/attendance/generate-qr-token/route.ts` | CREATE | QR token generation |
| `src/app/api/attendance/manual-checkin/route.ts` | CREATE | Manual check-in endpoint |
| `src/app/[role]/projects/page.tsx` | MODIFY | Add verification method selector |
| `src/app/[role]/settings/kiosk/page.tsx` | MODIFY | Add PIN and kiosk settings |
| `src/__tests__/features/kiosk-face-recognition.test.ts` | CREATE | Unit tests |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Lead Developer | | | |
| Product Owner | | | |
| Security Review | | | |
| QA Lead | | | |

---

**Next Steps:**
1. Review and approve this plan
2. Create GitHub issue tickets for each task
3. Assign developers to phases
4. Set up project board for tracking
5. Begin Phase 1 implementation
