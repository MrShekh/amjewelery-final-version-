import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ManagerGoldStock, ManagerGoldEntry } from '@/types/mongodb'
import { ObjectId } from 'mongodb'

// GET - Fetch manager gold stock
export async function GET(request: NextRequest) {
    try {
        const db = await getDb()
        const managerStockCollection = db.collection<ManagerGoldStock>('managerGoldStock')

        // Get or create manager stock document
        let managerStock = await managerStockCollection.findOne({})

        if (!managerStock) {
            // Initialize manager stock if it doesn't exist
            const newStock: ManagerGoldStock = {
                stock22k: 0,
                stock75k: 0,
                stock76k: 0,
                stock80k: 0,
                stock88k: 0,
                stock92k: 0,
                stock59k: 0,
                stock755k: 0,
                stock375k: 0,
                stock9k: 0,
                entries: [],
                lastUpdated: new Date(),
                createdAt: new Date()
            }

            const result = await managerStockCollection.insertOne(newStock as any)
            managerStock = { ...newStock, _id: result.insertedId }
        }

        // Convert _id to id for client
        const { _id, ...rest } = managerStock
        const response = { ...rest, id: _id.toString() }

        return NextResponse.json({
            success: true,
            data: response
        })
    } catch (error) {
        console.error('Error fetching manager stock:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch manager stock' },
            { status: 500 }
        )
    }
}

// POST - Add manual entry (Admin to Manager)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { date, karat, weight, description } = body

        if (!date || !karat || !weight) {
            return NextResponse.json(
                { success: false, error: 'Date, karat, and weight are required' },
                { status: 400 }
            )
        }

        const db = await getDb()
        const managerStockCollection = db.collection<ManagerGoldStock>('managerGoldStock')

        // Get or create manager stock
        let managerStock = await managerStockCollection.findOne({})

        if (!managerStock) {
            const newStock: ManagerGoldStock = {
                stock22k: 0,
                stock75k: 0,
                stock76k: 0,
                stock80k: 0,
                stock88k: 0,
                stock92k: 0,
                stock59k: 0,
                stock755k: 0,
                stock375k: 0,
                stock9k: 0,
                entries: [],
                lastUpdated: new Date(),
                createdAt: new Date()
            }

            const result = await managerStockCollection.insertOne(newStock as any)
            managerStock = { ...newStock, _id: result.insertedId }
        }

        // Create new entry
        const newEntry: ManagerGoldEntry = {
            _id: new ObjectId(),
            date: new Date(date),
            karat,
            weight,
            type: 'ADMIN_TO_MANAGER',
            description,
            createdAt: new Date()
        }

        // Update stock based on karat
        const stockField = `stock${karat}k` as keyof ManagerGoldStock
        const currentStock = (managerStock[stockField] as number) || 0
        const updatedStock = currentStock + weight

        // Update database
        await managerStockCollection.updateOne(
            { _id: managerStock._id },
            {
                $set: {
                    [stockField]: updatedStock,
                    lastUpdated: new Date()
                },
                $push: {
                    entries: newEntry as any
                }
            }
        )

        return NextResponse.json({
            success: true,
            message: 'Gold added to manager stock successfully'
        })
    } catch (error) {
        console.error('Error adding gold to manager stock:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to add gold to manager stock' },
            { status: 500 }
        )
    }
}

// DELETE - Clear all entries and download data
export async function DELETE(request: NextRequest) {
    try {
        const db = await getDb()
        const managerStockCollection = db.collection<ManagerGoldStock>('managerGoldStock')

        // Get current data before clearing
        const managerStock = await managerStockCollection.findOne({})

        if (!managerStock) {
            return NextResponse.json(
                { success: false, error: 'No manager stock found' },
                { status: 404 }
            )
        }

        // Reset all stocks to zero and clear entries
        await managerStockCollection.updateOne(
            { _id: managerStock._id },
            {
                $set: {
                    stock22k: 0,
                    stock75k: 0,
                    stock76k: 0,
                    stock80k: 0,
                    stock88k: 0,
                    stock92k: 0,
                    stock59k: 0,
                    stock755k: 0,
                    stock375k: 0,
                    stock9k: 0,
                    entries: [],
                    lastUpdated: new Date()
                }
            }
        )

        // Return the data that was cleared for download
        const { _id, ...rest } = managerStock
        return NextResponse.json({
            success: true,
            message: 'Manager stock cleared successfully',
            data: { ...rest, id: _id.toString() }
        })
    } catch (error) {
        console.error('Error clearing manager stock:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to clear manager stock' },
            { status: 500 }
        )
    }
}
