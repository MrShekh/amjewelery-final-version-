# Testing Guide: Process Update Feature

## 🚀 How to Test the New Feature

### Prerequisites
1. Make sure you have Node.js and npm installed
2. MongoDB should be running
3. Environment variables should be configured in `.env.local`

### Step 1: Start the Application

```powershell
# Navigate to the project directory
cd "e:\Kaam\Jija g\AM Jwellers\AM-Jwellers"

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

The application should start on `http://localhost:3000`

### Step 2: Login

1. Open browser and go to `http://localhost:3000`
2. Login with your admin credentials
3. Navigate to the Orders page

### Step 3: Create or Use Existing Order

#### Option A: Use an Existing Order
1. Go to Orders list
2. Click on any order that has completed processes
3. You should see the Process Status Overview

#### Option B: Create a New Test Order
1. Click "Create New Order"
2. Fill in the required fields:
   - Customer name
   - Order name
   - Weights
   - Delivery date
3. Save the order

### Step 4: Create a Process (if needed)

1. In the "Start New Process" section:
   - Select Karigar
   - Select Process Type: "FILING"
   - Input Weight: 12 grams (this should auto-fill from order)
2. Click "Start Process"
3. In the "Complete Process" section:
   - Select the filing process
   - Output Weight: 11.5 grams
4. Click "Complete Process"
5. The process should now appear in "✅ Completed" section

### Step 5: Test the Edit Feature

#### Test Scenario 1: Update Input Weight

1. **Locate the completed process** in "✅ Completed" section
2. **Click "✏️ Edit Process"** button
3. **Modal should open** showing:
   - Original Input Weight: 12.000g
   - Output Weight: 11.500g
   - Current Loss: 0.500g

4. **Update the input weight:**
   - Change "Original Input Weight" from `12.000` to `13.000`
   - Watch the "Calculation Summary" update in real-time
   - Loss should now show: `1.500g` (13 - 11.5)

5. **Click "✅ Update Process"**
6. **Verify the update:**
   - Modal closes
   - Process card now shows: `13.000g → 11.500g (Loss: 1.500g)`
   - Success message appears

#### Test Scenario 2: Update Output Weight

1. **Click "✏️ Edit Process"** again
2. **This time, update output weight:**
   - Keep "Original Input Weight" at `13.000`
   - Change "Output Weight" from `11.500` to `11.000`
   - Loss should update to: `2.000g` (13 - 11)

3. **Click "✅ Update Process"**
4. **Verify:**
   - Process card shows: `13.000g → 11.000g (Loss: 2.000g)`

#### Test Scenario 3: Update Both Weights

1. **Click "✏️ Edit Process"** again
2. **Update both:**
   - "Original Input Weight": `12.000`
   - "Output Weight": `11.000`
   - Loss should show: `1.000g`

3. **Save and verify**

### Step 6: Verify Order Totals Update

1. **Check the order details** page
2. **Verify these values updated automatically:**
   - Total Weight Loss should reflect the new loss amount
   - Actual Final Weight should match the latest output weight
   - All calculations should be accurate

### Step 7: Test with Multiple Processes

1. **Start and complete a second process** (e.g., Free Polish)
   - Input: 11.000g (should auto-fill from filing output)
   - Output: 10.800g

2. **Edit the first process (Filing)** again:
   - Change output from `11.000` to `11.200`

3. **Verify:**
   - Filing loss updates correctly
   - Order total loss updates correctly
   - Free Polish input might need updating (manual adjustment)

### Step 8: Test Stone Setting Process (Advanced)

1. **Create a Stone Setting process**
2. **Add some stones:**
   - AD Stones: 2mm, 10 pieces, 0.5g
   - Kales Stones: 3mm, 5 pieces, 0.3g

3. **Edit the stone setting process:**
   - Click "✏️ Edit Process"
   - **Verify Stone Sections:** You should see "AD Stones" and "Kales Stones" sections.
   - **Update Stone:** Change AD Stone pieces from 10 to 12.
   - **Add New Stone:** Click "+ Add Kales Stone" and add a new row.
   - **Watch Calculation:** Verify "Total Input Weight" increases as you add stones.
   - **Save:** Click "Update Process" and verify the changes are saved.

### Step 9: Test Validation

#### Test Invalid Inputs:

1. **Try setting input weight to 0:**
   - Should show error: "Input weight must be greater than 0"

2. **Try setting output > input** (for non-stone setting):
   - Should show error: "Output weight cannot be greater than input weight"

3. **Try negative output:**
   - Should show error: "Output weight cannot be negative"

### Step 10: Verify Data Persistence

1. **Make an edit**
2. **Refresh the page** (F5)
3. **Verify:**
   - Changes are still there
   - Totals are accurate
   - No data loss

## ✅ Expected Results

After successful testing, you should see:

### In Completed Processes Section:
```
✅ Completed (1)
┌─────────────────────────────────────────┐
│ FILING                      ← LATEST    │
│ Karigar: [Karigar Name]                 │
│ 12.000g → 11.000g (Loss: 1.000g)       │
│                                         │
│                     [Completed]         │
│                     [✏️ Edit Process]   │ ← THIS BUTTON WORKS
└─────────────────────────────────────────┘
```

### In Edit Modal:
- ✅ Original Input Weight field is editable
- ✅ Output Weight field is editable
- ✅ Calculation Summary shows real-time updates
- ✅ Loss calculation is automatic
- ✅ Update button works
- ✅ Cancel button closes modal

### After Saving:
- ✅ Process card shows updated values
- ✅ Order total loss updates
- ✅ Order final weight updates
- ✅ Success message appears
- ✅ Data persists after refresh

## 🐛 Troubleshooting

### Issue: Edit button not showing
**Solution:** 
- Make sure the process is COMPLETED (has both input and output)
- Refresh the page
- Check browser console for errors

### Issue: Modal doesn't open
**Solution:**
- Check browser console for JavaScript errors
- Try hard refresh (Ctrl+Shift+R)
- Clear browser cache

### Issue: Changes not saving
**Solution:**
- Check console for API errors
- Verify MongoDB is running
- Check authentication token is valid
- Look at server logs

### Issue: Loss not calculating
**Solution:**
- Make sure both input and output have values
- Check the calculation formula in ProcessEditModal.tsx
- Verify numbers are being parsed correctly

### Issue: Order totals not updating
**Solution:**
- Check the API endpoint `/api/processes/[id]/edit`
- Verify the order workflow update code is executing
- Check MongoDB for the order document
- Look at server console logs

## 📊 Test Checklist

- [ ] Application starts successfully
- [ ] Can login
- [ ] Can view orders
- [ ] Can create new process
- [ ] Can complete process
- [ ] Edit button appears on completed processes
- [ ] Edit modal opens
- [ ] Can update input weight
- [ ] Can update output weight
- [ ] Loss calculates automatically
- [ ] Changes save successfully
- [ ] Process card updates
- [ ] Order totals update
- [ ] Data persists after refresh
- [ ] Validation works for invalid inputs
- [ ] Works for all process types
- [ ] Works for stone setting with stones
- [ ] Multiple edits work correctly
- [ ] No console errors
- [ ] No API errors

## 📝 Test Report Template

```
Date: [Date]
Tester: [Your Name]
Application Version: [Version]

Test Results:
✅/❌ Feature accessible
✅/❌ Edit button visible
✅/❌ Modal functionality
✅/❌ Input weight update
✅/❌ Output weight update
✅/❌ Loss auto-calculation
✅/❌ Data persistence
✅/❌ Order totals update
✅/❌ Validation working
✅/❌ No errors

Issues Found:
[List any issues]

Notes:
[Any additional observations]
```

## 🎯 Success Criteria

The feature is working correctly if:
1. ✅ Edit button appears on ALL completed processes
2. ✅ Modal opens with current values
3. ✅ Can modify input and output weights
4. ✅ Loss calculates automatically as you type
5. ✅ Saves successfully without errors
6. ✅ Process card updates immediately
7. ✅ Order totals recalculate correctly
8. ✅ Changes persist after page refresh
9. ✅ Validation prevents invalid data
10. ✅ Works for all process types

## 🎉 Ready to Use!

Once all tests pass, the feature is ready for production use. Users can now:
- Update process weights at any time
- Correct mistakes without deleting processes
- Re-measure and update weights accuracy
- Have confidence in automatic loss calculations

---

**Need Help?** Refer to `PROCESS_UPDATE_FEATURE.md` for detailed documentation or `PROCESS_UPDATE_QUICK_GUIDE.md` for quick reference.
