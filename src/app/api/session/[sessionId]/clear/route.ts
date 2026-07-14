import { NextRequest, NextResponse } from 'next/server'
import { sessionStore } from '@/lib/session-store'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const body = await request.json()
    const { orderIds } = body

    if (!sessionId || !orderIds || !Array.isArray(orderIds)) {
      return NextResponse.json({
        success: false,
        error: 'sessionId and orderIds array required'
      }, { status: 400 })
    }

    // Get current session
    const session = sessionStore.get(sessionId)
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 })
    }

    // Remove specified order IDs from pending orders
    orderIds.forEach((orderId: string) => {
      const index = session.pendingOrders.indexOf(orderId)
      if (index > -1) {
        session.pendingOrders.splice(index, 1)
      }
    })

    // Update session last ping
    sessionStore.ping(sessionId)

    return NextResponse.json({
      success: true,
      message: `Cleared ${orderIds.length} orders from session`,
      remainingOrders: session.pendingOrders.length
    })

  } catch (error) {
    console.error('Error clearing session orders:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to clear session orders'
    }, { status: 500 })
  }
}
