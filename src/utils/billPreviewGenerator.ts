/**
 * Utility to generate Bill Preview HTML
 * This generates the exact same HTML that would be shown in BillPreview component
 */

interface BillPreviewData {
  order: {
    customer: {
      name: string;
      phone?: string;
      email?: string;
      address?: string;
    };
    orderName?: string;
    orderPhoto?: string;
    orderNumber?: string;
    actualGoldWeight?: number;
    actualFinalWeight?: number;
    totalStoneWeight?: number;
    selectedKarat?: number;
    processes?: Array<{
      processType: string;
      inputWeight: number;
      outputWeight: number;
      goldLoss: number;
      karigar?: {
        name: string;
      };
    }>;
  };
  calculations: {
    baseWeightSelected?: number;
    actualGoldWeight?: number;
    totalCustomStoneWeight?: number;
    finalBillingWeight?: number;
    billingWeightInFineGold?: number;
    manufacturingCostGrams?: number;
    makingCharge?: number; // NEW: Making charge for display in Wastage column
    customStoneWeight?: number;
    customAdWeight?: number;
    advanceGoldUsed?: number;
    currentOrderOwedFineGold?: number;
    totalPastPendingAmount?: number;
    totalCustomerOwedFineGold?: number;
    karatPurity?: number;
    rupees?: number; // NEW: Rupees amount for display in Rupees column
  };
  pastPendingDetails?: Array<{
    orderId: string;
    orderInfo?: {
      orderName: string;
      orderNumber?: string;
    };
    pendingAmount: number;
  }>;
  billNumber: string;
}

export function generateBillPreviewHTML(data: BillPreviewData): string {
  const currentDate = new Date().toLocaleDateString('en-IN');
  
  return `
    <div class="bg-white p-8 border border-gray-300 shadow-lg max-w-4xl mx-auto" style="min-height: auto;">
      <!-- Header -->
      <div class="flex justify-between items-start mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">AM Jwellers</h1>
          <div class="text-sm text-gray-700">
            <p>Shekh Nayem</p>
            <p>Patavadi Chowk</p>
            <p>Phone 9907047429</p>
          </div>
        </div>
        <div class="text-right">
          <div class="bg-blue-600 text-white p-3 rounded-lg mb-4">
            ${data.order?.orderPhoto 
              ? `<img src="${data.order.orderPhoto}" alt="Order Photo" class="w-12 h-12 object-cover rounded mx-auto mb-2" />`
              : `<div class="w-12 h-12 bg-white/20 rounded mx-auto mb-2"></div>`
            }
          </div>
          <div class="text-sm">
            <p class="font-semibold">INVOICE ${data.billNumber}</p>
            <p>DATE: ${currentDate}</p>
          </div>
        </div>
      </div>

      <!-- Customer Info -->
      <div class="mb-8">
        <div class="border-b-2 border-gray-300 pb-2 mb-4">
          <p class="font-bold text-lg">TO:</p>
          <p class="font-semibold">Customer Name: ${data.order?.customer?.name || 'Loading...'}</p>
        </div>
      </div>

      <!-- Past Jama Section (if exists) -->
      ${data.pastPendingDetails && data.pastPendingDetails.length > 0 ? `
        <div class="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <h3 class="text-sm font-bold text-yellow-800 mb-3">📋 Past Jama Gold (Previous Orders)</h3>
          <div class="space-y-2">
            ${data.pastPendingDetails.map(detail => `
              <div class="flex justify-between text-xs">
                <span class="text-yellow-700">${detail.orderInfo?.orderName || 'Order #' + detail.orderId.slice(-6)}</span>
                <span class="font-semibold text-red-600">${detail.pendingAmount.toFixed(3)}g</span>
              </div>
            `).join('')}
            <div class="border-t border-yellow-300 pt-2 mt-2">
              <div class="flex justify-between text-sm font-bold">
                <span class="text-yellow-800">Total Past Pending:</span>
                <span class="text-red-700">${(data.calculations?.totalPastPendingAmount || 0).toFixed(3)}g</span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Bill Table -->
      <div class="mb-8 overflow-x-auto">
        <table class="w-full border-collapse border border-gray-400 min-w-max">
          <thead>
            <tr class="bg-gray-100">
              <th class="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style="width: 7%">Sr</th>
              <th class="border border-gray-400 px-2 py-2 text-left text-xs font-semibold" style="width: 18%">Order Detail</th>
              <th class="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style="width: 10%">Net Wt</th>
              <th class="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style="width: 10%">Stone</th>
              <th class="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style="width: 10%">Ad Wt</th>
              <th class="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style="width: 11%">Wastage</th>
              <th class="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style="width: 11%">Gross Wt</th>
              <th class="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style="width: 11%">Total</th>
              <th class="border border-gray-400 px-1 py-2 text-center text-xs font-semibold" style="width: 12%">Rupees</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="border border-gray-400 px-1 py-2 text-xs text-center">1</td>
              <td class="border border-gray-400 px-2 py-2 text-xs" style="word-break: break-word;">
                ${(data.order?.orderName || 'Loading...').length > 15 
                  ? (data.order?.orderName || 'Loading...').substring(0, 15) + '...' 
                  : (data.order?.orderName || 'Loading...')
                }
              </td>
              <td class="border border-gray-400 px-1 py-2 text-xs text-center">
                ${(data.calculations?.baseWeightSelected || data.calculations?.actualGoldWeight || 0).toFixed(2)}g
              </td>
              <td class="border border-gray-400 px-1 py-2 text-xs text-center">
                ${(data.calculations?.customStoneWeight || 0) > 0 
                  ? `${(data.calculations?.customStoneWeight || 0).toFixed(2)}g` 
                  : '-'
                }
              </td>
              <td class="border border-gray-400 px-1 py-2 text-xs text-center">
                ${(data.calculations?.customAdWeight || 0) > 0 
                  ? `${(data.calculations?.customAdWeight || 0).toFixed(2)}g` 
                  : '-'
                }
              </td>
              <td class="border border-gray-400 px-1 py-2 text-xs text-center">
                ${data.calculations?.makingCharge || '-'}
              </td>
              <td class="border border-gray-400 px-1 py-2 text-xs text-center font-medium">
                ${(data.calculations?.finalBillingWeight || data.calculations?.actualGoldWeight || 0).toFixed(2)}g
              </td>
              <td class="border border-gray-400 px-1 py-2 text-xs text-center font-bold">
                ${(data.calculations?.currentOrderOwedFineGold || data.calculations?.totalCustomerOwedFineGold || 0).toFixed(2)}g
              </td>
              <td class="border border-gray-400 px-1 py-2 text-xs text-center">
                ₹${data.calculations?.rupees || 0}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Total Summary Section -->
      <div class="mt-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">BILLING SUMMARY</h3>
        
        ${data.pastPendingDetails && data.pastPendingDetails.length > 0 ? `
        <!-- Past Jama Order -->
        <div class="mb-2">
          <div class="flex justify-between text-sm">
            <span>Past jama order:</span>
            <span class="font-medium text-red-600">${(data.calculations?.totalPastPendingAmount || 0).toFixed(3)}g</span>
          </div>
        </div>
        ` : ''}
        
        <!-- Current Order -->
        <div class="mb-2">
          <div class="flex justify-between text-sm">
            <span>Current order:</span>
            <span class="font-medium">${(data.calculations?.currentOrderOwedFineGold || data.calculations?.totalCustomerOwedFineGold || 0).toFixed(3)}g</span>
          </div>
        </div>
        
        <!-- Total -->
        <div class="border-t border-gray-300 pt-2">
          <div class="flex justify-between text-base font-bold">
            <span>Total:</span>
            <span class="text-orange-600">${((data.calculations?.currentOrderOwedFineGold || data.calculations?.totalCustomerOwedFineGold || 0) + (data.calculations?.totalPastPendingAmount || 0)).toFixed(3)}g</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
