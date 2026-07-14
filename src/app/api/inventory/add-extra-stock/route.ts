import { NextRequest, NextResponse } from 'next/server'
import { getInventoryCollection, getGoldTransactionsCollection, getUsersCollection } from '@/lib/mongodb'
import { TransactionType } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { KARAT_PURITY_VALUES, getPurityDisplayName, KaratPurity } from '@/lib/gold-conversions'

// POST /api/inventory/add-extra-stock - legacy route (disabled in simplified stock model)
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      {
        error:
          'Extra karat stock feature is disabled in the simplified stock model (only admin, karigar loss, customer stocks are used).'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in add-extra-stock API:', error)
    return NextResponse.json(
      { error: 'Failed to handle extra stock request' },
      { status: 500 }
    )
  }
}
