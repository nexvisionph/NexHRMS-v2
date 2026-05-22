/**
 * Test Script: Push Subscription API
 *
 * Tests the /api/push/subscribe endpoint (POST, GET, DELETE).
 * Uses Supabase to authenticate as a real user.
 *
 * Prerequisites:
 *   1. Run `npm run dev` in another terminal
 *   2. VAPID keys configured in .env.local
 *
 * Usage:
 *   npx tsx scripts/test-push-subscribe.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Test user credentials — use an existing employee account
const TEST_EMAIL = process.env.TEST_USER_EMAIL || "admin@nexhrms.com";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "admin123";

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  NexHRMS Push Subscription API Test");
  console.log("═══════════════════════════════════════════════\n");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("❌ Supabase credentials not configured in .env.local");
    process.exit(1);
  }

  // 1. Authenticate with Supabase
  console.log("1. Authenticating with Supabase...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError || !authData.session) {
    console.error("   ❌ Auth failed:", authError?.message || "No session");
    console.error("   Make sure TEST_USER_EMAIL and TEST_USER_PASSWORD are correct");
    console.error("   Or set them as env vars");
    process.exit(1);
  }

  const accessToken = authData.session.access_token;
  console.log("   ✅ Authenticated as:", authData.user?.email);

  const headers = {
    "Content-Type": "application/json",
    "Cookie": `sb-access-token=${accessToken}; sb-refresh-token=${authData.session.refresh_token}`,
    "Authorization": `Bearer ${accessToken}`,
  };

  // 2. Test POST /api/push/subscribe (create subscription)
  console.log("\n2. Testing POST /api/push/subscribe...");
  const mockSubscription = {
    subscription: {
      endpoint: `https://fcm.googleapis.com/fcm/send/test-${Date.now()}`,
      keys: {
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REfines",
        auth: "tBHItJI5svbpC7htHEhp9w",
      },
    },
    userAgent: "NexHRMS Test Script",
  };

  try {
    const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
      method: "POST",
      headers,
      body: JSON.stringify(mockSubscription),
    });
    const data = await res.json();
    console.log("   Status:", res.status);
    console.log("   Response:", JSON.stringify(data, null, 2));
    
    if (res.status === 201 && data.ok) {
      console.log("   ✅ Subscription created:", data.subscriptionId);
    } else {
      console.log("   ❌ Failed to create subscription");
    }
  } catch (err) {
    console.error("   ❌ Request failed:", (err as Error).message);
  }

  // 3. Test GET /api/push/subscribe (list subscriptions)
  console.log("\n3. Testing GET /api/push/subscribe...");
  try {
    const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
      method: "GET",
      headers,
    });
    const data = await res.json();
    console.log("   Status:", res.status);
    console.log("   Subscriptions:", data.subscriptions?.length || 0, "active");
    
    if (data.subscriptions?.length > 0) {
      for (const sub of data.subscriptions) {
        console.log("     -", sub.id, "|", sub.user_agent || "unknown", "|", sub.endpoint.substring(0, 50) + "...");
      }
      console.log("   ✅ Subscriptions listed");
    } else {
      console.log("   ⚠️  No active subscriptions found");
    }
  } catch (err) {
    console.error("   ❌ Request failed:", (err as Error).message);
  }

  // 4. Test DELETE /api/push/subscribe (remove subscription)
  console.log("\n4. Testing DELETE /api/push/subscribe...");
  try {
    const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ endpoint: mockSubscription.subscription.endpoint }),
    });
    const data = await res.json();
    console.log("   Status:", res.status);
    console.log("   Response:", JSON.stringify(data, null, 2));
    
    if (data.ok) {
      console.log("   ✅ Subscription deactivated");
    } else {
      console.log("   ❌ Failed to deactivate subscription");
    }
  } catch (err) {
    console.error("   ❌ Request failed:", (err as Error).message);
  }

  // 5. Test validation — bad subscription format
  console.log("\n5. Testing validation (bad subscription)...");
  try {
    const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
      method: "POST",
      headers,
      body: JSON.stringify({ subscription: { endpoint: "test" } }),
    });
    const data = await res.json();
    if (res.status === 400) {
      console.log("   ✅ Correctly rejected with 400:", data.error);
    } else {
      console.log("   ❌ Expected 400, got", res.status);
    }
  } catch (err) {
    console.error("   ❌ Request failed:", (err as Error).message);
  }

  // 6. Test unauthed request
  console.log("\n6. Testing unauthenticated request...");
  try {
    const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (res.status === 401) {
      console.log("   ✅ Correctly rejected with 401:", data.error);
    } else {
      console.log("   ⚠️  Got status", res.status, "(may be 200 with empty subscriptions if auth optional on GET)");
    }
  } catch (err) {
    console.error("   ❌ Request failed:", (err as Error).message);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Push Subscription Tests Complete");
  console.log("═══════════════════════════════════════════════");

  // Clean up
  await supabase.auth.signOut();
}

main();
