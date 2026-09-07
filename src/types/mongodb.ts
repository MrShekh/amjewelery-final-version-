import { ObjectId } from 'mongodb'

// Enums
export enum OrderType {
  CUSTOMER_GOLD = 'CUSTOMER_GOLD',
  ADMIN_GOLD = 'ADMIN_GOLD',
  MIXED = 'MIXED'
}

export enum OrderStatus {
  CREATED = 'CREATED',
  IN_PROCESS = 'IN_PROCESS',
  COMPLETED = 'COMPLETED',
  DELIVERED = 'DELIVERED'
}

export enum TransactionType {
  GOLD_IN = 'GOLD_IN',
  GOLD_OUT = 'GOLD_OUT',
  GOLD_LOSS = 'GOLD_LOSS',
  GOLD_RECOVERY = 'GOLD_RECOVERY',
  MANUFACTURING_COST = 'MANUFACTURING_COST',
  CUSTOMER_PAYMENT = 'CUSTOMER_PAYMENT',
  KARIGAR_SALARY = 'KARIGAR_SALARY',
  JAMA_GOLD_ADDED = 'JAMA_GOLD_ADDED', // When customer owes gold after order completion
  JAMA_GOLD_RETURNED = 'JAMA_GOLD_RETURNED', // When customer returns jama gold
  KARIGAR_STOCK_DEDUCTION = 'KARIGAR_STOCK_DEDUCTION', // When gold is deducted from karigar stock for order
  KARIGAR_STOCK_REFUND = 'KARIGAR_STOCK_REFUND', // When gold is refunded to karigar stock after weight reduction
  ADMIN_TO_MANAGER = 'ADMIN_TO_MANAGER', // When admin gives gold to manager
  MANAGER_TO_ADMIN = 'MANAGER_TO_ADMIN' // When manager returns gold to admin (from completed orders)
}

export enum ProcessType {
  FILING = 'FILING',
  FREE_POLISH = 'FREE_POLISH',
  STONE_SETTING = 'STONE_SETTING',
  FINAL_POLISH = 'FINAL_POLISH'
}

// Individual process step tracking
export interface ProcessStep {
  processType: ProcessType
  karigarId: string
  karigarName: string
  inputWeight: number
  outputWeight: number
  goldLoss: number
  // Special handling for stone setting
  stonesAdded?: {
    adStones?: { sizeMm: number, pieces: number, totalWeight: number }[]
    kalesStones?: { sizeMm: number, pieces: number, totalWeight: number }[]
    totalStoneWeight: number
  }
  processedAt: Date
  sequence: number
}

// Document interfaces
export interface Customer {
  _id?: ObjectId
  id?: string
  name: string
  phone?: string
  email?: string
  address?: string
  createdAt: Date
  updatedAt: Date
}

export interface Karigar {
  _id?: ObjectId
  id?: string
  name: string
  phone?: string
  specialty?: string
  createdAt: Date
  updatedAt: Date
}

export interface Order {
  _id?: ObjectId
  id?: string
  orderNumber?: string // Automatic sequential order number like 'bag01', 'bag02', etc.
  customerId: string
  orderName: string
  orderPhoto?: string
  orderType: OrderType
  customerGoldWeight: number
  adminGoldWeight: number
  totalGoldUsed: number
  finalJewelryWeight: number
  manufacturingCost: number
  manufacturingCostType?: string // 'money' or 'gold'
  manufacturingCostGoldAmount?: number // Amount if paid in gold
  adminProfitGold: number

  // New Karat and Advance Gold Fields
  selectedKarat?: number // Karat purity for this order (92, 88, 80, 76, 75.5, 75, 59, 37.5)
  customerAdvanceGold?: number // Advance gold given by customer for this order
  advanceGoldDescription?: string // Optional description for advance gold

  // Spreadsheet register fields
  fillingKarigar?: string
  fillingIn?: number
  fillingOut?: number
  fillingLoss?: number
  ad?: number
  adNote?: string
  klStone?: number
  klStoneNote?: string
  settingKarigar?: string
  settingLoss?: number
  polishKarigar?: string
  polishLoss?: number
  finishWeight?: number
  makingCharge?: number

  // AD Details Fields (legacy single fields)
  adSize?: string // AD size (e.g., "2mm", "3mm")
  adPieces?: number // Number of AD pieces
  adTotal?: number // Total AD weight or value

  // AD Details Array (new multiple entries format)
  adDetails?: {
    size: string // AD size (e.g., "2mm", "3mm")
    pieces: number // Number of AD pieces
    total: number // Total AD weight or value
  }[]

  // Delivery date
  deliveryDate?: string // Expected delivery date

  // Weight tracking
  originalOrderWeight: number // Original order weight (10g in example)
  actualFinalWeight: number // Actual final weight after all processes with stones (11.3g in example)
  actualGoldWeight?: number // Actual gold weight without stones (10.5g in example)
  totalStoneWeight?: number // Total weight of all stones added (0.8g in example)
  totalWeightLoss: number // Total loss across all processes (1.5g in example)

  // Stock management flags
  useKarigarStock?: boolean // If true, deduct from karigar stock during processing
  karigarStockDeducted?: boolean // Flag to track if karigar stock was deducted
  karigarStockAmount?: number // Amount deducted from karigar stock

  // Stones data (can be multiple of each type now)
  adStones?: {
    sizeMm: number
    pieces: number
    totalWeight: number
  }[]
  kalesStones?: {
    sizeMm: number
    pieces: number
    totalWeight: number
  }[]

  // Legacy single stone support (for backward compatibility)
  adStone?: {
    sizeMm: number // Size in millimeters
    pieces: number // Number of pieces
    totalWeight: number // Total weight
  }
  kalesStone?: {
    sizeMm: number // Size in millimeters
    pieces: number // Number of pieces
    totalWeight: number // Total weight
  }

  // Process workflow tracking
  processWorkflow?: {
    currentProcess: number // Current process step (1=filing, 2=free polish, 3=stone setting, 4=final polish)
    totalProcesses: number // Total number of processes planned
    processesCompleted: ProcessStep[]
  }

  status: OrderStatus
  // Billing Information
  billing?: {
    actualWeight: number // Actual jewelry weight customer gets/returns
    customerGoldGiven: number // Gold customer originally provided
    adminGoldUsed: number // Extra gold admin provided for manufacturing
    totalGoldUsed: number // Total gold used in manufacturing
    goldToReturn: number // Gold customer needs to return (= actualWeight)
    manufacturingCostDue: number // Manufacturing cost customer needs to pay
    goldReturned: number // Gold actually returned by customer
    manufacturingCostPaid: number // Manufacturing cost actually paid
    goldPending: number // Remaining gold to be returned
    costPending: number // Remaining manufacturing cost to be paid
    totalBillAmount: number // Total bill in rupees (if converting gold to money)
    billingCompleted: boolean // Whether customer has settled everything
  }
  createdAt: Date
  updatedAt: Date
}

export enum ProcessStatus {
  STARTED = 'STARTED',    // Input recorded, karigar working on it
  COMPLETED = 'COMPLETED' // Output recorded, process finished
}

export interface ManufacturingProcess {
  _id?: ObjectId
  id?: string
  orderId: string
  karigarId: string
  processType: string
  inputWeight: number
  outputWeight?: number // Optional until process is completed
  goldLoss?: number     // Optional until process is completed
  status: ProcessStatus // Track if process is started or completed
  goldLossFineEquivalent?: number // Gold loss converted to fine gold equivalent
  karigarMakingCharge?: number // Karigar's making charge from the loss (in karat gold)
  karigarMakingChargeFineEquivalent?: number // Making charge in fine gold equivalent
  adminRecoverable?: number // Actual amount admin can recover (loss - making charge) in karat gold
  adminRecoverableFineEquivalent?: number // Admin recoverable in fine gold equivalent
  goldRecovered?: number // Amount of gold actually recovered by admin
  goldRecoveredBy?: string // Who recovered the gold (admin/user ID)
  recoveredAt?: Date // When the gold was recovered
  startedAt: Date       // When process was started (input recorded)
  completedAt?: Date    // When process was completed (output recorded)
  sequence: number
  createdAt: Date
  updatedAt: Date
}

export interface GoldTransaction {
  _id?: ObjectId
  id?: string
  orderId?: string
  customerId?: string
  type: TransactionType
  amount: number
  description: string
  recoveredGold: number
  createdAt: Date
  updatedAt: Date
}

export interface Inventory {
  _id?: ObjectId
  id?: string
  userId?: string // For multi-tenant support
  organizationId?: string // For multi-tenant support

  // Core stocks (all values in grams)
  adminStock: number // Admin's main gold stock (legacy, no longer shown in UI)
  customerStock: number // Customer/market stock
  karigarLossStock: number // Total gold lost by karigars (unrecovered)
  recoveredStock: number // Gold recovered back from karigar loss
  karigarLossClearedAmount?: number // Raw (per-karat-mixed) baseline subtracted from the live karigar loss total when "Clear Total Loss" is clicked (dashboard card only)
  karigarLossClearedByKarat?: Record<string, number> // Per-karat raw loss baseline already cleared (keyed like AdminGoldStock fields: k92, k88, ...). Used to compute the net fine loss for Total Stock, and to know exactly how much karat gold to credit into Admin Stock each time "Clear Total Loss" is clicked.

  // Advance Customer Stock (separate from main stocks)
  advanceCustomerStock: number // Advance gold given by customers for orders (tracked individually)

  // Legacy/advanced fields kept optional so old data and casting module still work, but they are not used in main flow
  karigarStock?: number // Legacy aggregate karigar stock (no longer used in calculations)
  karigarReturnStock?: number // Legacy: completed orders ready for billing
  karigar92Stock?: number
  karigar755Stock?: number
  karigar80Stock?: number
  karigar92InProcess?: number
  karigar755InProcess?: number
  karigar80InProcess?: number
  extra92Stock?: number
  extra755Stock?: number
  extra80Stock?: number
  karigar92FineStock?: number
  karigar755FineStock?: number
  karigar80FineStock?: number

  // Legacy fields for migration support
  goldStock?: number // Old field name
  jamaGold?: number // Old customer stock field name

  lastUpdated: Date
  createdAt: Date
}

// Admin Gold Stock Management — karat-wise ledger of admin's own raw gold
export interface AdminGoldEntry {
  _id?: ObjectId
  id?: string
  date: Date
  karat: number // purity percentage: 92, 88, 84, 80, 76, 75.5, 75, 59, 37.5 — 0 for fine-only entries (e.g. CUSTOMER_GOLD_RECOVERED) that aren't tied to a karat
  weight: number // Signed weight in grams: positive = gold added, negative = gold given out
  type: 'MANUAL' | 'ORDER_COMPLETE' | 'ORDER_FILLING' | 'ORDER_DELETED' | 'KARIGAR_LOSS_RECOVERED' | 'CUSTOMER_GOLD_RECOVERED' // Manual add/remove, automatic deduction from a completed order, automatic deduction/return from a Filling In edit in the order register, automatic return of Filling In gold when the order is deleted, automatic credit from clearing recovered karigar loss, or automatic credit from collecting jama gold back from a customer
  description?: string
  orderId?: string // If this entry is from a completed order
  createdAt: Date
}

export interface AdminGoldStock {
  _id?: ObjectId
  id?: string
  userId?: string // For multi-tenant support
  organizationId?: string // For multi-tenant support

  // Stock by karat purity (all values in grams, karat gold — not fine).
  // Field keys generated via karatFieldKey() in src/lib/admin-stock-karats.ts
  k92?: number
  k88?: number
  k84?: number
  k80?: number
  k76?: number
  k75_5?: number
  k75?: number
  k59?: number
  fineStock?: number // Fine gold credited directly (not tied to a karat) — e.g. gold recovered back from a customer
  k37_5?: number

  // Entries history
  entries: AdminGoldEntry[]

  lastUpdated: Date
  createdAt: Date
}


// Casting process record
export interface Casting {
  _id?: ObjectId
  id?: string
  initialGoldTaken: number // Gold initially taken from admin stock
  extraGoldCut: number // Extra gold cut and returned to admin stock
  finalCastingWeight: number // Calculated: initialGoldTaken - extraGoldCut
  castingLoss: number // Loss during casting process (compensated by admin)
  finalCastGold: number // Final gold going to karigar stock (finalCastingWeight - castingLoss + castingLoss = finalCastingWeight)
  // Stock changes
  adminStockBefore: number
  adminStockAfter: number
  karigarStockBefore: number
  karigarStockAfter: number
  description?: string
  createdAt: Date
  updatedAt: Date
}

// Track individual customer jama balance
export interface CustomerJamaBalance {
  _id?: ObjectId
  id?: string
  customerId: string
  orderId: string
  jamaGoldAmount: number // Amount of gold customer owes
  returnedAmount: number // Amount already returned
  pendingAmount: number // Remaining amount to be returned
  description: string
  createdAt: Date
  updatedAt: Date
}

// Bulk loss recovery tracking
export interface BulkLossRecovery {
  _id?: ObjectId
  id?: string
  karigarId: string
  processType: ProcessType // FILING, STONE_SETTING, FREE_POLISH, FINAL_POLISH
  totalLossBeforeRecovery: number // Total accumulated loss before this recovery
  recoveredAmount: number // Amount recovered in this session
  remainingLoss: number // Loss remaining after recovery
  recoveryDate: Date // Date of recovery
  recoveryPeriod: string // e.g., "Week 1 Jan 2024" or "January 2024"
  description?: string // Optional description
  affectedProcessIds: string[] // List of process IDs that contributed to this loss
  createdAt: Date
  updatedAt: Date
}

// Organization for multi-tenancy
export interface Organization {
  _id?: ObjectId
  id?: string
  name: string
  planType: string // 'free', 'starter', 'professional'
  maxUsers: number
  maxOrders: number
  subscriptionStatus: string // 'active', 'cancelled', 'expired'
  subscriptionEnds: Date
  createdAt: Date
  updatedAt: Date
}

// Admin user authentication (multi-tenant system)
export interface User {
  _id?: ObjectId
  id?: string
  organizationId?: string // For multi-tenancy support
  email: string
  password?: string // Will store plaintext as requested (optional for backward compatibility)
  hashedPassword?: string // Optional hashed version for security
  firstName: string
  lastName: string
  businessName: string // Name of the jewelry business
  phone?: string
  role?: string // 'owner', 'admin', 'user'
  isActive: boolean
  emailVerified?: boolean
  failedLoginAttempts?: number
  totalLogins?: number
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
}

// Helper function to convert MongoDB document to API response format
export function toClientFormat<T>(doc: T & { _id: ObjectId }): T & { id: string } {
  const { _id, ...rest } = doc
  return { ...rest, id: _id.toString() } as T & { id: string }
}

// Helper function to generate ObjectId from string or create new one
export function getObjectId(id?: string): ObjectId {
  return id ? new ObjectId(id) : new ObjectId()
}
