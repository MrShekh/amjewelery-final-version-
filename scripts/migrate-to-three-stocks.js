const { MongoClient } = require('mongodb')

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gold-erp'
const client = new MongoClient(uri)

async function migrateToThreeStocks() {
  try {
    await client.connect()
    console.log('Connected to MongoDB')
    
    const db = client.db('gold-erp')
    const inventoryCollection = db.collection('inventory')
    const karigarsCollection = db.collection('karigars')
    
    // Check existing inventory structure
    const existingInventory = await inventoryCollection.findOne({})
    
    if (!existingInventory) {
      // No existing inventory, create new three-stock structure
      console.log('No existing inventory found. Creating new three-stock inventory...')
      const now = new Date()
      const initialInventory = {
        adminStock: 500, // Starting with 500g admin stock
        karigarStock: 200, // Starting with 200g karigar stock  
        customerStock: 0, // Starting with 0g customer stock
        lastUpdated: now,
        createdAt: now
      }
      
      await inventoryCollection.insertOne(initialInventory)
      console.log('New three-stock inventory created successfully')
    } else if (existingInventory.goldStock !== undefined || existingInventory.jamaGold !== undefined) {
      // Old structure exists, migrate to new structure
      console.log('Old inventory structure detected. Migrating to three-stock system...')
      
      const updates = {}
      const now = new Date()
      
      // Migrate goldStock to adminStock
      if (existingInventory.goldStock !== undefined) {
        updates.adminStock = existingInventory.goldStock
      } else {
        updates.adminStock = 500 // Default value
      }
      
      // Initialize karigarStock if not exists
      if (existingInventory.karigarStock === undefined) {
        updates.karigarStock = 200 // Default value
      }
      
      // Migrate jamaGold to customerStock
      if (existingInventory.jamaGold !== undefined) {
        updates.customerStock = existingInventory.jamaGold
      } else {
        updates.customerStock = 0 // Default value
      }
      
      // Update timestamp
      updates.lastUpdated = now
      
      // Apply updates
      await inventoryCollection.updateOne(
        { _id: existingInventory._id },
        { 
          $set: updates,
          $unset: { 
            goldStock: "", 
            jamaGold: "" 
          } 
        }
      )
      
      console.log('Migration completed successfully')
      console.log(`Admin Stock: ${updates.adminStock}g`)
      console.log(`Karigar Stock: ${updates.karigarStock}g`) 
      console.log(`Customer Stock: ${updates.customerStock}g`)
    } else {
      // Already using three-stock structure
      console.log('Three-stock structure already in place')
      
      // Ensure all fields exist
      const updates = {}
      if (existingInventory.adminStock === undefined) updates.adminStock = 500
      if (existingInventory.karigarStock === undefined) updates.karigarStock = 200
      if (existingInventory.customerStock === undefined) updates.customerStock = 0
      
      if (Object.keys(updates).length > 0) {
        updates.lastUpdated = new Date()
        await inventoryCollection.updateOne(
          { _id: existingInventory._id },
          { $set: updates }
        )
        console.log('Added missing stock fields:', Object.keys(updates))
      }
    }
    
    // Ensure admin karigar (Nayem) exists
    const adminKarigar = await karigarsCollection.findOne({ isAdmin: true })
    if (!adminKarigar) {
      console.log('Creating admin karigar (Nayem)...')
      const adminKarigarDoc = {
        name: 'Nayem',
        phone: '',
        specialty: 'Casting',
        isAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      await karigarsCollection.insertOne(adminKarigarDoc)
      console.log('Admin karigar created successfully')
    } else {
      console.log('Admin karigar already exists')
    }
    
    // Display final inventory state
    const finalInventory = await inventoryCollection.findOne({})
    console.log('\n=== Final Inventory State ===')
    console.log(`Admin Stock: ${finalInventory.adminStock}g`)
    console.log(`Karigar Stock: ${finalInventory.karigarStock}g`)
    console.log(`Customer Stock: ${finalInventory.customerStock}g`)
    console.log(`Total Gold: ${finalInventory.adminStock + finalInventory.karigarStock + finalInventory.customerStock}g`)
    
  } catch (error) {
    console.error('Error during migration:', error)
    throw error
  } finally {
    await client.close()
    console.log('Disconnected from MongoDB')
  }
}

// Run migration
if (require.main === module) {
  migrateToThreeStocks()
    .then(() => {
      console.log('\nMigration completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\nMigration failed:', error)
      process.exit(1)
    })
}

module.exports = migrateToThreeStocks
