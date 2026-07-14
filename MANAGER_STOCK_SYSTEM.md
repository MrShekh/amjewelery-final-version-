# Manager Gold Stock Management System

## Overview
The Manager section is a new feature that tracks gold transfers between Admin and Manager with automatic updates from completed orders.

## How It Works

### 1. **Admin to Manager (Manual Entry)**
- Admin manually records when gold is given to the manager
- Fields required:
  - Date
  - Karat type (22K, 75K, 75.5K, 76K, 80K, 88K, 92K, 59K)
  - Weight in grams
  - Optional description
- This **increases** the manager's stock for that specific karat

### 2. **Manager to Admin (Automatic from Orders)**
- When an order is completed, the system **automatically**:
  - Calculates the pure gold weight (final weight minus stone weight)
  - Creates a "Manager to Admin" entry
  - **Deducts** that weight from the manager's stock for that karat
  - Links the entry to the completed order
- This happens without any manual intervention

### 3. **Stock Tracking by Karat**
- Each karat type has its own separate stock
- Stock is displayed in a grid showing current balance for each karat
- Stock can go negative if more orders are completed than gold was given

### 4. **Clear & Download**
- One-click button to:
  1. Download all current data as JSON file
  2. Reset all stocks to zero
  3. Clear all entries
- Use this for periodic reconciliation or accounting periods

## Database Structure

### ManagerGoldStock Collection
```typescript
{
  stock22k: number
  stock75k: number
  stock76k: number
  stock80k: number
  stock88k: number
  stock92k: number
  stock59k: number
  stock755k: number
  entries: ManagerGoldEntry[]
  lastUpdated: Date
  createdAt: Date
}
```

### ManagerGoldEntry
```typescript
{
  date: Date
  karat: number
  weight: number
  type: 'ADMIN_TO_MANAGER' | 'MANAGER_TO_ADMIN'
  description?: string
  orderId?: string
  createdAt: Date
}
```

## API Endpoints

### GET /api/manager-stock
- Fetches current manager stock and all entries
- Creates initial stock document if doesn't exist

### POST /api/manager-stock
- Adds a manual "Admin to Manager" entry
- Updates the appropriate karat stock
- Body:
  ```json
  {
    "date": "2025-11-29",
    "karat": 22,
    "weight": 100.50,
    "description": "Monthly gold allocation"
  }
  ```

### DELETE /api/manager-stock
- Clears all stocks and entries
- Returns the data for download
- Resets everything to zero

## Integration with Order Completion

When an order is completed (`/api/orders/[id]/complete`):
1. System calculates `actualGoldWeight` = `actualFinalWeight` - `totalStoneWeight`
2. Creates a `MANAGER_TO_ADMIN` entry with:
   - Order's karat type
   - Pure gold weight
   - Order ID reference
3. Deducts this weight from manager's stock for that karat
4. Logs the transaction

## UI Features

### Two-Section Layout
1. **Left Section: Admin → Manager**
   - Shows all manual entries
   - Green "+X.XXg" indicators
   - Manual entry badge

2. **Right Section: Manager → Admin**
   - Shows all automatic entries from completed orders
   - Red "-X.XXg" indicators
   - Auto from orders badge
   - Links to order IDs

### Stock Summary Cards
- 8 cards showing current stock for each karat
- Amber/yellow gradient design
- Real-time updates

### Add Gold Form
- Collapsible form
- Date picker (defaults to today)
- Karat dropdown
- Weight input (decimal support)
- Optional description textarea

## Example Workflow

1. **Day 1**: Admin gives manager 500g of 22K gold
   - Manual entry: +500g to stock22k
   - Current stock: 500g

2. **Day 2**: Order #1 completed (22K, pure weight: 50g)
   - Automatic entry: -50g from stock22k
   - Current stock: 450g

3. **Day 3**: Order #2 completed (22K, pure weight: 75g)
   - Automatic entry: -75g from stock22k
   - Current stock: 375g

4. **End of Month**: Clear & Download
   - Downloads JSON with all entries
   - Resets all stocks to 0
   - Ready for next month

## Files Created/Modified

### New Files
- `src/components/ManagerPage.tsx` - Main UI component
- `src/app/manager/page.tsx` - Page route
- `src/app/api/manager-stock/route.ts` - API endpoints

### Modified Files
- `src/types/mongodb.ts` - Added ManagerGoldStock and ManagerGoldEntry types
- `src/app/api/orders/[id]/complete/route.ts` - Added automatic manager stock update
- `src/components/Navigation.tsx` - Added Manager link

## Benefits

1. **Transparency**: Clear tracking of all gold movements
2. **Automation**: No manual entry needed for completed orders
3. **Karat-Specific**: Separate tracking for each gold purity
4. **Audit Trail**: Complete history of all transactions
5. **Easy Reconciliation**: One-click download and reset
6. **Order Linkage**: Direct connection to order IDs for verification

## Notes

- Stock can go negative if orders are completed before gold is allocated
- The system doesn't prevent negative stock (by design for flexibility)
- All weights are in grams with 2 decimal precision
- Automatic updates happen during order completion, not during individual process steps
- Only the pure gold weight (without stones) is tracked in manager stock
