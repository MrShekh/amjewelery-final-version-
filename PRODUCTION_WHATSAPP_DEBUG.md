# 🔍 Production WhatsApp Debugging Guide

## Current Error: "❌ Failed to send bill. Please try again."

### Quick Diagnosis Steps:

#### 1. **Check WhatsApp Service Status**
Visit your production app at: `https://your-app.com/api/whatsapp/status`

Expected response if working:
```json
{
  "connected": true,
  "status": "connected", 
  "phone": "919xxxxxxxxx",
  "isReady": true
}
```

If you get error/timeout - your WhatsApp service isn't deployed or reachable.

#### 2. **Check Environment Variables**
In your deployment dashboard (Vercel/Netlify), verify:
```
WHATSAPP_SERVICE_URL = https://your-whatsapp-service-url.com
```

❌ **If missing/wrong**: Add correct URL and redeploy
✅ **If correct**: Continue to step 3

#### 3. **Test WhatsApp Service Directly**
Visit: `https://your-whatsapp-service-url.com/status`

Expected response:
```json
{
  "status": "connected",
  "phone": "919xxxxxxxxx", 
  "isReady": true
}
```

#### 4. **Reconnect WhatsApp if Disconnected**
Visit: `https://your-whatsapp-service-url.com/qr`
- Scan QR code with your WhatsApp
- Wait for "Successfully Connected" message

---

## Common Production Issues:

### Issue 1: WhatsApp Service Not Deployed ❌
**Symptoms**: 
- `/api/whatsapp/status` returns error
- Can't access whatsapp service URL

**Fix**: Deploy `whatsapp-service` folder to Railway/Render/Heroku

### Issue 2: Wrong Environment Variable ❌  
**Symptoms**:
- Status shows "WhatsApp service not available"
- WHATSAPP_SERVICE_URL pointing to localhost

**Fix**: Update env var to production URL

### Issue 3: WhatsApp Connection Lost ❌
**Symptoms**:
- Service accessible but status shows "disconnected" 
- QR code needed

**Fix**: Re-scan QR code at `/qr` endpoint

### Issue 4: Railway/Service Sleeping ❌
**Symptoms**: 
- Works initially then stops
- Service goes to sleep after inactivity

**Fix**: Upgrade to paid plan or use keepalive ping

---

## Test Commands (Replace URLs):

```bash
# Test main app status
curl https://your-main-app.com/api/whatsapp/status

# Test whatsapp service directly  
curl https://your-whatsapp-service.railway.app/status

# Check if service is responding
curl https://your-whatsapp-service.railway.app/
```

---

## Service URLs Format:

- **Main App**: `https://your-app.vercel.app` 
- **WhatsApp Service**: `https://whatsapp-service-production-xxxx.up.railway.app`
- **QR Code**: `https://whatsapp-service-production-xxxx.up.railway.app/qr`

---

## Next Steps:
1. ✅ Identify which issue you have above
2. ✅ Follow corresponding fix
3. ✅ Test bill sending again
4. ✅ Monitor for 24 hours to ensure stability
