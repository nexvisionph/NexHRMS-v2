/**
 * Feature Test: DB Mapper Round-Trip
 *
 * Covers: lib/db-mappers.ts
 * - snakeToCamel / camelToSnake key conversion
 * - rowToTs / tsToRow object conversion
 * - Employee-specific field round-trips (emergency_contact ↔ emergencyContact)
 * - Project location nesting/flattening
 * - Attendance log location nesting/flattening
 * - Timesheet segment parsing
 * - Edge cases: nulls, empty objects, acronyms
 */

import {
    snakeToCamel,
    camelToSnake,
    rowToTs,
    tsToRow,
    projectRowToTs,
    projectTsToRow,
    attendanceLogRowToTs,
    attendanceLogTsToRow,
    parseSegments,
} from "@/lib/db-mappers";

describe("DB Mappers", () => {
    // ── snakeToCamel ────────────────────────────────────────
    describe("snakeToCamel", () => {
        it("should convert simple snake_case to camelCase", () => {
            expect(snakeToCamel("first_name")).toBe("firstName");
        });

        it("should convert multi-word snake_case", () => {
            expect(snakeToCamel("emergency_contact")).toBe("emergencyContact");
        });

        it("should leave single word unchanged", () => {
            expect(snakeToCamel("name")).toBe("name");
        });

        it("should convert deeply nested snake_case", () => {
            expect(snakeToCamel("work_type_override")).toBe("workTypeOverride");
        });

        it("should handle already camelCase input gracefully", () => {
            // No underscores -> no conversion
            expect(snakeToCamel("firstName")).toBe("firstName");
        });

        it("should convert employee new field names correctly", () => {
            expect(snakeToCamel("emergency_contact")).toBe("emergencyContact");
            expect(snakeToCamel("team_leader")).toBe("teamLeader");
            expect(snakeToCamel("shift_id")).toBe("shiftId");
            expect(snakeToCamel("profile_id")).toBe("profileId");
            expect(snakeToCamel("join_date")).toBe("joinDate");
            expect(snakeToCamel("work_type")).toBe("workType");
            expect(snakeToCamel("work_days")).toBe("workDays");
            expect(snakeToCamel("avatar_url")).toBe("avatarUrl");
            expect(snakeToCamel("nfc_id")).toBe("nfcId");
            expect(snakeToCamel("resigned_at")).toBe("resignedAt");
            expect(snakeToCamel("created_at")).toBe("createdAt");
            expect(snakeToCamel("updated_at")).toBe("updatedAt");
        });
    });

    // ── camelToSnake ────────────────────────────────────────
    describe("camelToSnake", () => {
        it("should convert simple camelCase to snake_case", () => {
            expect(camelToSnake("firstName")).toBe("first_name");
        });

        it("should convert emergencyContact", () => {
            expect(camelToSnake("emergencyContact")).toBe("emergency_contact");
        });

        it("should leave single word unchanged", () => {
            expect(camelToSnake("name")).toBe("name");
        });

        it("should handle acronyms correctly", () => {
            // The regex handles ID, UTC prefixed with lowercase
            expect(camelToSnake("nfcId")).toBe("nfc_id");
            expect(camelToSnake("shiftId")).toBe("shift_id");
            expect(camelToSnake("profileId")).toBe("profile_id");
        });

        it("should convert employee new field names correctly", () => {
            expect(camelToSnake("emergencyContact")).toBe("emergency_contact");
            expect(camelToSnake("teamLeader")).toBe("team_leader");
            expect(camelToSnake("shiftId")).toBe("shift_id");
            expect(camelToSnake("joinDate")).toBe("join_date");
            expect(camelToSnake("workType")).toBe("work_type");
            expect(camelToSnake("workDays")).toBe("work_days");
            expect(camelToSnake("avatarUrl")).toBe("avatar_url");
            expect(camelToSnake("resignedAt")).toBe("resigned_at");
            expect(camelToSnake("createdAt")).toBe("created_at");
            expect(camelToSnake("updatedAt")).toBe("updated_at");
        });

        it("should be inverse of snakeToCamel for standard keys", () => {
            const snakeKeys = [
                "emergency_contact", "team_leader", "shift_id",
                "join_date", "work_type", "profile_id",
            ];
            for (const key of snakeKeys) {
                expect(camelToSnake(snakeToCamel(key))).toBe(key);
            }
        });
    });

    // ── rowToTs ─────────────────────────────────────────────
    describe("rowToTs", () => {
        it("should convert a DB row with snake_case keys to camelCase", () => {
            const row = {
                id: "EMP001",
                first_name: "Olivia",
                emergency_contact: "Mom +63-555-1234",
                team_leader: "EMP010",
            };

            const ts = rowToTs<Record<string, unknown>>(row);

            expect(ts.id).toBe("EMP001");
            expect(ts.firstName).toBe("Olivia");
            expect(ts.emergencyContact).toBe("Mom +63-555-1234");
            expect(ts.teamLeader).toBe("EMP010");
        });

        it("should convert a full employee DB row", () => {
            const row = {
                id: "EMP-TEST",
                name: "Test User",
                email: "test@company.com",
                role: "Frontend Developer",
                department: "Engineering",
                status: "active",
                work_type: "WFO",
                salary: 50000,
                join_date: "2024-01-15",
                productivity: 80,
                location: "Manila",
                phone: "+63-555-0001",
                birthday: "1995-01-01",
                team_leader: "EMP001",
                shift_id: "SHIFT-AM",
                emergency_contact: "Emergency Person",
                address: "123 Test St",
                profile_id: "U001",
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
            };

            const ts = rowToTs<Record<string, unknown>>(row);

            expect(ts.workType).toBe("WFO");
            expect(ts.joinDate).toBe("2024-01-15");
            expect(ts.teamLeader).toBe("EMP001");
            expect(ts.shiftId).toBe("SHIFT-AM");
            expect(ts.emergencyContact).toBe("Emergency Person");
            expect(ts.address).toBe("123 Test St");
            expect(ts.profileId).toBe("U001");
            expect(ts.createdAt).toBe("2024-01-01T00:00:00Z");
        });

        it("should preserve null values", () => {
            const row = { emergency_contact: null, address: null };
            const ts = rowToTs<Record<string, unknown>>(row);
            expect(ts.emergencyContact).toBeNull();
            expect(ts.address).toBeNull();
        });

        it("should handle empty object", () => {
            const ts = rowToTs<Record<string, unknown>>({});
            expect(Object.keys(ts)).toHaveLength(0);
        });
    });

    // ── tsToRow ─────────────────────────────────────────────
    describe("tsToRow", () => {
        it("should convert a TS object with camelCase keys to snake_case", () => {
            const ts = {
                id: "EMP001",
                emergencyContact: "Jane +63-555-0000",
                teamLeader: "EMP010",
                shiftId: "SHIFT-AM",
            };

            const row = tsToRow(ts);

            expect(row.id).toBe("EMP001");
            expect(row.emergency_contact).toBe("Jane +63-555-0000");
            expect(row.team_leader).toBe("EMP010");
            expect(row.shift_id).toBe("SHIFT-AM");
        });

        it("should convert full employee TS object to DB row", () => {
            const ts = {
                id: "EMP-TEST",
                name: "Test User",
                email: "test@company.com",
                role: "Developer",
                department: "Engineering",
                status: "active",
                workType: "WFO",
                salary: 50000,
                joinDate: "2024-01-15",
                productivity: 80,
                location: "Manila",
                emergencyContact: "Contact Person",
                address: "456 Address St",
                birthday: "1990-05-15",
                teamLeader: "EMP001",
                shiftId: "SHIFT-PM",
                profileId: "U002",
            };

            const row = tsToRow(ts);

            expect(row.work_type).toBe("WFO");
            expect(row.join_date).toBe("2024-01-15");
            expect(row.emergency_contact).toBe("Contact Person");
            expect(row.address).toBe("456 Address St");
            expect(row.team_leader).toBe("EMP001");
            expect(row.shift_id).toBe("SHIFT-PM");
            expect(row.profile_id).toBe("U002");
        });

        it("should preserve undefined values", () => {
            const ts = { emergencyContact: undefined };
            const row = tsToRow(ts);
            expect(row.emergency_contact).toBeUndefined();
        });
    });

    // ── Round-Trip Fidelity ─────────────────────────────────
    describe("Round-trip conversion fidelity", () => {
        it("should preserve employee data through rowToTs → tsToRow cycle", () => {
            const originalRow: Record<string, unknown> = {
                id: "EMP-RT-001",
                name: "Round Trip User",
                email: "roundtrip@company.com",
                emergency_contact: "Parent +63-555-9999",
                address: "Unit 42, Condo Tower, BGC",
                team_leader: "EMP010",
                shift_id: "SHIFT-NIGHT",
                birthday: "1992-12-25",
                profile_id: "U-RT-001",
            };

            // Row → TS → Row
            const ts = rowToTs<Record<string, unknown>>(originalRow);
            const roundTrippedRow = tsToRow(ts);

            expect(roundTrippedRow).toEqual(originalRow);
        });

        it("should preserve TS data through tsToRow → rowToTs cycle", () => {
            const originalTs: Record<string, unknown> = {
                id: "EMP-RT-002",
                name: "Round Trip TS",
                emergencyContact: "Sibling +63-917-0000",
                address: "789 Ayala Ave, Makati",
                teamLeader: "EMP005",
                shiftId: "SHIFT-AM",
            };

            // TS → Row → TS
            const row = tsToRow(originalTs);
            const roundTrippedTs = rowToTs<Record<string, unknown>>(row);

            expect(roundTrippedTs).toEqual(originalTs);
        });

        it("should handle null values in round trip", () => {
            const originalRow = {
                id: "EMP-NULL",
                emergency_contact: null,
                address: null,
                team_leader: null,
            };

            const roundTripped = tsToRow(rowToTs<Record<string, unknown>>(originalRow));
            expect(roundTripped).toEqual(originalRow);
        });
    });

    // ── Project Location Mappers ────────────────────────────
    describe("projectRowToTs / projectTsToRow", () => {
        it("should nest location from flat SQL columns", () => {
            const row = {
                id: "PRJ001",
                name: "Test Project",
                location_lat: 14.5547,
                location_lng: 121.0244,
                location_radius: 200,
            };

            const ts = projectRowToTs(row);

            expect(ts.location).toEqual({ lat: 14.5547, lng: 121.0244, radius: 200 });
            expect(ts).not.toHaveProperty("locationLat");
            expect(ts).not.toHaveProperty("locationLng");
        });

        it("should flatten nested location to SQL columns", () => {
            const ts = {
                id: "PRJ001",
                name: "Test Project",
                location: { lat: 14.5547, lng: 121.0244, radius: 200 },
            };

            const row = projectTsToRow(ts);

            expect(row.location_lat).toBe(14.5547);
            expect(row.location_lng).toBe(121.0244);
            expect(row.location_radius).toBe(200);
            expect(row).not.toHaveProperty("location");
        });

        it("should use default radius when missing", () => {
            const row = {
                id: "PRJ002",
                location_lat: 10.0,
                location_lng: 120.0,
                location_radius: null,
            };

            const ts = projectRowToTs(row);
            expect(ts.location).toEqual({ lat: 10.0, lng: 120.0, radius: 100 });
        });

        it("should skip location when lat/lng are null", () => {
            const row = { id: "PRJ003", location_lat: null, location_lng: null };
            const ts = projectRowToTs(row);
            expect(ts.location).toBeUndefined();
        });

        it("should round-trip project location", () => {
            const original = {
                id: "PRJ-RT",
                name: "Round Trip Project",
                location: { lat: 14.5, lng: 121.0, radius: 300 },
            };

            const row = projectTsToRow(original);
            const restored = projectRowToTs(row);

            expect(restored.location).toEqual(original.location);
        });
    });

    // ── Attendance Log Location Mappers ─────────────────────
    describe("attendanceLogRowToTs / attendanceLogTsToRow", () => {
        it("should nest locationSnapshot from flat columns", () => {
            const row = {
                id: "ATT001",
                employee_id: "EMP001",
                location_lat: 14.55,
                location_lng: 121.02,
            };

            const ts = attendanceLogRowToTs(row);

            expect(ts.locationSnapshot).toEqual({ lat: 14.55, lng: 121.02 });
        });

        it("should flatten locationSnapshot to columns", () => {
            const ts = {
                id: "ATT001",
                employeeId: "EMP001",
                locationSnapshot: { lat: 14.55, lng: 121.02 },
            };

            const row = attendanceLogTsToRow(ts);

            expect(row.location_lat).toBe(14.55);
            expect(row.location_lng).toBe(121.02);
        });

        it("should skip locationSnapshot when lat/lng null", () => {
            const row = { id: "ATT002", location_lat: null, location_lng: null };
            const ts = attendanceLogRowToTs(row);
            expect(ts.locationSnapshot).toBeUndefined();
        });
    });

    // ── parseSegments ───────────────────────────────────────
    describe("parseSegments", () => {
        it("should return array input as-is", () => {
            const segments = [{ type: "work", start: "09:00", end: "12:00" }];
            expect(parseSegments(segments)).toEqual(segments);
        });

        it("should parse valid JSON string", () => {
            const json = JSON.stringify([{ type: "break", start: "12:00", end: "13:00" }]);
            const result = parseSegments(json);
            expect(result).toHaveLength(1);
            expect(result[0].type).toBe("break");
        });

        it("should return empty array for invalid JSON string", () => {
            expect(parseSegments("not json")).toEqual([]);
        });

        it("should return empty array for null", () => {
            expect(parseSegments(null)).toEqual([]);
        });

        it("should return empty array for undefined", () => {
            expect(parseSegments(undefined)).toEqual([]);
        });

        it("should return empty array for non-array JSON", () => {
            expect(parseSegments('{"key": "value"}')).toEqual([]);
        });

        it("should return empty array for number", () => {
            expect(parseSegments(42)).toEqual([]);
        });
    });
});
