// Simple test to debug bill creation
console.log("Testing bill API endpoints...");

// Test data
const testData = {
  customerId: "507f1f77bcf86cd799439011", // Example ObjectId
  billNo: "TestBill01",
  completeOrderWeight: 50.5,
  kalesStoneWeight: 2.0,
  adWeight: 1.5,
  manufacturingCost: 3.0,
  removeKalesStone: true,
  removeAdWeight: false,
  itemDetails: [
    {
      description: "Test Ring",
      particulars: "Gold Ring",
      rate: "50.500g"
    }
  ],
  termsAndConditions: "Test terms",
  notes: "Test bill creation"
};

console.log("Test payload:", JSON.stringify(testData, null, 2));

// Expected final weight calculation:
// 50.5 (base) - 2.0 (kales removed) + 3.0 (manufacturing) = 51.5g
console.log("Expected final weight: 51.5g");
