# NexHRMS — Biometric Attendance Setup (Vercel / Cloud Deployment)

> **Who is this guide for?**
> Office administrators or IT staff who have NexHRMS deployed on Vercel and want to connect the FK F80 biometric device to the cloud system. Employees scan at the office, and attendance data flows to your Vercel-hosted NexHRMS — accessible from anywhere.

---

## What You'll Need

Before you start, make sure you have the following:

- ✅ **NexHRMS v2 deployed on Vercel** (e.g. `https://your-app.vercel.app`)
- ✅ **Supabase database** with biometric migrations applied (migrations 027 and 028)
- ✅ An **FK F80 biometric device** (face and fingerprint scanner)
- ✅ A **Windows computer at the office** that stays on during work hours (this runs the bridge)
- ✅ The office computer and the device connected to the **same WiFi network**
- ✅ The office computer has **internet access** (to reach Vercel)
- ✅ **Node.js** and the **NexHRMS v2 repo** on the office computer

---

## How It Works

```
Employee scans on device at the office
        ↓
Device sends data to the office computer (over WiFi)
        ↓
A small relay program (bridge) on the computer receives it
        ↓
The bridge sends it to your Vercel site (over the internet)
        ↓
Vercel records the attendance in Supabase
        ↓
Anyone can see the results on the NexHRMS dashboard from any browser
```

> 💡 **Key concept:** The device can only talk to computers on the same WiFi network. It can't reach Vercel directly. That's why we need the bridge — it's the middleman between the local device and the cloud.

### Why Not Just Use Local?

| | Local Setup | Vercel Setup |
|---|---|---|
| Dashboard access | Only from the office computer | From any device, anywhere |
| NexHRMS runs on | The office computer (`npm run dev`) | Vercel (always online) |
| Need `npm run dev`? | Yes | No |
| Internet required? | No | Yes (for the bridge to reach Vercel) |
| Bridge still needed? | Yes | Yes |

---

## Step 1 — Set Up Security (API Key)

Since your NexHRMS is now publicly accessible on Vercel, you need to protect the attendance endpoint with a secret key. Only the bridge will know this key.

### Generate a Secret Key

On any computer with Node.js, open a terminal and run:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This will output a long random string like:
```
a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

**Copy this key and save it somewhere safe** — you'll need it in two places.

### Add the Key to Vercel

1. Go to your **Vercel Dashboard** → select your NexHRMS project
2. Click **Settings** → **Environment Variables**
3. Add a new variable:

| Key | Value |
|-----|-------|
| `KIOSK_API_KEY` | *Paste the key you generated* |

4. Make sure it's set for **Production** environment
5. Click **Save**
6. Go to **Deployments** → click the latest deployment → **Redeploy**

> ⚠️ You **must redeploy** after adding the environment variable, otherwise Vercel won't know about it.

---

## Step 2 — Configure the Office Computer

The office computer needs to know two things: where to send the data (Vercel) and the secret key.

### Edit the Environment File

Open the file `.env` in your NexHRMS project folder and add these lines:

```
T800_BRIDGE_TARGET_URL=https://your-app.vercel.app/api/attendance/t800
KIOSK_API_KEY=paste-your-secret-key-here
```

> 📝 Replace `your-app.vercel.app` with your actual Vercel domain.
> 📝 Replace `paste-your-secret-key-here` with the **same key** you added to Vercel in Step 1.

---

## Step 3 — Find the Computer's WiFi IP

You need to know the office computer's WiFi address so the device knows where to send scans.

1. Open **PowerShell** on the office computer
2. Type `ipconfig` and press Enter
3. Look for **Wireless LAN adapter Wi-Fi**
4. Note the **IPv4 Address** (e.g. `192.168.254.111`)

> 💡 Write this down — you'll enter it into the device next.

---

## Step 4 — Configure the Device

On the FK F80 device:

1. Go to **Menu → Comm** (Communication settings)
2. Set the following:

| Setting | What to enter |
|---------|---------------|
| **Mode** | `Internet` |
| **Server** | The office computer's WiFi IP (from Step 3) |
| **Port** | `8080` |

3. Save and **restart the device**

> ⚠️ Mode **must** be `Internet`. If it's `Local`, the device won't send any data.

---

## Step 5 — Allow the Connection Through Firewall

Windows may block the device from connecting. Create a firewall rule:

1. Open **PowerShell as Administrator** on the office computer
2. Run:

```
netsh advfirewall firewall add rule name="FK Bridge 8080" dir=in action=allow protocol=TCP localport=8080
```

3. You should see **"Ok."**

> 💡 This only needs to be done once.

---

## Step 6 — Enroll Employees on the Device

Register each employee on the F80 device:

1. On the device: **Menu → User → New User**
2. Enter the employee's name
3. Register their **face** and/or **fingerprint**
4. Note the **User ID** the device assigns (e.g. `12`, `32`)

> 📝 Write down every employee's User ID — you'll link them in NexHRMS next.

---

## Step 7 — Link Employees in NexHRMS

Connect each device User ID to the employee's NexHRMS profile:

1. Log in to your NexHRMS site (`https://your-app.vercel.app`) as an **admin**
2. Go to **Employees**
3. Click an employee's name → **Edit**
4. Find **Biometric ID** and enter their device User ID (e.g. `12`)
5. Click **Save**
6. Repeat for every enrolled employee

> ⚠️ The Biometric ID must **exactly match** the User ID on the device.

---

## Step 8 — Start the Bridge

On the office computer, open a terminal:

```
cd c:\xampp\htdocs\Github\NexHRMS-v2
npm run biometric:bridge
```

**You should see:**
```
bridge listening {"port":8080, "target":"https://your-app.vercel.app/api/attendance/t800", ...}
```

Make sure the target shows your **Vercel URL** (not `localhost`).

### Confirm the Device is Connected

Within 30 seconds, you should see:
```
post request received {..., "requestCode":"receive_cmd", ...}
```

This heartbeat means the device is talking to the bridge. ✅

> 💡 **Note:** Unlike the local setup, you do **not** need to run `npm run dev`. Only the bridge needs to run. NexHRMS is already running on Vercel.

---

## Step 9 — Test It Out

### Clock In (First Scan)

1. Have an employee scan on the F80 device
2. Device says **"Verified"**
3. Bridge terminal shows `forwarded` with `status: 200`
4. Open NexHRMS in any browser → **Attendance** → employee shows **Present** with a clock-in time

### Clock Out (Second Scan)

1. Same employee scans again later
2. Attendance page now shows **check-out time** and **hours worked**

### How Clock-In vs Clock-Out Works

| Scan | Result |
|------|--------|
| First scan of the day | **Clock in** — records arrival time |
| Second scan of the day | **Clock out** — records departure time and calculates hours |
| Any additional scans | Ignored — only one pair per day |

---

## Daily Routine

Each work day, someone at the office needs to:

1. Make sure the **office computer** is on and connected to WiFi + internet
2. Open a terminal and run:
   ```
   cd c:\xampp\htdocs\Github\NexHRMS-v2
   npm run biometric:bridge
   ```
3. Wait for the device heartbeat (`receive_cmd`) to appear
4. ✅ Ready — employees can start scanning

To stop at the end of the day: press `Ctrl+C` in the terminal.

> 💡 **Pro tip:** You can set the bridge to start automatically when the computer turns on using Windows Task Scheduler. Ask your IT team to set this up.

---

## Common Issues & How to Fix Them

### "Scans aren't showing up at all"

| Check this | How to fix |
|------------|-----------|
| Is the bridge running? | You should see `bridge listening` with the Vercel URL |
| Is the device heartbeat showing? | Wait 30 seconds for `receive_cmd` |
| Are device and computer on the same WiFi? | Both must be on the same network |
| Does the computer have internet? | The bridge needs internet to reach Vercel |
| Is Mode set to Internet on the device? | Comm → Mode → `Internet` |
| Is the Server IP correct? | Must match the computer's current WiFi IP |
| Is the firewall rule set? | Run the firewall command from Step 5 |

### "Bridge says 'forwarded' but with an error code"

| Error | What it means | How to fix |
|-------|--------------|-----------|
| `ERROR_UNAUTHORIZED` | The secret key doesn't match | Make sure `KIOSK_API_KEY` is identical in both your `.env` file and Vercel environment variables. Redeploy Vercel after adding it |
| `ERROR_LOG_UPSERT` | Database rejected the data | Make sure Supabase migrations 027 and 028 are applied |
| `Unmapped biometric ID` | Employee not linked | Go to Employees → Edit → set the Biometric ID |

### "It worked yesterday but not today"

Your computer's WiFi IP may have changed overnight. Check:

1. Run `ipconfig` to find the new IP
2. Update the device: Comm → Server → enter the new IP
3. Restart the device

> 💡 Ask your IT team to assign a **static IP** to the bridge computer so it never changes.

### "Column not found in schema cache"

This happens when the database structure was recently updated:

1. Go to **Supabase Dashboard → SQL Editor**
2. Run: `NOTIFY pgrst, 'reload schema';`
3. Try scanning again

### "Bridge target shows localhost instead of Vercel"

The environment variable isn't being loaded:

1. Check that `T800_BRIDGE_TARGET_URL` is in your `.env` file (not `.env.local`)
2. Make sure there are no typos
3. Restart the bridge

---

## Who Can See What

| Role | What they see on the Dashboard |
|------|-------------------------------|
| **Admin** | Everyone's attendance, company-wide stats, charts, pending approvals |
| **HR** | Same as Admin |
| **Supervisor** | Their team's attendance |
| **Employee** | Only their own attendance (clock-in time, clock-out time, hours today) |

Attendance data refreshes when you switch browser tabs or reload the page.

---

## Quick Reference

| Item | Value |
|------|-------|
| Your NexHRMS site | `https://your-app.vercel.app` |
| Device mode | `Internet` |
| Device port | `8080` |
| Bridge command | `npm run biometric:bridge` |
| Where to set Biometric ID | Employees → Edit → Biometric ID |
| Vercel env vars needed | `KIOSK_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Local `.env` vars needed | `T800_BRIDGE_TARGET_URL`, `KIOSK_API_KEY` |

---

## AI Assistant Prompt

If you run into issues or need help beyond this guide, paste the following into any AI assistant (ChatGPT, Claude, Gemini, etc.) for context-aware help:

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

Environment variables:
- On Vercel: KIOSK_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- On bridge computer (.env): T800_BRIDGE_TARGET_URL (Vercel URL), KIOSK_API_KEY (same key as Vercel)

The device heartbeats with "receive_cmd" every ~30 seconds when connected.

Please help me with: [DESCRIBE YOUR ISSUE HERE]
```

---

> 💡 Replace `[DESCRIBE YOUR ISSUE HERE]` with your specific question, such as:
> - "The bridge shows ERROR_UNAUTHORIZED when forwarding scans"
> - "How do I add a new employee to the biometric system"
> - "The device is connected but scans aren't appearing on the Vercel dashboard"
> - "How do I move the bridge to a different computer"
> - "How do I set up the bridge to start automatically"
