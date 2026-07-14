# Enhanced Billing System with Stone Weight Control

## Overview
The new billing system gives admin full control over AD and Kales stone weights, with automatic fine gold conversion and accurate stock management.

## Your Example Scenario

### Manufacturing Process:
- **Input**: 12g gold
- **Manufacturing Process**:
  - Filing: 12g → 11.5g (500mg loss)
  - Free Polish: 11.5g → 11g (500mg loss) 
  - Stone Setting: 11g + 500mg stones → 11.3g (200mg loss)
  - Final Polish: 11.3g → 11g (300mg loss)
- **Results**:
  - Total Loss: 1.5g
  - Final Weight: 11g (10.5g pure gold + 0.5g stones)
  - Karigar Returns: 10.5g pure gold to admin

---

## New Billing Options

### Option 1: Pure Gold Only (Recommended)
```
Customer Bill: 10.5g pure gold + making charges
Stock Movement:
  - Deduct: 10.5g from Karigar Return Stock
  - Add: Final amount to Customer Stock
Result: ✅ Stock perfectly balanced
```

### Option 2: Gold + Stone Weight
```
Customer Bill: 11g (10.5g gold + 0.5g stones) + making charges  
Stock Movement:
  - Deduct: 10.5g from Karigar Return Stock
  - Admin provides: 0.5g worth of stones from stone inventory
  - Add: Final amount to Customer Stock
Result: ✅ Stock balanced (admin covers stone weight)
```

---

## Admin Stone Weight Control

### Default Initialization
- **Auto-detected**: 500mg stones (250mg Kales + 250mg AD)
- **Admin can adjust**: Increase/decrease as needed
- **Live calculation**: Updates fine gold amounts instantly

### Quick Preset Buttons
1. **📋 Use Detected**: Use the auto-detected stone weight
2. **⚡ Standard 500mg**: Set 250mg Kales + 250mg AD
3. **🚫 No Stones**: Set both to 0mg

### Admin Adjustment Examples

**Example 1: Increase Stone Weight**
```
Original: 500mg stones
Admin sets: 600mg stones (300mg Kales + 300mg AD)
Impact: +100mg stone weight admin must provide
```

**Example 2: Decrease Stone Weight** 
```
Original: 500mg stones
Admin sets: 400mg stones (200mg Kales + 200mg AD)
Impact: -100mg stone weight saved
```

**Example 3: No Stones**
```
Original: 500mg stones  
Admin sets: 0mg stones
Impact: Pure gold billing automatically (cleanest option)
```

---

## Stock Management Logic

### Pure Gold Billing (10.5g)
```
Karigar Return Stock: -10.5g (fine gold)
Customer Stock: +Final Amount (fine gold)
Stone Inventory: No change
✅ Perfect balance
```

### Gold + Stone Billing (11g)
```
Karigar Return Stock: -10.5g (fine gold only)
Stone Inventory: -0.5g equivalent (admin provides)
Customer Stock: +Final Amount (fine gold)
✅ Balanced with admin stone contribution
```

---

## Fine Gold Conversion

All calculations automatically handle karat purity:

```javascript
// Example with 92% karat gold
actualGoldWeight = 10.5g (karat)
karatPurity = 92% = 0.92
actualGoldWeightInFineGold = 10.5 × 0.92 = 9.66g fine gold

// Stone weights don't get converted (remain in karat terms)
stoneWeight = 0.5g (physical weight, not fine gold)

// Final calculation
billingWeightInFineGold = 9.66g fine gold
manufacturingCostGrams = X.XXg fine gold  
totalCustomerOwedFineGold = (9.66 + manufacturingCost - advanceGold) fine gold
```

---

## User Interface Features

### Real-time Feedback
- **Live calculations** update as you type
- **Stock impact warnings** show source of materials
- **Stone weight tracking** in both grams and milligrams
- **Preset buttons** for common scenarios

### Visual Indicators
- 🥇 Pure gold amounts (fine gold)
- 💎 Stone weights (physical)
- 📊 Stock impact explanations
- ⚠️ Admin responsibility warnings

### Smart Validation
- Prevents negative values
- Validates stock availability
- Shows calculation breakdowns
- Tracks changes from detected values

---

## Benefits

### For Admin
✅ **Full control** over stone weight adjustments  
✅ **Accurate stock** tracking with no phantom gold  
✅ **Flexible billing** options for different scenarios  
✅ **Clear transparency** on where materials come from  
✅ **Easy presets** for common stone weights  

### For Business
✅ **Precise inventory** management  
✅ **Detailed audit trail** of all adjustments  
✅ **Professional billing** with clear breakdowns  
✅ **Stock reconciliation** that always balances  

---

## API Enhancements

### New Parameters
```json
{
  "billingWeightOption": "PURE_GOLD_ONLY" | "INCLUDE_STONE_WEIGHT",
  "manualStoneWeight": 0.250,
  "manualAdWeight": 0.250
}
```

### Enhanced Logging
```
🔧 [BILLING DEBUG] billingWeightOption: INCLUDE_STONE_WEIGHT
🔧 [BILLING DEBUG] totalManualStoneWeight: 0.500g
🔧 [BILLING DEBUG] stoneWeightFromAdminStock: 0.500g
🔧 [BILLING DEBUG] Stone weight increased by 0.100g (100mg)
```

### Transaction Descriptions
```
"Bill created for order Ring. Gold+Stone billing: 9.66g fine gold + 0.500g admin stones + Making: 0.500g fine = Customer owes: 10.16g fine gold"
```

---

## Migration Notes

### Existing Data
- All existing bills remain unaffected
- New fields are optional with sensible defaults
- Legacy calculations still work

### Gradual Adoption
- Start with "Pure Gold Only" for simplest transition
- Add stone weight billing when needed
- Use presets to speed up common scenarios

---

This enhanced system gives you complete control while maintaining accurate stock tracking and professional billing!
