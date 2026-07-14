import { NextResponse } from 'next/server'
import { getOrdersCollection } from '@/lib/mongodb'

export async function GET() {
  try {
    // Test database connection
    const ordersCol = await getOrdersCollection()
    await ordersCol.findOne({}, { projection: { _id: 1 } })
    
    // Check environment variables
    const requiredEnvVars = {
      MONGODB_URI: !!process.env.MONGODB_URI,
      NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
      NODE_ENV: process.env.NODE_ENV,
    }
    
    const missingEnvVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => key !== 'NODE_ENV' && !value)
      .map(([key]) => key)
    
    if (missingEnvVars.length > 0) {
      return NextResponse.json(
        {
          status: 'warning',
          message: 'Some environment variables are missing',
          missingEnvVars,
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      )
    }
    
    return NextResponse.json({
      status: 'healthy',
      message: 'API is working correctly',
      environment: process.env.NODE_ENV,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      databaseConnected: true,
      timestamp: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
