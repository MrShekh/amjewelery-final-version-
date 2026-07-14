import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { getUsersCollection, getOrdersCollection, getInventoryCollection, getGoldTransactionsCollection, getCustomerJamaBalancesCollection } from '@/lib/mongodb'
import { AuthenticationError, handleApiError, generateRequestId } from '@/lib/errorHandler'

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    console.log(`[${requestId}] Starting POST /api/admin/collect-order-gold (DISABLED)`)
    return NextResponse.json(
      {
        error:
          'Customer gold collection is disabled in the simplified stock model. All tracking is via admin stock and karigar loss only.'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error(`[${requestId}] Error in collect-order-gold API:`, error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to collect gold'
      },
      { status: 500 }
    )
  }
}
