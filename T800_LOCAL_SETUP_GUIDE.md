# T800 Biometric Local Setup Guide

Step-by-step guide to connect a T800 (FaceBS100) biometric device to NexHRMS running locally.

---

## Prerequisites

Before you start, make sure you have:

- [ ] A T800 or FaceBS100 biometric device (powered on and connected to your local network via Ethernet or Wi-Fi)
- [ ] A Windows PC/server on the **same network** as the biometric device
- [ ] Node.js 18 or higher installed on the PC ([download here](https://nodejs.org/))
- [ ] The NexHRMS-v2 project cloned and `npm install` completed
- [ ] Your Supabase project set up with migrations applied

---

## Step 1: Find Your IP Addresses

You need two IP addresses:

### Your PC/Server IP (where the bridge will run)

Open Command Prompt and run:

```cmd
ipconfig
```

Look for your **IPv4 Address** under your active network adapter (Wi-Fi or Ethernet). Example: `192.168.1.50`

### Your Biometric Device IP

Check your device's network settings screen, or look at your router's connected devices list. Example: `192.168.1.100`

> **Write both IPs down. You'll need them throughout this guide.**

---

## Step 2: Configure Environment Variables

Open the `.env` file in the NexHRMS-v2 root folder and add these lines at the bottom:

```env
# ─── Biometric Bridge Configuration ───
FK_BRIDGE_PORT=5006
T800_BRIDGE_TARGET_URL=http://localhost:3000/api/attendance/t800
KIOSK_API_KEY=your-secure-key-here-change-this

# ─── T800 Device Settings ───
T800_DEVICE_IDS=YOUR_DEVICE_SERIAL_NUMBER
T800_REQUEST_CODE=realtime_glog

# ─── Optional: Face Recognition AI ───
# QWEN_API_KEY=your-qwen-api-key-if-using-face-ai
```

**Important:**
- Replace `your-secure-key-here-change-this` with a strong random string (use a password generator, 32+ characters)
- Replace `YOUR_DEVICE_SERIAL_NUMBER` with your actual device serial number (found in device settings). If you have multiple devices, separate with commas: `DEVICE001,DEVICE002`
- The `T800_REQUEST_CODE` should match what your device sends (default is `realtime_glog`)

---

## Step 3: Configure Windows Firewall

The biometric device needs to reach port **5006** on your PC. Windows Firewall blocks this by default.

### Option A: Using Command Prompt (Run as Administrator)

```cmd
netsh advfirewall firewall add rule name="NexHRMS Biometric Bridge (Inbound)" dir=in action=allow protocol=TCP localport=5006 remoteip=192.168.1.100
```

> **Replace `192.168.1.100` with your biometric device's actual IP address.**

### Option B: Using Windows Firewall GUI

1. Press `Win + R`, type `wf.msc`, press Enter
2. Click **Inbound Rules** on the left panel
3. Click **New Rule...** on the right panel
4. Select **Port** → Next
5. Select **TCP**, enter **5006** in "Specific local ports" → Next
6. Select **Allow the connection** → Next
7. Check all profiles (Domain, Private, Public) → Next
8. Name it: `NexHRMS Biometric Bridge` → Finish

### Option C: Using PowerShell (Run as Administrator)

```powershell
New-NetFirewallRule -DisplayName "NexHRMS Biometric Bridge" -Direction Inbound -Protocol TCP -LocalPort 5006 -Action Allow -RemoteAddress 192.168.1.100
```

> **Replace `192.168.1.100` with your biometric device's actual IP address.**

### Verify the Rule

```cmd
netsh advfirewall firewall show rule name="NexHRMS Biometric Bridge (Inbound)"
```

You should see the rule listed with Action: Allow.

---

## Step 4: Configure the Biometric Device

On the T800/FaceBS100 device, go to the network/server settings and configure:

| Setting | Value |
|---------|-------|
| **Server IP / URL** | `http://192.168.1.50:5006` |
| **Port** | `5006` |
| **Protocol** | HTTP |
| **Request Code** | `realtime_glog` |

> **Replace `192.168.1.50` with YOUR PC's IP address from Step 1.**

The device will POST scan events to this address whenever someone scans their fingerprint or face.

---

## Step 5: Map Employee Biometric IDs

Each employee needs a `biometric_id` that matches their user ID on the physical device.

1. Log in to NexHRMS as Admin
2. Go to **Employees** → **Manage**
3. Click on an employee → **Edit**
4. Find the **Biometric ID** field
5. Enter the user ID that the employee is enrolled with on the physical device (e.g., `1`, `2`, `BIO001`, etc.)
6. Save

> **The biometric_id in NexHRMS must exactly match the user_id/enroll_id stored on the physical device.**

---

## Step 6: Start the System

Open **two separate terminals** in the NexHRMS-v2 project folder:

### Terminal 1 — Start the Next.js App

```cmd
npm run dev
```

Wait until you see "Ready" and the app is running on `http://localhost:3000`.

### Terminal 2 — Start the Biometric Bridge

```cmd
npm run biometric:bridge
```

You should see output like:

```
[2026-05-12T06:00:00.000Z] [info] FK Bridge listening on 0.0.0.0:5006
[2026-05-12T06:00:00.000Z] [info] Target: http://localhost:3000/api/attendance/t800
```

**For auto-restart on crash (recommended for production):**

```cmd
npm run biometric:bridge:watch
```

---

## Step 7: Test the Connection

### 7.1 Check Bridge Health

Open a browser and go to:

```
http://localhost:5006/health
```

You should see:

```json
{
  "ok": true,
  "bridge": "fk-bridge",
  "listeningPort": 5006,
  "target": "http://localhost:3000/api/attendance/t800"
}
```

### 7.2 Check T800 Endpoint Health

Go to:

```
http://localhost:3000/api/attendance/t800
```

You should see a JSON response with `"ok": true` and device stats.

### 7.3 Test a Manual Scan

Open Command Prompt and send a test scan:

```cmd
curl -X POST http://localhost:5006 -H "Content-Type: application/json" -H "request_code: realtime_glog" -H "dev_id: TEST_DEVICE" -d "{\"user_id\": \"1\", \"io_time\": \"20260512090000\", \"io_mode\": \"1\"}"
```

> Replace `"user_id": "1"` with an actual biometric_id mapped to an employee.

### 7.4 Test from the Device

Have an enrolled employee scan their fingerprint/face on the device. Then check:
- The bridge terminal should show a log entry
- The NexHRMS attendance page should show the check-in

---

## Step 8: Verify Attendance is Recording

1. Log in to NexHRMS as Admin
2. Go to **Attendance** page
3. You should see the employee's check-in record with:
   - Time In timestamp
   - Device ID
   - Status: Present

If the employee scans again later, it will record as a **check-out**.

---

## Troubleshooting

### "Connection refused" or scans not appearing

| Check | How |
|-------|-----|
| Is the bridge running? | Look for "FK Bridge listening" in Terminal 2 |
| Is the firewall open? | Run `netsh advfirewall firewall show rule name="NexHRMS Biometric Bridge (Inbound)"` |
| Can the device reach the PC? | From device settings, try to ping your PC IP |
| Is the port correct? | Device must point to port 5006 |
| Is the IP correct? | Device must point to your PC's LAN IP, not `localhost` |

### "Unauthorized" or "ERROR_UNAUTHORIZED"

- The `KIOSK_API_KEY` in your `.env` must match what the bridge sends
- If you just added the key, restart both the app and the bridge

### "No active employee found for this biometric ID"

- The `biometric_id` on the employee record doesn't match what the device sends
- Check what ID the device is sending (look at bridge logs in `scripts/fk-bridge.log`)
- Update the employee's Biometric ID field to match

### Employee scans but nothing happens

- Check `scripts/fk-bridge.log` for errors
- Make sure the device's request_code matches `T800_REQUEST_CODE` in your `.env`
- Make sure the device serial number is in `T800_DEVICE_IDS` (or leave it empty to allow all devices)

### Bridge crashes or won't start

- Port 5006 might be in use. Check: `netstat -ano | findstr :5006`
- Kill the process using that port, or change `FK_BRIDGE_PORT` in `.env`

---

## Network Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR LOCAL NETWORK                         │
│                                                             │
│  ┌──────────────────┐         ┌──────────────────────────┐ │
│  │  T800 Biometric  │         │  Your PC / Server        │ │
│  │  Device           │         │                          │ │
│  │                  │  HTTP    │  ┌────────────────────┐  │ │
│  │  IP: 192.168.1.100├────────▶│  │  FK Bridge         │  │ │
│  │                  │  POST   │  │  Port: 5006        │  │ │
│  │  Sends scans to  │  :5006  │  └─────────┬──────────┘  │ │
│  │  server IP:5006  │         │            │              │ │
│  └──────────────────┘         │            │ HTTP POST    │ │
│                               │            │ localhost:3000│ │
│                               │            ▼              │ │
│                               │  ┌────────────────────┐  │ │
│                               │  │  Next.js App       │  │ │
│                               │  │  Port: 3000        │  │ │
│                               │  │  /api/attendance/  │  │ │
│                               │  │  t800              │  │ │
│                               │  └─────────┬──────────┘  │ │
│                               │            │              │ │
│                               │  IP: 192.168.1.50        │ │
│                               └────────────┼──────────────┘ │
│                                            │                 │
└────────────────────────────────────────────┼─────────────────┘
                                             │ HTTPS
                                             ▼
                                  ┌──────────────────────┐
                                  │  Supabase Cloud      │
                                  │  (Database)          │
                                  └──────────────────────┘
```

---

## Quick Reference

| Item | Value |
|------|-------|
| Bridge Port | `5006` |
| Bridge Health Check | `http://localhost:5006/health` |
| T800 API Endpoint | `http://localhost:3000/api/attendance/t800` |
| Bridge Log File | `scripts/fk-bridge.log` |
| Start Bridge | `npm run biometric:bridge` |
| Start Bridge (auto-restart) | `npm run biometric:bridge:watch` |
| Start App | `npm run dev` |
| Default Password (demo) | `demo1234` |

---

## Security Reminders

- **Never open port 5006 to the internet** — only allow your biometric device's IP
- **Change the default KIOSK_API_KEY** — use a strong random string
- **Restrict T800_DEVICE_IDS** — only allow your registered device serial numbers
- **Keep the bridge server updated** — run `npm update` periodically
- **Monitor bridge logs** — check `scripts/fk-bridge.log` for suspicious activity
