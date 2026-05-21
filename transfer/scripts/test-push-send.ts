/**
 * Test Script: Send Push Notification via API
 *
 * Tests the /api/push/send endpoint by sending a real push notification
 * through the running Next.js dev server.
 *
 * Prerequisites:
 *   1. Run `npm run dev` in another terminal
 *   2. Have at least one registered push subscription in the database
 *   3. VAPID keys configured in .env.local
 *
 * Usage:
 *   npx tsx scripts/test-push-send.ts
 *   npx tsx scripts/test-push-send.ts --employee EMP-xxxx
 */
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const PUSH_API_KEY = process.env.PUSH_API_KEY || "";

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  NexHRMS Push Send Test");
  console.log("═══════════════════════════════════════════════\n");

  if (!PUSH_API_KEY) {
    console.error("❌ PUSH_API_KEY is not set in .env.local");
    process.exit(1);
  }

  // Parse CLI args
  const args = process.argv.slice(2);
  const employeeIdx = args.indexOf("--employee");
  const employeeId = employeeIdx >= 0 ? args[employeeIdx + 1] : undefined;

  if (!employeeId) {
    console.log("No --employee flag provided. Will try to send to all employees.");
    console.log("Usage: npx tsx scripts/test-push-send.ts --employee EMP-xxxx\n");
  }

  // 1. Test /api/push/send with API key auth
  console.log("1. Sending test push notification...");
  console.log("   Target:", employeeId || "all employees");
  console.log("   Server:", BASE_URL);

  const payload: Record<string, unknown> = {
    title: "🔔 NexHRMS Test Notification",
    body: `This is a test push notification sent at ${new Date().toLocaleTimeString()}.`,
    url: "/notifications",
    tag: `test-${Date.now()}`,
  };

  if (employeeId) {
    payload.employeeId = employeeId;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": PUSH_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    console.log("\n   Response status:", res.status);
    console.log("   Response body:", JSON.stringify(data, null, 2));

    if (res.ok && data.ok) {
      console.log(`\n   ✅ Push sent successfully! (${data.sent} sent, ${data.failed || 0} failed)`);
      if (data.expired) {
        console.log(`   ⚠️  ${data.expired} expired subscriptions were deactivated`);
      }
    } else {
      console.log("\n   ❌ Push failed:", data.error || data.message || "Unknown error");
    }
  } catch (err) {
    console.error("\n   ❌ Request failed:", (err as Error).message);
    console.error("   Is the dev server running? (npm run dev)");
    process.exit(1);
  }

  // 2. Test validation — missing title
  console.log("\n2. Testing validation (missing title)...");
  try {
    const res = await fetch(`${BASE_URL}/api/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": PUSH_API_KEY,
      },
      body: JSON.stringify({ body: "test" }),
    });
    const data = await res.json();
    if (res.status === 400) {
      console.log("   ✅ Correctly rejected with 400:", data.error);
    } else {
      console.log("   ❌ Expected 400, got", res.status, data);
    }
  } catch (err) {
    console.error("   ❌ Request failed:", (err as Error).message);
  }

  // 3. Test auth — no API key, no session
  console.log("\n3. Testing auth (no API key, no session)...");
  try {
    const res = await fetch(`${BASE_URL}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Unauthorized test",
        body: "Should fail",
        employeeId: "EMP-test",
      }),
    });
    const data = await res.json();
    if (res.status === 401 || res.status === 403) {
      console.log("   ✅ Correctly rejected with", res.status + ":", data.error);
    } else {
      console.log("   ❌ Expected 401/403, got", res.status, data);
    }
  } catch (err) {
    console.error("   ❌ Request failed:", (err as Error).message);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Push Send Tests Complete");
  console.log("═══════════════════════════════════════════════");
}

main();
