import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { sessionStore } from '@/lib/session-store'

// POST /api/session - Register a new session (laptop)
export async function POST(request: NextRequest) {
  try {
    const sessionId = randomUUID()
    
    // Register this session using sessionStore
    sessionStore.register(sessionId)
    
    return NextResponse.json({ 
      sessionId,
      message: 'Session registered successfully'
    })

  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}

// GET /api/session?sessionId=xxx - Check for pending orders and keep session alive
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    // Get pending orders using sessionStore
    const pendingOrders = sessionStore.getPendingOrders(sessionId)
    
    if (pendingOrders.length === 0 && !sessionStore.get(sessionId)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    return NextResponse.json({ 
      sessionId,
      pendingOrders,
      hasOrders: pendingOrders.length > 0
    })

  } catch (error) {
    console.error('Error checking session:', error)
    return NextResponse.json({ error: 'Failed to check session' }, { status: 500 })
  }
}

// PUT /api/session - Update session (keep alive)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body
    
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    // Ping session to keep alive
    const updated = sessionStore.ping(sessionId)
    
    if (!updated) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    return NextResponse.json({ 
      sessionId,
      message: 'Session updated'
    })

  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

// DELETE /api/session?sessionId=xxx - Remove session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    // Remove session using sessionStore
    const removed = sessionStore.remove(sessionId)
    
    return NextResponse.json({ 
      success: removed,
      message: removed ? 'Session removed' : 'Session not found'
    })

  } catch (error) {
    console.error('Error removing session:', error)
    return NextResponse.json({ error: 'Failed to remove session' }, { status: 500 })
  }
}
