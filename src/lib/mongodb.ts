import { MongoClient, Db, Collection } from 'mongodb'

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gold-erp'
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongodb = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongodb._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalWithMongodb._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongodb._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export { clientPromise }

// Helper function to get database
export async function getDb(): Promise<Db> {
  const client = await clientPromise
  return client.db('gold-erp')
}

// Helper functions to get collections
export async function getCustomersCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('customers')
}

export async function getOrdersCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('orders')
}

export async function getKarigarsCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('karigars')
}

export async function getManufacturingProcessesCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('manufacturing_processes')
}

export async function getGoldTransactionsCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('gold_transactions')
}

export async function getInventoryCollection(): Promise<Collection> {
  const db = await getDb()
  return db.collection('inventory')
}

export async function getCustomerJamaBalancesCollection() {
  const db = await getDb()
  return db.collection('customerJamaBalances')
}

export async function getUsersCollection() {
  const db = await getDb()
  return db.collection('users')
}

export async function getOrganizationsCollection() {
  const db = await getDb()
  return db.collection('organizations')
}

export async function getBillsCollection() {
  const db = await getDb()
  return db.collection('customerBills')
}

export async function getRecoveryHistoryCollection() {
  const db = await getDb()
  return db.collection('recoveryHistory')
}

// Helper function for backward compatibility
export async function connectToDatabase() {
  const db = await getDb()
  return { db }
}
