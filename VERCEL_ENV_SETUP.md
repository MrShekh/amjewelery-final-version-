# 🚀 Vercel Environment Variable Setup

## Add WhatsApp Service URL to Vercel

### Step 1: Go to Vercel Dashboard
1. **Login** to [Vercel Dashboard](https://vercel.com/dashboard)
2. **Click** on your project (AM Jwellers)
3. **Go to** Settings tab
4. **Click** on "Environment Variables" in left sidebar

### Step 2: Add Environment Variable
**Variable Name:**
```
WHATSAPP_SERVICE_URL
```

**Variable Value:**
```
https://whatsapp-automatic-service-production.up.railway.app
```

**Environment:** Select `Production`, `Preview`, and `Development`

### Step 3: Save and Redeploy
1. **Click** "Save"  
2. **Go to** Deployments tab
3. **Click** "Redeploy" on latest deployment
4. **Select** "Use existing Build Cache" → Redeploy

---

## ✅ Verification Steps:

### 1. Check if variable is set:
After redeployment, test your production app:
```
https://your-app.vercel.app/api/whatsapp/status
```

### 2. Expected result:
```json
{
  "connected": true,
  "status": "connected",
  "phone": "919xxxxxxxxx",
  "isReady": true
}
```

### 3. If still shows errors:
- Make sure you redeployed after adding the env var
- Check Vercel function logs for errors
- Verify the Railway service is still running

---

## 🎯 SUMMARY:

✅ **Local (.env.local)**: Added ✓  
✅ **Vercel Production**: Add manually in dashboard  
✅ **Redeploy**: Required after adding env var

**After both are set up:**
- Local development will use the production WhatsApp service
- Production deployment will use the production WhatsApp service
- No more "Failed to send bill" errors!
