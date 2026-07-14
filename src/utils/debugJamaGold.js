/**
 * Debug utility to check jama gold consistency
 * Run this from the browser console to debug jama gold issues
 */

const debugJamaGold = async (customerId) => {
  try {
    // Fetch customer data
    const response = await fetch(`/api/customers/${customerId}`)
    const data = await response.json()
    
    if (!data.customer) {
      console.error('Customer not found')
      return
    }
    
    const customer = data.customer
    const jamaBalances = customer.jamaGold?.balances || []
    
    console.log('=== JAMA GOLD DEBUG ===')
    console.log('Customer:', customer.name)
    console.log('Total balances:', jamaBalances.length)
    
    let totalManual = 0
    let totalOrderBased = 0
    let totalReturned = 0
    let totalPending = 0
    
    jamaBalances.forEach((balance, index) => {
      const goldAmount = balance.goldBalance || balance.jamaGoldAmount || 0
      const returned = balance.returnedAmount || 0
      const pending = goldAmount - returned
      
      console.log(`\nBalance ${index + 1}:`)
      console.log('  ID:', balance.id)
      console.log('  Order ID:', balance.orderId || 'Manual Entry')
      console.log('  Jamaica Gold Amount (legacy):', balance.jamaGoldAmount || 0)
      console.log('  Gold Balance (new):', balance.goldBalance || 0)
      console.log('  Effective Amount:', goldAmount)
      console.log('  Returned:', returned)
      console.log('  Pending:', pending)
      console.log('  Description:', balance.description || balance.notes || 'No description')
      
      if (balance.orderId) {
        totalOrderBased += goldAmount
      } else {
        totalManual += goldAmount
      }
      
      totalReturned += returned
      totalPending += pending
    })
    
    console.log('\n=== SUMMARY ===')
    console.log('Total Manual Entries:', totalManual.toFixed(3), 'g')
    console.log('Total Order-Based:', totalOrderBased.toFixed(3), 'g')
    console.log('Total Gold Amount:', (totalManual + totalOrderBased).toFixed(3), 'g')
    console.log('Total Returned:', totalReturned.toFixed(3), 'g')
    console.log('Total Pending:', totalPending.toFixed(3), 'g')
    console.log('Summary from API:', customer.jamaGold.summary)
    
    // Check for precision issues
    const calculatedTotal = totalManual + totalOrderBased
    const apiTotal = customer.jamaGold.summary.totalJamaGold
    const difference = Math.abs(calculatedTotal - apiTotal)
    
    if (difference > 0.001) {
      console.warn('⚠️ PRECISION ISSUE DETECTED!')
      console.warn('Calculated Total:', calculatedTotal.toFixed(6))
      console.warn('API Summary Total:', apiTotal.toFixed(6))
      console.warn('Difference:', difference.toFixed(6))
    } else {
      console.log('✅ Calculations are consistent')
    }
    
  } catch (error) {
    console.error('Error debugging jama gold:', error)
  }
}

// Usage: debugJamaGold('YOUR_CUSTOMER_ID')
console.log('Debug utility loaded. Use: debugJamaGold("customerId")')
