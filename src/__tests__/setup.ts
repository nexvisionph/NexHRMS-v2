/**
 * Jest test setup file — NexHRMS
 * ================================
 * - Extends Jest with Testing Library matchers
 * - Mocks Supabase clients to prevent hitting real DB in unit tests
 * - Mocks nanoid for deterministic IDs
 * - Provides test utilities and helpers
 * 
 * Test Patterns:
 * - Arrange-Act-Assert (AAA)
 * - Test behavior, not implementation
 * - One assertion per concept (multiple expects OK if same concept)
 */

import "@testing-library/jest-dom";

// ═══════════════════════════════════════════════════════════════
// Mock External Services
// ═══════════════════════════════════════════════════════════════

// Mock Supabase server clients — prevents real DB calls in tests
jest.mock("@/services/supabase-server", () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  })),
  createAdminSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({ data: { user: { id: "test-user-id" } }, error: null }),
        deleteUser: jest.fn().mockResolvedValue({ data: null, error: null }),
        updateUserById: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    },
  })),
}));

// Mock Supabase browser client
jest.mock("@/services/supabase-browser", () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  })),
  createClient: jest.fn(),
}));

// Mock nanoid for deterministic IDs in tests
jest.mock("nanoid", () => ({
  nanoid: jest.fn(() => "test-id-mock"),
}));

// ═══════════════════════════════════════════════════════════════
// Test Lifecycle Hooks
// ═══════════════════════════════════════════════════════════════

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.resetAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// Global Test Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Wait for all pending promises to resolve.
 * Useful for testing async Zustand store updates.
 */
global.flushPromises = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Create a mock employee for testing.
 */
global.createMockEmployee = (overrides = {}) => ({
  id: "EMP-TEST01",
  name: "Test Employee",
  email: "test@example.com",
  role: "employee" as const,
  jobTitle: "Developer",
  department: "Engineering",
  workType: "WFO" as const,
  salary: 50000,
  joinDate: "2024-01-15",
  productivity: 80,
  status: "active" as const,
  location: "",
  ...overrides,
});

/**
 * Create a mock payslip for testing.
 */
global.createMockPayslip = (overrides = {}) => ({
  id: "PS-TEST01",
  employeeId: "EMP-TEST01",
  periodStart: "2026-04-01",
  periodEnd: "2026-04-15",
  payFrequency: "semi_monthly" as const,
  grossPay: 25000,
  netPay: 20000,
  status: "draft" as const,
  issuedAt: "2026-04-16",
  sssDeduction: 1125,
  philhealthDeduction: 625,
  pagibigDeduction: 100,
  taxDeduction: 2000,
  ...overrides,
});

// Type declarations for global utilities
declare global {
  function flushPromises(): Promise<void>;
  function createMockEmployee(overrides?: Record<string, unknown>): {
    id: string;
    name: string;
    email: string;
    role: "employee" | "admin" | "hr" | "finance";
    jobTitle: string;
    department: string;
    workType: "WFO" | "WFH" | "HYBRID" | "ONSITE";
    salary: number;
    joinDate: string;
    productivity: number;
    status: "active" | "inactive" | "resigned";
    location: string;
  };
  function createMockPayslip(overrides?: Record<string, unknown>): {
    id: string;
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    payFrequency: "monthly" | "semi_monthly" | "bi_weekly" | "weekly";
    grossPay: number;
    netPay: number;
    status: "draft" | "published" | "signed" | "paid";
    issuedAt: string;
    sssDeduction: number;
    philhealthDeduction: number;
    pagibigDeduction: number;
    taxDeduction: number;
  };
}
