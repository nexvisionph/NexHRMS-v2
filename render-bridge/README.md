# NexHRMS FK Bridge (Render Cloud Deployment)

Cloud-hosted bridge that receives attendance pushes from FK F80 biometric devices and forwards them to the NexHRMS Vercel API.

## Quick Deploy to Render

1. Push this folder to a GitHub repo (or use as subfolder)
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect repo, set Root Directory to `render-bridge`
4. Build: `npm install` | Start: `npm start`
5. Add environment variables (see below)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `T800_BRIDGE_TARGET_URL` | ✅ | Your Vercel API endpoint |
| `KIOSK_API_KEY` | ✅ | Must match Vercel's KIOSK_API_KEY |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | For template sync |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | For template sync |

## Health Check

```
GET https://your-bridge.onrender.com/health
```

## Device Configuration (FK F80)

| Setting | Value |
|---------|-------|
| Mode | WAN |
| ServerIP | `your-bridge.onrender.com` |
| ServerPort | `443` |
| Heartbeat | `20` |
| Realtime Req | `Yes` |
