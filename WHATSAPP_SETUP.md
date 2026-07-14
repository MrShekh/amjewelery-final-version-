# 📱 WhatsApp Integration Setup Guide

## 🚀 Quick Start

### Step 1: Install WhatsApp Service Dependencies
```bash
# Navigate to the WhatsApp service directory
cd whatsapp-service

# Install dependencies
npm install
```

### Step 2: Start WhatsApp Service
```bash
# Start the WhatsApp service
npm start

# Or for development with auto-restart
npm run dev
```

### Step 3: Connect Admin WhatsApp
1. **Open in browser**: http://localhost:5001/qr
2. **Scan QR Code**: Use your phone's WhatsApp to scan the QR code
3. **Wait for confirmation**: Page will show "WhatsApp Successfully Connected!"

### Step 4: Start Your Main Application
```bash
# In the main project directory
npm run dev
```

### Step 5: Test Bill Sending
1. **Navigate** to Bills section in your app
2. **Find any bill** with customer phone number
3. **Click "Send WhatsApp"** button next to "Download PDF"
4. **Check customer's phone** for the bill message and PDF

---

## 🔧 How It Works

### Architecture
```
Next.js App ←→ Express WhatsApp Service ←→ WhatsApp Web API
```

### Flow
1. **Admin connects**: Scans QR code once, stays connected
2. **Bill creation**: PDF is generated and saved 
3. **Send WhatsApp**: Button sends PDF + message to customer automatically
4. **Customer receives**: WhatsApp message with bill details + PDF attachment

### Files Created
```
whatsapp-service/
├── server.js           # WhatsApp service with QR and bill sending
├── package.json        # Dependencies
└── README.md          # This guide

src/
├── app/api/whatsapp/
│   ├── status/route.ts      # Check WhatsApp connection status
│   └── send-bill/route.ts   # Send bill via WhatsApp
├── components/
│   └── SendWhatsAppButton.tsx # Reusable WhatsApp send button
└── Updated components:
    ├── BillDetailPage.tsx    # Added WhatsApp button
    └── BillsPage.tsx        # Added WhatsApp button
```

---

## 🧪 Testing Steps

### 1. Test WhatsApp Connection
- Visit: http://localhost:5001/qr
- Scan QR with your WhatsApp
- Should show "Successfully Connected"

### 2. Test Status API
- Check: http://localhost:3000/api/whatsapp/status
- Should return: `{"connected": true, "status": "connected", "isReady": true}`

### 3. Test Bill Sending
1. Go to any bill in your app
2. Look for green "Send WhatsApp" button
3. Click it (should show success message)
4. Check customer's phone for message + PDF

### 4. Test Different Scenarios
- **No WhatsApp**: Button shows "Connect WhatsApp" 
- **No customer phone**: Error message
- **Service down**: Error with instructions
- **Already connected**: Direct sending

---

## 📱 WhatsApp Message Format

When a bill is sent, customer receives:

```
🏪 AM Jwellers - Invoice

📋 Bill Number: BILL-001
👤 Customer: John Doe  
📅 Date: 06/09/2025

💰 Bill Summary:
• Total Amount: 5.250g fine gold
• Gold Weight: 11.500g
• Notes: Custom design as requested

📎 Please find your detailed bill attached as PDF.

Thank you for choosing AM Jwellers! 🙏

---
AM Jwellers
📞 9907047429
📍 Shekh Nayem, Patavadi Chowk
```

Plus PDF attachment: `Bill_BILL-001_John_Doe.pdf`

---

## ⚡ Features

- ✅ **One-time QR scan**: Admin scans once, stays connected
- ✅ **Automatic PDF sending**: Generates and sends PDF instantly  
- ✅ **Smart phone formatting**: Handles Indian numbers (+91)
- ✅ **Rich messages**: Professional bill message with details
- ✅ **Status indicators**: Shows connection status in real-time
- ✅ **Error handling**: Clear error messages and retry options
- ✅ **Responsive UI**: Works on all screen sizes

---

## 🔍 Troubleshooting

### WhatsApp Not Connecting
- Refresh http://localhost:5001/qr
- Make sure WhatsApp service is running (`npm start`)
- Check if port 5001 is available

### Button Shows "Connect WhatsApp"
- WhatsApp service might be down
- Click button to open QR page
- Scan QR code again

### "Failed to send bill" Error
- Check if customer has valid phone number
- Ensure WhatsApp service is connected
- Try refreshing and sending again

### PDF Not Attaching
- Check if bill PDF generation works (Download PDF button)
- Verify file size isn't too large
- Check Express server logs for errors

---

## 🛠 Environment Variables

Add to your `.env.local`:
```env
# WhatsApp Service Configuration
WHATSAPP_SERVICE_URL=http://localhost:5001
```

---

## 📞 Support

If you need help:
1. Check Express server logs in terminal
2. Check browser console for errors  
3. Test individual components (QR, PDF, API endpoints)
4. Verify all services are running on correct ports (Next.js: 3000, WhatsApp: 5001)
