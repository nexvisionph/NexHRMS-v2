# NexHRMS — Biometric Attendance Setup (Local / Office Network)

> **Who is this guide for?**
> Office administrators, IT staff, or anyone setting up the FK F80 biometric device to work with NexHRMS on a local office network. No cloud hosting needed — everything runs on your office computer.

---

## What You'll Need

Before you start, make sure you have the following:

- ✅ An **FK F80 biometric device** (face and fingerprint scanner)
- ✅ A **Windows laptop or desktop** that will act as the server
- ✅ Both the device and the computer connected to the **same WiFi network**
- ✅ **NexHRMS v2** installed on the computer
- ✅ **Node.js** installed on the computer

---

## How It Works

Here's the simple flow of what happens when someone scans their finger or face:

```
Employee scans on device
        ↓
Device sends data to your computer (over WiFi)
        ↓
A small program (bridge) on your computer receives it
        ↓
The bridge sends it to NexHRMS
        ↓
NexHRMS records the attendance (clock-in or clock-out)
        ↓
The dashboard updates with the attendance data
```

The device and your computer talk to each other over your office WiFi — no internet connection is required.

---

## Step 1 — Find Your Computer's IP Address

You need to know your computer's WiFi IP address so the device knows where to send data.

1. Open **Command Prompt** or **PowerShell** on your computer
2. Type `ipconfig` and press Enter
3. Look for **Wireless LAN adapter Wi-Fi**
4. Note the **IPv4 Address** (e.g. `192.168.254.111`)

> 💡 **Tip:** Write this IP address down — you'll enter it into the device in the next step.

---

## Step 2 — Configure the Device

On the FK F80 device:

1. Go to **Menu → Comm** (Communication settings)
2. Set the following:

| Setting | What to enter |
|---------|---------------|
| **Mode** | `Internet` |
| **Server** | Your computer's IP address (from Step 1) |
| **Port** | `8080` |

3. Save the settings
4. **Restart the device** (power off and on)

> ⚠️ **Important:** The Mode **must** be set to `Internet`. If it's set to `Local`, the device won't send any data to your computer.

---

## Step 3 — Allow the Connection Through Windows Firewall

Windows may block the device from connecting. You need to create a firewall rule:

1. Open **PowerShell as Administrator**
2. Run this command:

```
netsh advfirewall firewall add rule name="FK Bridge 8080" dir=in action=allow protocol=TCP localport=8080
```

3. You should see **"Ok."** — the rule is now active

> 💡 You only need to do this once. The rule stays even after restarting your computer.

---

## Step 4 — Enroll Employees on the Device

Each employee needs to be registered on the F80 device:

1. On the device, go to **Menu → User → New User**
2. Enter the employee's name
3. Follow the on-screen instructions to register their **face** and/or **fingerprint**
4. The device will assign a **User ID** (a number like `1`, `12`, `36`)

> 📝 **Write down each employee's User ID** — you'll need it for the next step.

---

## Step 5 — Link Employees in NexHRMS

For each enrolled employee, you need to connect their device User ID to their NexHRMS profile:

1. Log in to NexHRMS as an **admin** (`http://localhost:3000`)
2. Go to **Employees**
3. Click on the employee's name → **Edit**
4. Find the **Biometric ID** field
5. Enter the **User ID** from the device (e.g. `12`)
6. Click **Save**

> ⚠️ The Biometric ID must **exactly match** the User ID shown on the device.

---

## Step 6 — Start the System

You need to run **two programs** on your computer:

### Start NexHRMS (Terminal 1)

```
cd c:\xampp\htdocs\Github\NexHRMS-v2
npm run dev
```

Wait until you see: `✓ Ready - Local: http://localhost:3000`

### Start the Bridge (Terminal 2)

Open a **second** terminal window:

```
cd c:\xampp\htdocs\Github\NexHRMS-v2
npm run biometric:bridge
```

Wait until you see:
```
bridge listening {"port":8080, "target":"http://localhost:3000/api/attendance/t800", ...}
```

### Confirm the Device is Connected

Within 30 seconds, you should see messages like:
```
post request received {..., "requestCode":"receive_cmd", ...}
```

This means the device is talking to your computer. ✅

---

## Step 7 — Test It Out

### First Scan = Clock In

1. Have an employee scan their face or finger on the device
2. The device should say **"Verified"**
3. Check the bridge terminal — you should see `forwarded` with `status: 200`
4. Open NexHRMS → **Attendance** page → the employee should show as **Present** with a check-in time

### Second Scan = Clock Out

1. Have the same employee scan again
2. Check the Attendance page — now they should also have a **check-out time** and **hours worked**

### How It Decides In vs Out

| Scan | What happens |
|------|-------------|
| First scan of the day | Records **clock-in** |
| Second scan of the day | Records **clock-out** and calculates hours |
| Any scan after that | Ignored (one clock-in and one clock-out per day) |

---

## Daily Routine

Every work day, someone needs to:

1. **Turn on the computer** and make sure it's connected to the office WiFi
2. **Open two terminals** and run:
   - `npm run dev` (starts NexHRMS)
   - `npm run biometric:bridge` (starts the bridge)
3. **Wait for the heartbeat** (`receive_cmd` in the logs)
4. ✅ System is ready — employees can start scanning

To stop: press `Ctrl+C` in both terminals.

---

## Common Issues & How to Fix Them

### "I scanned but nothing shows up in the logs"

| Check this | How to fix |
|------------|-----------|
| Is the bridge running? | Make sure you see `bridge listening` in the terminal |
| Is the device heartbeat showing? | Wait 30 seconds for `receive_cmd` to appear |
| Are device and computer on the same WiFi? | Both must be on the same network (same IP range like `192.168.254.x`) |
| Is the Mode set to Internet? | On device: Comm → Mode → change to `Internet` |
| Is the Server IP correct? | On device: Comm → Server → enter your computer's current WiFi IP |
| Is the firewall allowing connections? | Run the firewall command from Step 3 |

### "The bridge says 'forwarded' but with an error"

| Error | Meaning | Fix |
|-------|---------|-----|
| `ERROR_LOG_UPSERT` | Database rejected the data | Check if Supabase migrations are applied |
| `Unmapped biometric ID` | No employee linked to that User ID | Go to Employees → Edit → set the Biometric ID |
| `ERROR_UNAUTHORIZED` | Missing API key | For local setup, this shouldn't happen. Check your `.env` file |

### "It was working yesterday but not today"

Your computer's WiFi IP address may have changed. Check:

1. Run `ipconfig` again to find your new IP
2. Update the **Server** setting on the device to the new IP
3. Restart the device

> 💡 **Pro tip:** Ask your IT team to set up a **static IP** for the bridge computer so the address never changes.

### "My colleague's computer shows a different error"

If you see `Could not find column in schema cache`:
1. Go to **Supabase Dashboard → SQL Editor**
2. Run: `NOTIFY pgrst, 'reload schema';`
3. Try scanning again

---

## Viewing Attendance on the Dashboard

### As an Admin or HR

- **Dashboard** shows overall stats: how many present, absent, on leave
- **Attendance page** shows every employee's clock-in/out for the day
- Data refreshes when you switch back to the browser tab

### As an Employee

- **Dashboard** shows your personal attendance status for today
- You can see your own check-in time, check-out time, and hours worked

---

## Quick Reference Card

| Item | Value |
|------|-------|
| Device mode | `Internet` |
| Device port | `8080` |
| Bridge command | `npm run biometric:bridge` |
| NexHRMS command | `npm run dev` |
| NexHRMS URL | `http://localhost:3000` |
| Where to set Biometric ID | Employees → Edit → Biometric ID field |
| Firewall rule | `netsh advfirewall firewall add rule name="FK Bridge 8080" dir=in action=allow protocol=TCP localport=8080` |

---

## AI Assistant Prompt

If you need further help configuring the biometric device or troubleshooting issues, you can paste the following prompt into any AI assistant (ChatGPT, Claude, Gemini, etc.) to give it full context about your setup:

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

My current setup is LOCAL (bridge forwards to http://localhost:3000/api/attendance/t800).
Both the device and the bridge computer are on the same WiFi network.

Please help me with: [DESCRIBE YOUR ISSUE HERE]
```

---

> 💡 Replace `[DESCRIBE YOUR ISSUE HERE]` with your specific question or problem, such as:
> - "The device is not connecting to the bridge"
> - "Scans are being forwarded but attendance doesn't show up"
> - "How do I add a new employee to the biometric system"
> - "How do I reset an employee's attendance for today"
