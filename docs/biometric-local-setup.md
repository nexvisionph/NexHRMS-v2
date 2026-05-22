# NexHRMS — Biometric Attendance Setup (Local / Office Network)

> **Who is this guide for?**
> Office administrators, IT staff, or anyone setting up the FK F80 biometric device with NexHRMS for the first time on a local office network. Follow this guide from top to bottom — it covers everything from installing software to verifying your first scan.

---

## Table of Contents

- [What You'll Need](#what-youll-need)
- [How It Works](#how-it-works)
- [Part A — Software Setup (One-Time)](#part-a--software-setup-one-time)
  - [Step 1 — Install Node.js](#step-1--install-nodejs)
  - [Step 2 — Download the Project](#step-2--download-the-project)
  - [Step 3 — Install Dependencies](#step-3--install-dependencies)
  - [Step 4 — Set Up Environment Variables](#step-4--set-up-environment-variables)
  - [Step 5 — Set Up the Database](#step-5--set-up-the-database)
- [Part B — Device Setup (One-Time)](#part-b--device-setup-one-time)
  - [Step 6 — Find Your Computer's IP Address](#step-6--find-your-computers-ip-address)
  - [Step 7 — Configure the F80 Device](#step-7--configure-the-f80-device)
  - [Step 8 — Allow the Connection Through Firewall](#step-8--allow-the-connection-through-firewall)
- [Part C — Employee Registration](#part-c--employee-registration)
  - [Step 9 — Enroll Employees on the Device](#step-9--enroll-employees-on-the-device)
  - [Step 10 — Link Employees in NexHRMS](#step-10--link-employees-in-nexhrms)
- [Part D — Starting the System](#part-d--starting-the-system)
  - [Step 11 — Start NexHRMS and the Bridge](#step-11--start-nexhrms-and-the-bridge)
  - [Step 12 — Health Check](#step-12--health-check)
- [Part E — Testing](#part-e--testing)
  - [Step 13 — Test Clock-In](#step-13--test-clock-in)
  - [Step 14 — Test Clock-Out](#step-14--test-clock-out)
  - [Step 15 — Verify on Dashboard](#step-15--verify-on-dashboard)
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
| ✅ FK F80 biometric device | Face and fingerprint scanner |
| ✅ Windows laptop or desktop | Acts as the server — stays on during work hours |
| ✅ Same WiFi network | Device and computer must be on the same network |
| ✅ Supabase account | Free tier works — this is your database |
| ✅ Internet connection | Only needed for initial setup and database access |

---

## How It Works

```
Employee scans face or finger on device
        ↓
Device sends data to your computer (over office WiFi)
        ↓
A small program (bridge) on your computer receives it
        ↓
The bridge passes it to NexHRMS running on the same computer
        ↓
NexHRMS records the attendance in the database
        ↓
The dashboard updates with clock-in/out data
```

Everything stays on your office network — the only internet usage is for the database (Supabase).

---

# Part A — Software Setup (One-Time)

These steps only need to be done once when setting up a new computer.

---

## Step 1 — Install Node.js

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS version** (recommended for most users)
3. Run the installer — accept all defaults
4. After installation, open **PowerShell** and verify:

```
node --version
```

You should see something like `v20.x.x` or higher.

---

## Step 2 — Download the Project

If you don't have the NexHRMS project on the computer yet:

```
cd c:\xampp\htdocs\Github
git clone https://github.com/nexvisionph/NexHRMS-v2.git
cd NexHRMS-v2
```

If you already have it, make sure you have the latest version:

```
cd c:\xampp\htdocs\Github\NexHRMS-v2
git pull
```

---

## Step 3 — Install Dependencies

```
cd c:\xampp\htdocs\Github\NexHRMS-v2
npm install
```

This downloads all the packages NexHRMS needs. It may take a few minutes the first time.

---

## Step 4 — Set Up Environment Variables

NexHRMS needs to know how to connect to your database. Create a file called `.env` in the project root folder.

1. In the project folder, look for `.env.example` — if it exists, copy it as `.env`
2. Open `.env` in a text editor (Notepad, VS Code, etc.)
3. Fill in these values:

```env
# ─── Supabase (your database) ──────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

> 💡 **Where to find these values:** Log in to [supabase.com](https://supabase.com) → select your project → go to **Settings → API**. You'll see the URL, anon key, and service role key there.

---

## Step 5 — Set Up the Database

The database needs specific tables for biometric attendance to work. These are added through migration files.

1. Log in to your **Supabase Dashboard** → select your project
2. Go to **SQL Editor**
3. You need to run the following migration files **in order**. Open each file from the `supabase/migrations/` folder in the project, copy its contents, paste into the SQL Editor, and click **Run**:

| Order | File | What it does |
|-------|------|-------------|
| 1 | `024_add_employee_biometric_id.sql` | Adds the Biometric ID field to employees |
| 2 | `027_biometric_integration.sql` | Creates biometric tables and attendance method columns |
| 3 | `028_biometric_palm_and_exception_flags.sql` | Adds palm scan support and expands allowed methods |

> ⚠️ If you've already run all migrations for NexHRMS, these may already be applied. Running them again won't cause errors — they use `IF NOT EXISTS` checks.

After running the migrations, refresh the schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

---

# Part B — Device Setup (One-Time)

---

## Step 6 — Find Your Computer's IP Address

1. Open **PowerShell** on your computer
2. Type `ipconfig` and press Enter
3. Look for **Wireless LAN adapter Wi-Fi**
4. Note the **IPv4 Address** (e.g. `192.168.254.111`)

```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . . : 192.168.254.111  ← this one
```

> 📝 Write this IP address down — you'll enter it into the device next.

---

## Step 7 — Configure the F80 Device

On the FK F80 device:

1. Press the **Menu** button
2. Navigate to **Comm** (Communication settings)
3. Set these values:

| Setting | What to enter |
|---------|---------------|
| **Mode** | `Internet` |
| **Server** | Your computer's IP address (from Step 6) |
| **Port** | `8080` |

4. Save the settings
5. **Restart the device** (power off, wait 5 seconds, power on)

> ⚠️ **Mode MUST be "Internet"**. If it's set to `Local`, the device will not send data. This is the most common setup mistake.

---

## Step 8 — Allow the Connection Through Firewall

Windows may block the device from connecting to your computer. Create a firewall rule to allow it:

1. Open **PowerShell as Administrator** (right-click → Run as Administrator)
2. Run this command:

```
netsh advfirewall firewall add rule name="FK Bridge 8080" dir=in action=allow protocol=TCP localport=8080
```

3. You should see **"Ok."**

> 💡 This only needs to be done once. The rule survives computer restarts.

### Verify the rule exists:

```
netsh advfirewall firewall show rule name="FK Bridge 8080"
```

---

# Part C — Employee Registration

---

## Step 9 — Enroll Employees on the Device

Each employee who will use biometric attendance needs to be registered on the F80:

1. On the device: **Menu → User → New User**
2. Enter the employee's name
3. Follow the screen instructions to register their **face** and/or **fingerprint**
4. The device assigns a **User ID** (a number like `1`, `12`, `36`)

> 📝 **Keep a list!** Write down every employee's name and their device User ID. You'll need this for the next step.

Example list:

| Employee | Device User ID |
|----------|---------------|
| Jana | 12 |
| EJ | 32 |
| Maria | 36 |

---

## Step 10 — Link Employees in NexHRMS

For each enrolled employee, connect their device User ID to their NexHRMS profile:

1. Open `http://localhost:3000` in your browser (NexHRMS must be running — see Step 11)
2. Log in as **admin**
3. Go to **Employees**
4. Click on an employee's name → **Edit**
5. Find the **Biometric ID** field
6. Enter their **Device User ID** (e.g. `12`)
7. Click **Save**
8. Repeat for every enrolled employee

> ⚠️ The Biometric ID must **exactly match** the User ID on the device. No leading zeros, no spaces, no extra characters.

---

# Part D — Starting the System

---

## Step 11 — Start NexHRMS and the Bridge

You need to run **two programs** in separate terminal windows:

### Terminal 1 — Start NexHRMS

```
cd c:\xampp\htdocs\Github\NexHRMS-v2
npm run dev
```

**Wait until you see:** `✓ Ready - Local: http://localhost:3000`

### Terminal 2 — Start the Bridge

Open a **second** terminal window:

```
cd c:\xampp\htdocs\Github\NexHRMS-v2
npm run biometric:bridge
```

**Wait until you see:**

```
bridge listening {"port":8080, "target":"http://localhost:3000/api/attendance/t800", ...}
```

### Confirm the Device is Connected

Within 30 seconds of starting the bridge, you should see heartbeat messages:

```
post request received {..., "requestCode":"receive_cmd", ...}
```

This means the device is talking to your computer. ✅

If no heartbeat appears after 60 seconds, see [Common Issues](#common-issues--how-to-fix-them).

---

## Step 12 — Health Check

NexHRMS has a built-in health check page that shows if the biometric system is properly configured.

### Check via Browser

Open this URL in your browser:

```
http://localhost:3000/api/attendance/t800
```

**You should see a JSON response like this:**

```json
{
  "ok": true,
  "endpoint": "/api/attendance/t800",
  "requestCode": "realtime_glog",
  "allowedDeviceIds": "any",
  "mappedEmployeeCount": 3,
  "latestDeviceEvent": {
    "id": "EVT-xxxxxxxx",
    "employee_id": "EMP-xxxxx",
    "event_type": "IN",
    "timestamp_utc": "2026-05-20T09:15:32.000Z",
    "device_id": "2603161831"
  }
}
```

### What to look for:

| Field | What it means | Good value |
|-------|--------------|-----------|
| `ok` | Is the endpoint working? | `true` |
| `mappedEmployeeCount` | How many employees have a Biometric ID set | Should match the number of enrolled employees |
| `latestDeviceEvent` | The most recent scan from any device | Shows the last successful scan (null if no scans yet) |
| `allowedDeviceIds` | Which devices are accepted | `"any"` means all devices are accepted |

### If something is wrong:

| Problem | What it means |
|---------|--------------|
| `"ok": false` | Database connection failed — check your Supabase credentials in `.env` |
| `mappedEmployeeCount` is `0` | No employees have Biometric IDs set — go back to Step 10 |
| `latestDeviceEvent` is `null` | No scans recorded yet — this is normal before the first test |
| Page won't load | NexHRMS isn't running — go back to Step 11 |

---

# Part E — Testing

---

## Step 13 — Test Clock-In

1. Have an enrolled employee scan their face or finger on the F80 device
2. The device screen should say **"Verified"**
3. Check the **bridge terminal** — you should see:

```
forwarded {"payload":{...,"biometricId":"12"},"status":200,"responseCode":"OK"}
```

4. Open `http://localhost:3000` → go to **Attendance** page
5. The employee should appear as **Present** with a clock-in time

> ✅ If you see `forwarded` with `status: 200` — it's working!

---

## Step 14 — Test Clock-Out

1. Have the **same employee** scan again on the device
2. Device says **"Verified"** again
3. Check the bridge terminal — another `forwarded` message with `status: 200`
4. Check the **Attendance** page — now the employee should show both:
   - **Check-in time**
   - **Check-out time**
   - **Hours worked** (calculated automatically)

---

## Step 15 — Verify on Dashboard

1. Go to the **Dashboard** page in NexHRMS
2. **As Admin/HR:** The KPI cards should show updated Present/Absent counts
3. **As Employee:** The personal dashboard shows your own clock-in/out status

> 💡 If the dashboard doesn't show the latest data, try switching to another browser tab and switching back. This triggers a data refresh.

### Run the Health Check Again

Visit `http://localhost:3000/api/attendance/t800` again:

- `latestDeviceEvent` should now show the scan you just did
- `mappedEmployeeCount` should match your enrolled employees

---

## Daily Routine

Every work day, someone at the office needs to:

1. **Turn on the computer** and connect to the office WiFi
2. **Open two terminals** and run:
   - Terminal 1: `npm run dev` (starts NexHRMS)
   - Terminal 2: `npm run biometric:bridge` (starts the bridge)
3. **Wait for the heartbeat** — look for `receive_cmd` in the bridge terminal
4. ✅ **System is ready** — employees can start scanning

**To stop at the end of the day:** Press `Ctrl+C` in both terminals.

---

## How Clock-In / Clock-Out Works

| Scan | What happens |
|------|-------------|
| First scan of the day | Records **clock-in** (arrival time) |
| Second scan of the day | Records **clock-out** (departure time) and calculates hours worked |
| Any scan after that | **Ignored** — only one clock-in and one clock-out per day |

> 💡 The system automatically figures out whether a scan is a clock-in or clock-out based on what's already recorded for that day.

### Same-Method Rule

If an employee clocks in using the biometric device, they must also clock out using the biometric device. They can't mix methods (e.g., clock in with biometric, clock out with QR code) — unless an admin manually overrides it.

---

## Who Sees What on the Dashboard

| Role | What they see |
|------|--------------|
| **Admin** | Everyone's attendance, company stats, charts, pending approvals |
| **HR** | Same as Admin |
| **Supervisor** | Their team's attendance |
| **Employee** | Only their own attendance (clock-in, clock-out, hours) |

---

## Common Issues & How to Fix Them

### "I scanned but nothing appears in the bridge terminal"

| Check | Fix |
|-------|-----|
| Is the bridge running? | You should see `bridge listening` in the terminal |
| Is the device heartbeat showing? | Wait 30-60 seconds for `receive_cmd` to appear |
| Same WiFi network? | Device and computer must be on the **same** network (same IP range) |
| Device Mode set to Internet? | On device: Comm → Mode → must be `Internet`, not `Local` |
| Device Server IP correct? | On device: Comm → Server → must match your computer's current WiFi IP |
| Firewall blocking? | Run the firewall command from Step 8 |

### "Bridge says 'forwarded' but with an error"

| Error | Meaning | Fix |
|-------|---------|-----|
| `ERROR_LOG_UPSERT` | Database rejected the check-in data | Make sure migrations 027 + 028 are applied |
| `ERROR_LOG_UPDATE` | Database rejected the check-out data | Same as above — run `NOTIFY pgrst, 'reload schema';` |
| `Unmapped biometric ID: XX` | No employee has Biometric ID = XX | Go to Employees → Edit → set the Biometric ID |
| `ERROR_EMPLOYEE_LOOKUP` | Can't connect to database | Check Supabase credentials in `.env` |

### "It was working yesterday but not today"

Your computer's WiFi IP address probably changed:

1. Run `ipconfig` to find the new IP
2. On the F80 device: Comm → Server → enter the new IP
3. Restart the device
4. Wait for `receive_cmd` heartbeat

> 💡 **Pro tip:** Ask your IT team to set a **static IP** on the bridge computer so the address never changes.

### "Health check shows ok but mappedEmployeeCount is 0"

No employees have their Biometric ID set. Go to **Employees → Edit** and set the Biometric ID for each enrolled employee (Step 10).

### "Column not found in schema cache"

1. Go to **Supabase Dashboard → SQL Editor**
2. Run: `NOTIFY pgrst, 'reload schema';`
3. Try scanning again

---

## Quick Reference Card

| Item | Value |
|------|-------|
| NexHRMS URL | `http://localhost:3000` |
| Health Check URL | `http://localhost:3000/api/attendance/t800` |
| Device mode | `Internet` |
| Device port | `8080` |
| Start NexHRMS | `npm run dev` |
| Start Bridge | `npm run biometric:bridge` |
| Where to set Biometric ID | Employees → Edit → Biometric ID field |
| Firewall rule | `netsh advfirewall firewall add rule name="FK Bridge 8080" dir=in action=allow protocol=TCP localport=8080` |
| Required migrations | 024, 027, 028 |
| Schema cache refresh | `NOTIFY pgrst, 'reload schema';` |

---

## AI Assistant Prompt

If you need further help, paste the following into any AI assistant (ChatGPT, Claude, Gemini, etc.) for context-aware troubleshooting:

---

```
I am setting up an FK F80 biometric device (face + fingerprint scanner) to work with NexHRMS v2, a Next.js HR management system.

Here is my current setup:
- The F80 device communicates using the FK HTTP Push protocol (Mode: Internet)
- A Node.js bridge script (fk-bridge.js) runs on a local computer on port 8080
- The device pushes scan data to the bridge over the local WiFi network
- The bridge forwards the data to the NexHRMS API at /api/attendance/t800
- The API looks up the employee by biometric_id in the Supabase "employees" table
- If found, it creates an attendance_event (IN or OUT) and upserts an attendance_log
- Clock-in = first scan of the day, Clock-out = second scan of the day

The F80 device sends binary payloads with a 4-byte little-endian length header before the JSON data. The JSON structure for attendance scans (realtime_glog) looks like:
{"fk_bin_data_lib":"FKDataHS101","io_mode":1,"io_time":"20260520141206","log_image":null,"user_id":"12","verify_mode":20}

The bridge extracts user_id and io_time, then forwards to the API as:
{"request_code":"realtime_glog","user_id":"12","io_time":"20260520141206","io_mode":"1","dev_id":"2603161831","deviceId":"2603161831","biometricId":"12"}

Database tables involved:
- employees (has biometric_id column mapped to device User ID)
- attendance_logs (date, check_in, check_out, check_in_method, check_out_method, hours, status)
- attendance_events (employee_id, event_type IN/OUT, timestamp_utc, device_id)

Allowed check_in_method / check_out_method values: fingerprint, face, palm, rfid, pin, manual

The device heartbeats with "receive_cmd" every ~30 seconds when connected.
Enrollment data comes as "realtime_enroll_data" (multi-block binary with face photos and fingerprint templates).

Health check endpoint: GET /api/attendance/t800 — returns JSON with ok, mappedEmployeeCount, latestDeviceEvent.

Required Supabase migrations: 024_add_employee_biometric_id.sql, 027_biometric_integration.sql, 028_biometric_palm_and_exception_flags.sql

My current setup is LOCAL (bridge forwards to http://localhost:3000/api/attendance/t800).
Both the device and the bridge computer are on the same WiFi network.

Please help me with: [DESCRIBE YOUR ISSUE HERE]
```

---

> 💡 Replace `[DESCRIBE YOUR ISSUE HERE]` with your specific question or problem, such as:
> - "The device is not connecting to the bridge"
> - "Scans are being forwarded but attendance doesn't show up"
> - "The health check shows mappedEmployeeCount: 0"
> - "How do I add a new employee to the biometric system"
> - "How do I reset an employee's attendance for today"
