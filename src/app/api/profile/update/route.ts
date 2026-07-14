import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  businessName: string
  role: string
  password?: string
  isActive: boolean
}

export async function PUT(request: NextRequest) {
  try {
    // Get the authorization header
    const authorization = request.headers.get('authorization')
    if (!authorization) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    // Extract token from Bearer authorization
    const token = authorization.split(' ')[1]
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 401 })
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any
    if (!decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get the request body
    const body = await request.json()
    const { firstName, lastName, phone, businessName } = body

    // Validate required fields
    if (!firstName || !lastName || !businessName) {
      return NextResponse.json({ 
        error: 'First name, last name, and business name are required' 
      }, { status: 400 })
    }

    // Read users from file
    let users: User[] = []
    if (fs.existsSync(USERS_FILE)) {
      const usersData = fs.readFileSync(USERS_FILE, 'utf8')
      users = JSON.parse(usersData)
    } else {
      return NextResponse.json({ error: 'Users database not found' }, { status: 500 })
    }

    // Find the user
    const userIndex = users.findIndex(u => u.id === decoded.userId)
    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user data
    users[userIndex] = {
      ...users[userIndex],
      firstName,
      lastName,
      phone: phone || users[userIndex].phone,
      businessName
    }

    // Save updated users to file
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))

    // Return updated user (without password)
    const updatedUser = { ...users[userIndex] }
    delete updatedUser.password

    return NextResponse.json({ 
      message: 'Profile updated successfully',
      user: updatedUser
    })

  } catch (error) {
    console.error('Profile update error:', error)
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
