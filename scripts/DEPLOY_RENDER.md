Render deploy quick-start

1. Create a new Service on Render:
   - Service Type: Web Service
   - Environment: Node
   - Branch: connect your GitHub repo branch

2. Build & Start:
   - Build Command: (optional) leave empty or `npm ci`
   - Start Command: `node scripts/fk-bridge.js`
   Render will provide a `PORT` env variable which the bridge now respects.

3. Environment variables (set in Render dashboard):
   - `KIOSK_API_KEY` — required for device authentication (set to a strong secret)
   - `T800_BRIDGE_TARGET_URL` — your Vercel attendance API, e.g. `https://your-site.vercel.app/api/attendance/t800`
   - `T800_DEVICE_IDS` — optional comma-separated device IDs to whitelist
   - `FK_BRIDGE_LOG_FILE` — optional path for logs (defaults to `scripts/fk-bridge.log`)

### Creating the Kiosk API key

1. Generate a secure secret locally (pick one):

```powershell
# OpenSSL (PowerShell/CMD if OpenSSL installed)
openssl rand -base64 32

# Node (no extra deps)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

2. Copy the generated value and add it as a Render Environment Variable:
   - In the Render dashboard go to your Service → Environment → Environment Variables → Add Environment Variable
   - Name: `KIOSK_API_KEY`
   - Value: (paste the generated secret)
   - Save and redeploy the service.

3. Configure devices and local bridges to use the key:
   - Devices must include the header `x-kiosk-api-key: <your-secret>` on POST requests.
   - For local bridges, set `KIOSK_API_KEY` in the host environment or `/.env.local` during development (do not commit secrets).

4. Test with curl (replace with your service URL and secret):

```bash
curl -X POST "https://your-service.onrender.com" \
  -H "Content-Type: application/json" \
  -H "x-kiosk-api-key: <your-key>" \
  -d '{"request_code":"realtime_glog","user_id":"123","io_time":"20260508 08:30:00","io_mode":"IN","deviceId":"T800-1"}'
```

5. Rotation & management:
   - Store the key in a password manager.
   - Rotate periodically: generate a new key, update Render and devices together, then revoke the old key.


4. After deploy, note the public URL (https://your-service.onrender.com) and configure each biometric device's server/URL to point to that URL. Use HTTPS and include the `x-kiosk-api-key` header on device requests.

5. For reliability:
   - If devices are on local LANs and cannot reach the public URL, deploy a local bridge on that LAN instead and set device to that IP.
   - Ensure idempotency and queuing if network outages are expected.

Example test:

```bash
curl -X POST "https://your-service.onrender.com" \
  -H "Content-Type: application/json" \
  -H "x-kiosk-api-key: <your-key>" \
  -d '{"request_code":"realtime_glog","user_id":"123","io_time":"20260508 08:30:00","io_mode":"IN","deviceId":"T800-1"}'
```
