# NexHRMS — Biometric Attendance Setup (Vercel / Cloud Deployment)

> **Who is this guide for?**
> Office administrators or IT staff setting up the FK F80 biometric device to work with NexHRMS hosted on Vercel. This guide covers everything from scratch — Vercel configuration, the local bridge relay, device setup, health checks, and testing.

---

## Table of Contents

- [What You'll Need](#what-youll-need)
- [How It Works](#how-it-works)
- [Local vs Vercel — What's Different?](#local-vs-vercel--whats-different)
- [Part A — Vercel & Database Setup (One-Time)](#part-a--vercel--database-setup-one-time)
  - [Step 1 — Verify NexHRMS is Deployed on Vercel](#step-1--verify-nexhrms-is-deployed-on-vercel)
  - [Step 2 — Apply Database Migrations](#step-2--apply-database-migrations)
  - [Step 3 — Generate a Security Key](#step-3--generate-a-security-key)
  - [Step 4 — Add the Key to Vercel](#step-4--add-the-key-to-vercel)
  - [Step 5 — Verify Vercel Health Check](#step-5--verify-vercel-health-check)
- [Part B — Office Computer Setup (One-Time)](#part-b--office-computer-setup-one-time)
  - [Step 6 — Install Node.js](#step-6--install-nodejs)
  - [Step 7 — Download the Project](#step-7--download-the-project)
  - [Step 8 — Install Dependencies](#step-8--install-dependencies)
  - [Step 9 — Configure the Bridge](#step-9--configure-the-bridge)
  - [Step 10 — Set Up Windows Firewall](#step-10--set-up-windows-firewall)
- [Part C — Device Setup (One-Time)](#part-c--device-setup-one-time)
  - [Step 11 — Find the Computer's WiFi IP](#step-11--find-the-computers-wifi-ip)
  - [Step 12 — Configure the F80 Device](#step-12--configure-the-f80-device)
- [Part D — Employee Registration](#part-d--employee-registration)
  - [Step 13 — Enroll Employees on the Device](#step-13--enroll-employees-on-the-device)
  - [Step 14 — Link Employees in NexHRMS](#step-14--link-employees-in-nexhrms)
- [Part E — Starting & Testing](#part-e--starting--testing)
  - [Step 15 — Start the Bridge](#step-15--start-the-bridge)
  - [Step 16 — Run the Health Check](#step-16--run-the-health-check)
  - [Step 17 — Test Clock-In](#step-17--test-clock-in)
  - [Step 18 — Test Clock-Out](#step-18--test-clock-out)
  - [Step 19 — Verify on Dashboard](#step-19--verify-on-dashboard)
- [Daily Routine](#daily-routine)
- [How Clock-In / Clock-Out Works](#how-clock-in--clock-out-works)
- [Who Sees What on the Dashboard](#who-sees-what-on-the-dashboard)
- [Common Issues & How to Fix Them](#common-issues--how-to-fix-them)
- [Quick Reference Card](#quick-reference-card)
- [AI Assistant Prompt](#ai-assistant-prompt)

---

## What You'll Need

| Item | Notes |
|------|-------|
| ✅ NexHRMS v2 deployed on Vercel | Your live NexHRMS site (e.g. `https://your-app.vercel.app`) |
| ✅ Supabase account | Your database — should already be set up with NexHRMS |
| ✅ FK F80 biometric device | Face and fingerprint scanner |
| ✅ Windows computer at the office | Runs the bridge relay — must stay on during work hours |
| ✅ Same WiFi for device and computer | They communicate over the local network |
| ✅ Internet on the computer | The bridge sends data to Vercel over the internet |

---

## How It Works

```
Employee scans face or finger on device at the office
        ↓
Device sends data to the office computer (over WiFi)
        ↓
A small relay program (bridge) on the computer receives it
        ↓
The bridge sends it to your Vercel site (over the internet)
        ↓
Vercel records the attendance in the database
        ↓
Anyone can view attendance from any browser, anywhere
```

> 💡 **Why is the bridge needed?** The F80 device can only send data to computers on the same WiFi network. It can't reach Vercel directly. The bridge is the middleman — it receives data locally and forwards it to the cloud.

---

## Local vs Vercel — What's Different?

| | Local Setup | Vercel Setup |
|---|---|---|
| NexHRMS runs on | Your office computer | Vercel (always online) |
| Dashboard access | Only from the office | From any device, anywhere |
| Need to run `npm run dev`? | ✅ Yes | ❌ No |
| Need to run the bridge? | ✅ Yes | ✅ Yes |
| Internet required? | Only for database | For bridge → Vercel + database |
| Security key needed? | No | ✅ Yes (protects the public endpoint) |

---

# Part A — Vercel & Database Setup (One-Time)

---

## Step 1 — Verify NexHRMS is Deployed on Vercel

1. Open your Vercel site in a browser (e.g. `https://your-app.vercel.app`)
2. You should see the NexHRMS login page
3. Log in as admin to make sure everything works

If NexHRMS isn't deployed yet, follow the standard Vercel deployment guide first, then come back here.

### Check Vercel Environment Variables

Go to **Vercel Dashboard → your project → Settings → Environment Variables** and make sure these exist:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key for Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key — the biometric API uses this to write attendance |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` is critical. Without it, the biometric API can't save attendance data.

---

## Step 2 — Apply Database Migrations

The database needs specific tables and columns for biometric attendance. If they aren't already applied:

1. Go to your **Supabase Dashboard** → select your project
2. Open **SQL Editor**
3. Run these migration files from the `supabase/migrations/` folder in your project, **in order**:

| Order | File | What it does |
|-------|------|-------------|
| 1 | `024_add_employee_biometric_id.sql` | Adds the Biometric ID field to employees |
| 2 | `027_biometric_integration.sql` | Creates biometric tables and attendance method columns |
| 3 | `028_biometric_palm_and_exception_flags.sql` | Adds palm scan support and expands allowed methods |

Open each file, copy its contents, paste into the SQL Editor, and click **Run**.

> 💡 Already ran all migrations? These are safe to re-run — they use `IF NOT EXISTS` checks.

4. After running the migrations, refresh the database cache:

```sql
NOTIFY pgrst, 'reload schema';
```

---

## Step 3 — Generate a Security Key

Since your NexHRMS site is publicly accessible on Vercel, you need to protect the attendance endpoint with a secret key. Only your office bridge will know this key.

On any computer with Node.js installed, open a terminal and run:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This outputs a long random string like:
```
a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

**Copy and save this key** — you'll need it in two places (Vercel and the office computer).

---

## Step 4 — Add the Key to Vercel

1. Go to **Vercel Dashboard → your project → Settings → Environment Variables**
2. Add a new variable:

| Key | Value | Environment |
|-----|-------|-------------|
| `KIOSK_API_KEY` | *Paste the key from Step 3* | Production |

3. Click **Save**
4. **Redeploy:** Go to Deployments → click the latest → **Redeploy**

> ⚠️ **You must redeploy** after adding the environment variable. Vercel won't use the new key until it's redeployed.

---

## Step 5 — Verify Vercel Health Check

After redeployment, open this URL in your browser:

```
https://your-app.vercel.app/api/attendance/t800
```

**You should see:**

```json
{
  "ok": true,
  "endpoint": "/api/attendance/t800",
  "requestCode": "realtime_glog",
  "allowedDeviceIds": "any",
  "mappedEmployeeCount": 0,
  "latestDeviceEvent": null
}
```

### What to look for:

| Field | Good value | Meaning |
|-------|-----------|---------|
| `ok` | `true` | The API endpoint is working and can reach the database |
| `mappedEmployeeCount` | `0` (for now) | No employees have Biometric IDs yet — that's expected at this stage |
| `latestDeviceEvent` | `null` | No scans yet — also expected |

### If something is wrong:

| Problem | Likely cause |
|---------|-------------|
| Page won't load or shows 500 error | Vercel env vars missing (`SUPABASE_SERVICE_ROLE_KEY`) |
| `"ok": false` | Database connection failed — check Supabase credentials |
| 404 error | NexHRMS may not include the t800 route — check deployment |

---

# Part B — Office Computer Setup (One-Time)

This is the computer at the office that will run the bridge. It must be on the same WiFi network as the F80 device.

---

## Step 6 — Install Node.js

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS version**
3. Install with default settings
4. Verify in PowerShell:

```
node --version
```

You should see `v20.x.x` or higher.

---

## Step 7 — Download the Project

```
cd c:\xampp\htdocs\Github
git clone https://github.com/nexvisionph/NexHRMS-v2.git
cd NexHRMS-v2
```

Or if you already have it:

```
cd c:\xampp\htdocs\Github\NexHRMS-v2
git pull
```

---

## Step 8 — Install Dependencies

```
cd c:\xampp\htdocs\Github\NexHRMS-v2
npm install
```

---

## Step 9 — Configure the Bridge

The bridge needs to know where to send data (your Vercel site) and the security key.

1. Open the `.env` file in the project root folder
2. Add these lines:

```env
# ─── Bridge → Vercel ──────────────────────────────────────────
T800_BRIDGE_TARGET_URL=https://your-app.vercel.app/api/attendance/t800
KIOSK_API_KEY=paste-your-security-key-here
```

> 📝 Replace `your-app.vercel.app` with your actual Vercel domain.
> 📝 The `KIOSK_API_KEY` must be the **exact same key** you added to Vercel in Step 4.

---

## Step 10 — Set Up Windows Firewall

Allow the F80 device to connect to the bridge:

1. Open **PowerShell as Administrator**
2. Run:

```
netsh advfirewall firewall add rule name="FK Bridge 8080" dir=in action=allow protocol=TCP localport=8080
```

3. You should see **"Ok."**

> 💡 Only needs to be done once.

---

# Part C — Device Setup (One-Time)

---

## Step 11 — Find the Computer's WiFi IP

1. Open **PowerShell** on the office computer
2. Type `ipconfig` and press Enter
3. Find **Wireless LAN adapter Wi-Fi** → **IPv4 Address** (e.g. `192.168.254.111`)

> 📝 Write this down.

---

## Step 12 — Configure the F80 Device

On the FK F80 device:

1. Go to **Menu → Comm**
2. Set these values:

| Setting | What to enter |
|---------|---------------|
| **Mode** | `Internet` |
| **Server** | The computer's WiFi IP (from Step 11) |
| **Port** | `8080` |

3. Save and **restart the device**

> ⚠️ Mode **must** be `Internet`. This is the most common mistake.

---

# Part D — Employee Registration

---

## Step 13 — Enroll Employees on the Device

1. On the F80: **Menu → User → New User**
2. Enter the employee's name
3. Register their **face** and/or **fingerprint**
4. Note the **User ID** the device assigns

Keep a record:

| Employee | Device User ID |
|----------|---------------|
| Jana | 12 |
| EJ | 32 |
| Maria | 36 |

---

## Step 14 — Link Employees in NexHRMS

1. Log in to `https://your-app.vercel.app` as **admin**
2. Go to **Employees** → click an employee → **Edit**
3. Set **Biometric ID** = their device User ID
4. Save
5. Repeat for every enrolled employee

> ⚠️ Must match exactly — no spaces, no leading zeros.

---

# Part E — Starting & Testing

---

## Step 15 — Start the Bridge

On the office computer:

```
cd c:\xampp\htdocs\Github\NexHRMS-v2
npm run biometric:bridge
```

**Verify the output shows:**

```
bridge listening {"port":8080, "target":"https://your-app.vercel.app/api/attendance/t800", ...}
```

✅ Make sure the target shows your **Vercel URL** (not `localhost`).

### Wait for Device Heartbeat

Within 30 seconds, you should see:

```
post request received {..., "requestCode":"receive_cmd", ...}
```

This means the device is connected to the bridge. ✅

> 💡 **You do NOT need to run `npm run dev`** for the Vercel setup. NexHRMS is already running on Vercel. Only the bridge needs to run locally.

---

## Step 16 — Run the Health Check

### Check from the website

Open in any browser:

```
https://your-app.vercel.app/api/attendance/t800
```

**You should see:**

```json
{
  "ok": true,
  "endpoint": "/api/attendance/t800",
  "mappedEmployeeCount": 3,
  "latestDeviceEvent": null
}
```

| Field | What to check |
|-------|--------------|
| `ok` is `true` | ✅ API is working |
| `mappedEmployeeCount` matches your enrolled employees | ✅ Employees are linked |
| `latestDeviceEvent` is `null` | Normal — no scans yet |

### Check from the bridge terminal

You should see `receive_cmd` heartbeats every ~30 seconds. This confirms the device → bridge connection is alive.

### Complete Health Check Checklist

| Check | Status |
|-------|--------|
| Vercel site loads and login works | ✅ or ❌ |
| Health check URL returns `"ok": true` | ✅ or ❌ |
| `mappedEmployeeCount` > 0 | ✅ or ❌ |
| Bridge shows Vercel URL as target | ✅ or ❌ |
| Device heartbeat (`receive_cmd`) appearing | ✅ or ❌ |

If all five are ✅, you're ready to test.

---

## Step 17 — Test Clock-In

1. Have an enrolled employee scan on the F80 device
2. Device says **"Verified"**
3. Bridge terminal shows:

```
forwarded {"payload":{...,"biometricId":"12"},"status":200,"responseCode":"OK"}
```

4. Open `https://your-app.vercel.app` → **Attendance** page
5. Employee appears as **Present** with a check-in time

---

## Step 18 — Test Clock-Out

1. Same employee scans again
2. Bridge shows another `forwarded` with `status: 200`
3. Attendance page now shows:
   - ✅ Check-in time
   - ✅ Check-out time
   - ✅ Hours worked

---

## Step 19 — Verify on Dashboard

1. Go to **Dashboard** page
2. Admin/HR dashboard shows updated Present/Absent counts
3. Employee dashboard shows personal clock-in/out

Run the health check one more time:

```
https://your-app.vercel.app/api/attendance/t800
```

`latestDeviceEvent` should now show the scan you just did. ✅

---

## Daily Routine

Each work day:

1. **Turn on the office computer** — connect to WiFi and make sure it has internet
2. **Start the bridge:**
   ```
   cd c:\xampp\htdocs\Github\NexHRMS-v2
   npm run biometric:bridge
   ```
3. **Wait for device heartbeat** (`receive_cmd` in terminal)
4. ✅ **System is ready** — employees can scan

**To stop:** Press `Ctrl+C` in the bridge terminal.

> 💡 **Pro tip:** Ask your IT team to set up the bridge to start automatically when the computer turns on using Windows Task Scheduler.

---

## How Clock-In / Clock-Out Works

| Scan | Result |
|------|--------|
| First scan of the day | **Clock in** — records arrival time |
| Second scan of the day | **Clock out** — records departure time, calculates hours |
| Any scan after that | **Ignored** — one pair per day |

### Same-Method Rule

If an employee clocks in via the biometric device, they must also clock out via the device. They can't mix methods — unless an admin manually overrides.

---

## Who Sees What on the Dashboard

| Role | What they see |
|------|--------------|
| **Admin** | All employees' attendance, company stats, charts |
| **HR** | Same as Admin |
| **Supervisor** | Their team's attendance |
| **Employee** | Only their own clock-in, clock-out, and hours |

---

## Common Issues & How to Fix Them

### "No heartbeat — device isn't connecting to the bridge"

| Check | Fix |
|-------|-----|
| Same WiFi? | Device and computer must be on the same network |
| Device Mode = Internet? | Comm → Mode → must be `Internet` |
| Device Server IP matches computer? | Run `ipconfig` to check current IP, update device if it changed |
| Firewall rule exists? | Run the firewall command from Step 10 |

### "Bridge shows 'forward rejected' or error codes"

| Error | Meaning | Fix |
|-------|---------|-----|
| `ERROR_UNAUTHORIZED` | Security key mismatch | Make sure `KIOSK_API_KEY` is **identical** in `.env` and Vercel. Redeploy Vercel after adding it |
| `ERROR_LOG_UPSERT` | Database rejected the data | Run migrations 027 + 028, then `NOTIFY pgrst, 'reload schema';` |
| `Unmapped biometric ID` | Employee not linked | Set their Biometric ID in NexHRMS (Step 14) |
| `ERROR_EMPLOYEE_LOOKUP` | Database connection issue | Check Supabase env vars on Vercel |

### "Bridge target shows localhost instead of Vercel"

1. Check that `T800_BRIDGE_TARGET_URL` is in your `.env` file
2. Make sure there are no typos in the URL
3. Restart the bridge

### "It worked yesterday but not today"

WiFi IP probably changed:

1. Run `ipconfig` to find the new IP
2. Update the device: Comm → Server → new IP
3. Restart the device

> 💡 Set a **static IP** on the bridge computer to prevent this.

### "Column not found in schema cache"

1. Supabase Dashboard → SQL Editor
2. Run: `NOTIFY pgrst, 'reload schema';`

### "Health check shows ok: false"

Check Vercel environment variables — especially `SUPABASE_SERVICE_ROLE_KEY`. Redeploy after fixing.

---

## Quick Reference Card

| Item | Value |
|------|-------|
| Your NexHRMS site | `https://your-app.vercel.app` |
| Health Check URL | `https://your-app.vercel.app/api/attendance/t800` |
| Device mode | `Internet` |
| Device port | `8080` |
| Start bridge | `npm run biometric:bridge` |
| Where to set Biometric ID | Employees → Edit → Biometric ID |
| Vercel env vars needed | `KIOSK_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Local `.env` vars needed | `T800_BRIDGE_TARGET_URL`, `KIOSK_API_KEY` |
| Required migrations | 024, 027, 028 |
| Schema cache refresh | `NOTIFY pgrst, 'reload schema';` |

---

## AI Assistant Prompt

If you need further help, paste the following into any AI assistant (ChatGPT, Claude, Gemini, etc.) for context-aware troubleshooting:

---

```
I am running NexHRMS v2 deployed on Vercel with an FK F80 biometric device for employee attendance tracking.

Here is my setup:
- NexHRMS is deployed on Vercel at: https://your-app.vercel.app
- The database is on Supabase (shared between all environments)
- An FK F80 biometric device (face + fingerprint) is at the office
- A Windows computer at the office runs a Node.js bridge script (fk-bridge.js) on port 8080
- The device pushes scan data to the bridge over the local WiFi network
- The bridge forwards the data over the internet to Vercel at /api/attendance/t800
- The API authenticates using a KIOSK_API_KEY sent as an X-Kiosk-Api-Key header
- The API looks up the employee by biometric_id in Supabase "employees" table
- If found, it creates an attendance_event (IN or OUT) and upserts an attendance_log

The network chain is:
F80 Device --(WiFi, port 8080)--> Bridge Computer --(HTTPS, internet)--> Vercel --(API)--> Supabase

Clock-in = first scan of the day. Clock-out = second scan. Third+ scans are ignored.

The F80 device sends binary payloads with a 4-byte little-endian length header before the JSON.
The JSON for attendance scans looks like:
{"fk_bin_data_lib":"FKDataHS101","io_mode":1,"io_time":"20260520141206","log_image":null,"user_id":"12","verify_mode":20}

The bridge normalizes and forwards as:
{"request_code":"realtime_glog","user_id":"12","io_time":"20260520141206","io_mode":"1","dev_id":"2603161831","deviceId":"2603161831","biometricId":"12"}

Database tables:
- employees: has biometric_id column mapped to device User ID
- attendance_logs: date, check_in, check_out, check_in_method, check_out_method, hours, status
- attendance_events: employee_id, event_type (IN/OUT), timestamp_utc, device_id

Allowed method values: fingerprint, face, palm, rfid, pin, manual

Health check endpoint: GET /api/attendance/t800 — returns JSON with ok, mappedEmployeeCount, latestDeviceEvent.

Required Supabase migrations: 024_add_employee_biometric_id.sql, 027_biometric_integration.sql, 028_biometric_palm_and_exception_flags.sql

Environment variables:
- On Vercel: KIOSK_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- On bridge computer (.env): T800_BRIDGE_TARGET_URL (Vercel URL), KIOSK_API_KEY (same key as Vercel)

The device heartbeats with "receive_cmd" every ~30 seconds when connected.

Please help me with: [DESCRIBE YOUR ISSUE HERE]
```

---

> 💡 Replace `[DESCRIBE YOUR ISSUE HERE]` with your specific question, such as:
> - "The bridge shows ERROR_UNAUTHORIZED when forwarding scans"
> - "The health check returns ok: false"
> - "How do I add a new employee to the biometric system"
> - "The device was connecting yesterday but not today"
> - "How do I move the bridge to a different computer"
> - "How do I set up the bridge to start automatically on boot"
