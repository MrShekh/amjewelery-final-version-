# Vercel Environment Variables Setup

## Add these environment variables in Vercel Dashboard:

### 1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables

### 2. Add this variable:
```
WHATSAPP_SERVICE_URL = https://your-railway-app.railway.app
```

### 3. After Railway deployment, you'll get a URL like:
```
https://whatsapp-service-production-xxxx.up.railway.app
```

### 4. Update this in your Vercel env vars and redeploy

## Current code already uses this variable:
- File: `src/app/api/whatsapp/send-bill/route.ts`
- Line 6: `const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001'`
