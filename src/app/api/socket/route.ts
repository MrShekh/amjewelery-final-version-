import { NextRequest, NextResponse } from 'next/server'
import { Server as SocketIOServer } from 'socket.io'
import { Server as NetServer } from 'http'

// Global socket instance
let io: SocketIOServer | null = null

// GET handler for Socket.IO server initialization
export async function GET(req: NextRequest) {
  if (!io) {
    console.log('Initializing Socket.IO server...')
    
    // In Next.js API routes, we need to create socket server differently
    // We'll use a singleton pattern to ensure only one instance
    const httpServer = (global as any).httpServer || null
    
    if (!httpServer) {
      return NextResponse.json({ error: 'HTTP server not available' }, { status: 500 })
    }
    
    io = new SocketIOServer(httpServer, {
      path: '/api/socket',
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    })

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)
      
      // Join a room for this session (could be laptop's session)
      socket.on('join-session', (sessionId: string) => {
        console.log(`Client ${socket.id} joined session: ${sessionId}`)
        socket.join(sessionId)
      })
      
      // Handle order scan events
      socket.on('order-scanned', (data: { orderId: string, sessionId: string }) => {
        console.log('Order scanned:', data)
        // Emit to all clients in the session room
        io?.to(data.sessionId).emit('open-order', data.orderId)
      })
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })
    
    console.log('Socket.IO server initialized')
  }

  return NextResponse.json({ message: 'Socket.IO server running' })
}
