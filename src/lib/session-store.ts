// Shared session store to manage active sessions across API routes
interface SessionData {
  sessionId: string
  lastPing: Date
  pendingOrders: string[]
}

class SessionStore {
  private sessions = new Map<string, SessionData>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up old sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  // Register a new session
  register(sessionId: string): SessionData {
    const sessionData: SessionData = {
      sessionId,
      lastPing: new Date(),
      pendingOrders: []
    }
    
    this.sessions.set(sessionId, sessionData)
    console.log(`Session registered: ${sessionId}`)
    
    return sessionData
  }

  // Get session by ID
  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId)
  }

  // Update session last ping (keep alive)
  ping(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastPing = new Date()
      return true
    }
    return false
  }

  // Add order to session's pending orders
  addPendingOrder(sessionId: string, orderId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.pendingOrders.push(orderId)
      session.lastPing = new Date()
      console.log(`Added order ${orderId} to session ${sessionId}`)
      return true
    }
    return false
  }

  // Get and clear pending orders for a session
  getPendingOrders(sessionId: string): string[] {
    const session = this.sessions.get(sessionId)
    if (session) {
      const orders = [...session.pendingOrders]
      session.pendingOrders = []
      session.lastPing = new Date()
      return orders
    }
    return []
  }

  // Remove session
  remove(sessionId: string): boolean {
    const removed = this.sessions.delete(sessionId)
    if (removed) {
      console.log(`Session removed: ${sessionId}`)
    }
    return removed
  }

  // Get all session IDs (for debugging)
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys())
  }

  // Clean up expired sessions
  private cleanup(): void {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    let removedCount = 0
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastPing < fiveMinutesAgo) {
        this.sessions.delete(sessionId)
        removedCount++
      }
    }
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired sessions`)
    }
  }

  // Shutdown cleanup
  destroy(): void {
    clearInterval(this.cleanupInterval)
  }
}

// Create singleton instance
const sessionStore = new SessionStore()

export { sessionStore, type SessionData }
