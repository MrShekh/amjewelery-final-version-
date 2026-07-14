/**
 * Database fix script to recalculate pendingAmount values for all jama gold entries
 * This ensures consistency where pendingAmount = jamaGoldAmount - returnedAmount
 * 
 * Run this script once to fix existing data inconsistencies.
 * 
 * Make sure to set your MONGODB_URI environment variable before running:
 * set MONGODB_URI="your_mongodb_connection_string" && node src/utils/fix-pending-amounts.js
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Try to load environment variables from .env.local
let MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  try {
    const envPath = path.join(__dirname, '../../.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
      if (line.startsWith('MONGODB_URI=')) {
        MONGODB_URI = line.split('=')[1].replace(/"/g, '').trim();
        break;
      }
    }
  } catch (error) {
    console.log('Could not read .env.local file');
  }
}

const DB_NAME = 'goldbilling';

async function fixPendingAmounts() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  let client;
  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DB_NAME);
    const jamaBalancesCol = db.collection('customerjamabalances');
    
    console.log('Fetching all jama gold entries...');
    const allBalances = await jamaBalancesCol.find({}).toArray();
    
    console.log(`Found ${allBalances.length} jama gold entries to check`);
    
    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    
    for (const balance of allBalances) {
      const jamaGoldAmount = balance.jamaGoldAmount || 0;
      const returnedAmount = balance.returnedAmount || 0;
      const currentPendingAmount = balance.pendingAmount || 0;
      const correctPendingAmount = Math.max(0, jamaGoldAmount - returnedAmount);
      
      if (Math.abs(currentPendingAmount - correctPendingAmount) > 0.001) {
        // Needs fixing
        console.log(`Fixing entry ${balance._id}: ${currentPendingAmount}g -> ${correctPendingAmount}g`);
        
        await jamaBalancesCol.updateOne(
          { _id: balance._id },
          {
            $set: {
              pendingAmount: correctPendingAmount,
              updatedAt: new Date()
            }
          }
        );
        
        fixedCount++;
      } else {
        alreadyCorrectCount++;
      }
    }
    
    console.log(`\n✅ Fix completed!`);
    console.log(`   ${fixedCount} entries were corrected`);
    console.log(`   ${alreadyCorrectCount} entries were already correct`);
    console.log(`   Total entries processed: ${allBalances.length}`);
    
  } catch (error) {
    console.error('Error fixing pending amounts:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Run the fix if this script is called directly
if (require.main === module) {
  fixPendingAmounts()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixPendingAmounts };
