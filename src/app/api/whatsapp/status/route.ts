import { NextRequest, NextResponse } from 'next/server'

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001'

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${WHATSAPP_SERVICE_URL}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'WhatsApp service not available', connected: false },
        { status: 503 }
      )
    }

    const data = await response.json()
    return NextResponse.json({
      connected: data.status === 'connected',
      status: data.status,
      phone: data.phone,
      isReady: data.isReady
    })

  } catch (error) {
    console.error('Error checking WhatsApp status:', error)
    return NextResponse.json(
      { error: 'Failed to connect to WhatsApp service', connected: false },
      { status: 503 }
    )
  }
}
