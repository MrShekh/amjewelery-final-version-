// Fix script to properly distribute making charges for Hasan bhai's orders
// Run this in MongoDB compass or mongo shell

// Update the two orders to properly reflect the making charge distribution
db.manufacturingProcesses.updateMany(
  {
    karigarId: "68b1be7b4f90f5f553feb3d2", // Hasan bhai's ID
    orderId: { $in: ["68c2b35cfaffb1cb6a266060", "68c2b0fdacb6c6e6585d907b"] }, // pendal 2 and pendal order IDs
    processType: "FILING"
  },
  {
    $set: {
      karigarMakingCharge: 0.15, // 0.3g total / 2 orders = 0.15g each
      isFullyRecovered: true     // Mark as fully recovered since 0.35g recovers the 0.35g admin recoverable amount
    }
  }
)

// Verify the update
db.manufacturingProcesses.find(
  {
    karigarId: "68b1be7b4f90f5f553feb3d2",
    orderId: { $in: ["68c2b35cfaffb1cb6a266060", "68c2b0fdacb6c6e6585d907b"] }
  },
  {
    orderId: 1,
    goldLoss: 1,
    karigarMakingCharge: 1,
    goldRecovered: 1,
    isFullyRecovered: 1
  }
)

// Expected result for each order:
// goldLoss: 0.5
// karigarMakingCharge: 0.15 
// goldRecovered: 0.35
// isFullyRecovered: true
// 
// Calculation: 0.5g - 0.15g = 0.35g (admin recoverable)
//              0.35g - 0.35g = 0g (fully recovered)
