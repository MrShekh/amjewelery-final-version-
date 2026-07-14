import { NextRequest, NextResponse } from 'next/server'
import { getCustomerJamaBalancesCollection, getInventoryCollection, getGoldTransactionsCollection, getCustomersCollection, getUsersCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

// GET /api/jama-gold - Disabled in simplified model (customer gold concept removed)
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      {
        error:
          'Jama gold feature is disabled in the simplified stock model. Customer gold is no longer tracked.'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error fetching jama gold balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jama gold balances' },
      { status: 500 }
    )
  }
}

// POST /api/jama-gold - Disabled in simplified model
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      {
        error: 'Jama gold feature is disabled in the simplified stock model.'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error adding jama gold:', error)
    return NextResponse.json(
      { error: 'Failed to add jama gold' },
      { status: 500 }
    )
  }
}

// PUT /api/jama-gold - Disabled in simplified model
export async function PUT(request: NextRequest) {
  try {
    return NextResponse.json(
      {
        error: 'Jama gold feature is disabled in the simplified stock model.'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error processing jama gold return:', error)
    return NextResponse.json(
      { error: 'Failed to process jama gold return' },
      { status: 500 }
    )
  }
}
