import { NextRequest, NextResponse } from "next/server";
import { getDashScopeBaseUrl, getQwenApiKey, getQwenModel } from "@/lib/env";
import { kioskRateLimiter, getClientIp } from "@/lib/rate-limit";
import { validateKioskAuth } from "@/lib/kiosk-auth";

/**
 * POST /api/attendance/verify-face
 *
 * Accepts a base64 JPEG image and the employee name.
 * Calls Qwen AI Model Studio (DashScope) to perform:
 *   1. Face presence detection — is there exactly one human face?
 *   2. Liveness analysis — does it look like a real person (not a photo-of-photo, screen, mask)?
 *   3. Anti-spoofing detection — screen pixels, paper edges, masks, etc.
 *
 * Uses:
 *   - qwen-vl-max for production (best accuracy, advanced liveness detection)
 *   - qwen-vl-plus for development (faster, cheaper)
 *
 * Returns: { 
 *   verified: boolean, 
 *   confidence: "high" | "medium" | "low",
 *   livenessScore: number (0-100),
 *   faceDetected: boolean,
 *   reason: string,
 *   spoofIndicators: string[]
 * }
 *
 * The API key never leaves the server.
 */

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15_000; // 15 seconds

export async function POST(request: NextRequest) {
    // Rate limiting
    const rl = kioskRateLimiter.check(getClientIp(request));
    if (!rl.ok) {
        return NextResponse.json(
            { verified: false, confidence: "none", reason: "Too many requests", faceDetected: false, livenessScore: 0, spoofIndicators: [] },
            { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
        );
    }

    // Kiosk device auth
    const auth = validateKioskAuth(request.headers);
    if (!auth.ok) {
        return NextResponse.json(
            { verified: false, confidence: "none", reason: auth.error, faceDetected: false, livenessScore: 0, spoofIndicators: [] },
            { status: auth.status },
        );
    }

    const apiKey = getQwenApiKey();
    if (!apiKey) {
        return NextResponse.json(
            { 
                verified: false, 
                confidence: "none", 
                reason: "AI service not configured.",
                faceDetected: false,
                livenessScore: 0,
                spoofIndicators: []
            },
            { status: 500 },
        );
    }

    let body: { imageBase64?: string; employeeName?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { 
                verified: false, 
                confidence: "none", 
                reason: "Invalid request body.",
                faceDetected: false,
                livenessScore: 0,
                spoofIndicators: []
            },
            { status: 400 },
        );
    }

    const { imageBase64, employeeName } = body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
        return NextResponse.json(
            { 
                verified: false, 
                confidence: "none", 
                reason: "Missing image data.",
                faceDetected: false,
                livenessScore: 0,
                spoofIndicators: []
            },
            { status: 400 },
        );
    }

    // Strip data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    // Validate it's a reasonable base64 image (< 5MB)
    if (base64Data.length > 5 * 1024 * 1024 * 1.37) {
        return NextResponse.json(
            { 
                verified: false, 
                confidence: "none", 
                reason: "Image too large (max 5MB).",
                faceDetected: false,
                livenessScore: 0,
                spoofIndicators: []
            },
            { status: 400 },
        );
    }

    // Enhanced system prompt for qwen-vl-max with detailed liveness detection
    const systemPrompt = `You are an expert face verification system with advanced liveness detection for attendance kiosks.

ANALYZE THE IMAGE FOR:

**FACE PRESENCE **(Required)
- Exactly ONE human face clearly visible
- Face occupies 30-70% of image
- No heavy occlusion (masks, sunglasses, hands covering face)

**LIVENESS INDICATORS **(Score each 0-100)
1. Natural skin texture and visible pores
2. 3D depth from lighting and shadows
3. Micro-expressions or slight natural motion
4. Natural eye reflection (catchlights)
5. Background consistency with real environment
6. Natural hair texture and edges

**SPOOF INDICATORS **(Detect and list)
1. Screen pixels, moiré patterns, or RGB subpixel glow
2. Paper edges, photo borders, or print artifacts
3. Flat appearance with no depth cues
4. Uniform lighting (suspiciously even)
5. Mask-like smoothness or plastic texture
6. Device frame or screen bezel visible
7. Reflection or glare patterns typical of screens
8. JPEG compression artifacts inconsistent with camera

**DECISION THRESHOLDS**:
- verified=true ONLY if: face_detected=true AND liveness_score>=70
- confidence="high" if liveness_score>=85
- confidence="medium" if liveness_score>=70
- confidence="low" if liveness_score<70 (should fail verification)

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "verified": true/false,
  "confidence": "high" | "medium" | "low",
  "liveness_score": number (0-100),
  "face_detected": true/false,
  "reason": "Brief explanation of the decision",
  "spoof_indicators": ["indicator1", "indicator2"] (empty array if none)
}`;

    const userPrompt = employeeName
        ? `Verify this face image for attendance check-in. Employee: ${employeeName}. Analyze for face presence and liveness only. Return the JSON response.`
        : `Verify this face image for attendance check-in. Analyze for face presence and liveness only. Return the JSON response.`;

    // Retry logic with exponential backoff
    const qwenUrl = getDashScopeBaseUrl();
    const qwenModel = getQwenModel();
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(qwenUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                body: JSON.stringify({
                    model: qwenModel,
                    messages: [
                        { role: "system", content: systemPrompt },
                        {
                            role: "user",
                            content: [
                                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
                                { type: "text", text: userPrompt },
                            ],
                        },
                    ],
                    max_tokens: 300,
                    temperature: 0.1,  // Low temperature for consistent analysis
                }),
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => "Unknown error");
                console.error(`[verify-face] Qwen API error (attempt ${attempt + 1}):`, response.status, errText);
                
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt)));
                    continue;
                }
                
                // All retries failed - fallback
                return NextResponse.json({
                    verified: true,
                    confidence: "low",
                    livenessScore: 50,
                    faceDetected: true,
                    reason: "AI verification unavailable after retries — allowed with reduced confidence.",
                    spoofIndicators: [],
                });
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content?.trim();

            if (!content) {
                return NextResponse.json({
                    verified: true,
                    confidence: "low",
                    livenessScore: 50,
                    faceDetected: true,
                    reason: "AI returned empty response — allowed with reduced confidence.",
                    spoofIndicators: [],
                });
            }

            // Parse the JSON response (strip markdown if present)
            const jsonStr = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

            let result: { 
                verified: boolean; 
                confidence: string; 
                reason: string;
                liveness_score?: number;
                face_detected?: boolean;
                spoof_indicators?: string[];
            };
            
            try {
                result = JSON.parse(jsonStr);
            } catch {
                // Fallback: check for keywords
                const lower = content.toLowerCase();
                const verified = lower.includes('"verified": true') || lower.includes('"verified":true');
                const hasLiveness = lower.includes("liveness") && lower.includes("score");
                
                result = {
                    verified,
                    confidence: verified ? "medium" : "low",
                    reason: verified ? "Face detected (parsed from response)." : "Could not verify face from AI response.",
                    liveness_score: verified ? 75 : 50,
                    face_detected: verified,
                    spoof_indicators: [],
                };
            }

            return NextResponse.json({
                verified: !!result.verified,
                confidence: result.confidence || "medium",
                livenessScore: result.liveness_score || 50,
                faceDetected: result.face_detected || false,
                reason: result.reason || "Analysis complete.",
                spoofIndicators: result.spoof_indicators || [],
            });
            
        } catch (error) {
            lastError = error;
            console.error(`[verify-face] Error (attempt ${attempt + 1}):`, error);
            
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt)));
                continue;
            }
        }
    }

    // All retries exhausted
    console.error("[verify-face] All retries failed:", lastError);
    return NextResponse.json({
        verified: true,
        confidence: "low",
        livenessScore: 50,
        faceDetected: true,
        reason: "AI service unreachable after retries — allowed with reduced confidence.",
        spoofIndicators: [],
    });
}
