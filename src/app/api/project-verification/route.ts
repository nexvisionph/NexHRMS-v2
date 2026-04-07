import { NextRequest, NextResponse } from "next/server";
import { 
    setProjectVerificationMethod, 
    getProjectVerificationMethod,
    getAllProjectVerificationMethods 
} from "@/services/project-verification.service";
import type { VerificationMethod } from "@/types";

/**
 * GET /api/project-verification
 * 
 * Gets verification methods for all projects (admin only).
 */

export async function GET(request: NextRequest) {
    try {
        // Verify caller is authenticated
        const { createServerSupabaseClient } = await import("@/services/supabase-server");
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        // In demo mode, allow without auth for testing; in production, require auth
        const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
        if (!user && !isDemoMode) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const projectId = request.nextUrl.searchParams.get("projectId");
        
        if (projectId) {
            // Get single project
            const result = await getProjectVerificationMethod(projectId);
            
            if (!result) {
                return NextResponse.json(
                    { error: "Project not found" },
                    { status: 404 }
                );
            }
            
            return NextResponse.json(result);
        }
        
        // Get all projects
        const methods = await getAllProjectVerificationMethods();
        return NextResponse.json(methods);
    } catch (error) {
        console.error("[project-verification-get] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/project-verification
 * 
 * Sets verification method for a project.
 * Requires admin role.
 * 
 * Request: { 
 *   projectId: string,
 *   method: "face_only" | "qr_only" | "face_or_qr" | "manual_only",
 *   options?: {
 *     requireGeofence?: boolean,
 *     geofenceRadiusMeters?: number,
 *     allowManualOverride?: boolean
 *   }
 * }
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, method, options } = body;

        // Validate required fields
        if (!projectId || typeof projectId !== "string") {
            return NextResponse.json(
                { ok: false, error: "Missing or invalid project ID" },
                { status: 400 }
            );
        }

        const validMethods: VerificationMethod[] = [
            "face_only",
            "qr_only",
            "manual_only"
        ];

        if (!method || !validMethods.includes(method)) {
            return NextResponse.json(
                { ok: false, error: `Invalid method. Must be one of: ${validMethods.join(", ")}` },
                { status: 400 }
            );
        }

        // Set verification method
        const result = await setProjectVerificationMethod(projectId, method, options);

        if (!result.ok) {
            return NextResponse.json(
                { ok: false, error: result.error },
                { status: result.error?.includes("Unauthorized") ? 403 : 500 }
            );
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[project-verification-post] Error:", error);
        return NextResponse.json(
            { ok: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
