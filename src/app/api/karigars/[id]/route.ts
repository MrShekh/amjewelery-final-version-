import { NextRequest, NextResponse } from 'next/server'
import { getKarigarsCollection, getManufacturingProcessesCollection, getOrdersCollection, getCustomersCollection } from '@/lib/mongodb'
import { toClientFormat } from '@/types/mongodb'
import { ObjectId } from 'mongodb'

// GET /api/karigars/[id] - Get karigar by ID with detailed process and order information
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid karigar ID' },
        { status: 400 }
      )
    }
    
    const karigarsCol = await getKarigarsCollection()
    const processesCol = await getManufacturingProcessesCollection()
    const ordersCol = await getOrdersCollection()
    const customersCol = await getCustomersCollection()
    
    // Get the karigar
    const karigar = await karigarsCol.findOne({ _id: new ObjectId(id) })
    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }
    
    // Get all processes for this karigar with enhanced details
    const processes = await processesCol.find(
      { karigarId: karigar._id.toString() },
      {
        projection: {
          _id: 1,
          processType: 1,
          inputWeight: 1,
          outputWeight: 1,
          goldLoss: 1,
          goldRecovered: 1,
          karigarMakingCharge: 1,
          isFullyRecovered: 1,
          adminRecoverable: 1,
          sequence: 1,
          createdAt: 1,
          orderId: 1,
          // Include stone data for STONE_SETTING processes
          adStonesAdded: 1,
          kalesStonesAdded: 1
        }
      }
    ).sort({ createdAt: -1 }).toArray()

    // Optimize: fetch all related orders in one query instead of per-process
    const validOrderIds = Array.from(new Set(
      processes
        .map(p => p.orderId)
        .filter(id => id && ObjectId.isValid(id))
        .map(id => new ObjectId(id))
    ))

    const orders = validOrderIds.length > 0
      ? await ordersCol.find(
          { _id: { $in: validOrderIds } },
          {
            projection: {
              _id: 1,
              orderNumber: 1,
              orderName: 1,
              orderPhoto: 1,
              orderType: 1,
              status: 1,
              totalGoldUsed: 1,
              finalJewelryWeight: 1,
              selectedKarat: 1,
              createdAt: 1,
              customerId: 1
            }
          }
        ).toArray()
      : []

    const ordersMap = new Map<string, any>()
    orders.forEach((order) => {
      ordersMap.set(order._id.toString(), order)
    })

    // Fetch all related customers in one query
    const customerIds = Array.from(new Set(
      orders
        .map(order => order.customerId)
        .filter(id => id && ObjectId.isValid(id))
        .map(id => new ObjectId(id))
    ))

    const customers = customerIds.length > 0
      ? await customersCol.find(
          { _id: { $in: customerIds } },
          { projection: { name: 1, phone: 1, email: 1 } }
        ).toArray()
      : []

    const customersMap = new Map<string, any>()
    customers.forEach((customer) => {
      customersMap.set(customer._id.toString(), customer)
    })

    // Attach order + customer data to each process without extra DB round-trips
    const processesWithDetails = processes.map((process) => {
      let order: any | null = null
      if (process.orderId && ObjectId.isValid(process.orderId)) {
        order = ordersMap.get(new ObjectId(process.orderId).toString()) || null
      }

      if (order) {
        const customer = customersMap.get(order.customerId?.toString()) || null

        const orderData = {
          ...toClientFormat(order),
          orderName: order.orderName || 'Unnamed Order',
          orderPhoto: order.orderPhoto || null,
          orderType: order.orderType || 'Unknown',
          status: order.status || 'Unknown',
          totalGoldUsed: order.totalGoldUsed || 0,
          finalJewelryWeight: order.finalJewelryWeight || 0,
          customer: customer
            ? {
                name: customer.name || 'Unknown Customer',
                phone: customer.phone || null,
                email: customer.email || null
              }
            : {
                name: 'Unknown Customer',
                phone: null,
                email: null
              }
        }

        return {
          ...toClientFormat(process),
          order: orderData
        }
      }

      return {
        ...toClientFormat(process),
        order: null
      }
    })

    const karigarWithDetails = {
      ...toClientFormat(karigar),
      processes: processesWithDetails
    }

    return NextResponse.json({ karigar: karigarWithDetails })
  } catch (error) {
    console.error('Error fetching karigar details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch karigar details' },
      { status: 500 }
    )
  }
}

// PUT /api/karigars/[id] - Update karigar
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid karigar ID' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const { name, phone, specialty } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Karigar name is required' },
        { status: 400 }
      )
    }

    const karigarsCol = await getKarigarsCollection()
    
    // Check if karigar exists
    const existingKarigar = await karigarsCol.findOne({ _id: new ObjectId(id) })
    if (!existingKarigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }
    
    // Check for existing phone (if changed)
    if (phone && phone !== existingKarigar.phone) {
      const duplicatePhone = await karigarsCol.findOne({ 
        phone, 
        _id: { $ne: new ObjectId(id) } 
      })
      if (duplicatePhone) {
        return NextResponse.json(
          { error: 'Phone number already exists' },
          { status: 400 }
        )
      }
    }

    const updateData = {
      name,
      phone: phone || undefined,
      specialty: specialty || undefined,
      updatedAt: new Date()
    }

    await karigarsCol.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    const updatedKarigar = await karigarsCol.findOne({ _id: new ObjectId(id) })

    return NextResponse.json({ 
      karigar: toClientFormat(updatedKarigar!),
      message: 'Karigar updated successfully'
    })
  } catch (error) {
    console.error('Error updating karigar:', error)
    return NextResponse.json(
      { error: 'Failed to update karigar' },
      { status: 500 }
    )
  }
}

// DELETE /api/karigars/[id] - Delete karigar
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid karigar ID' },
        { status: 400 }
      )
    }
    
    const karigarsCol = await getKarigarsCollection()
    const processesCol = await getManufacturingProcessesCollection()
    
    // Check if karigar exists
    const karigar = await karigarsCol.findOne({ _id: new ObjectId(id) })
    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }
    
    // Check if karigar has any processes
    const processCount = await processesCol.countDocuments({ karigarId: id })
    if (processCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete karigar with existing work history' },
        { status: 400 }
      )
    }
    
    await karigarsCol.deleteOne({ _id: new ObjectId(id) })

    return NextResponse.json({ 
      message: 'Karigar deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting karigar:', error)
    return NextResponse.json(
      { error: 'Failed to delete karigar' },
      { status: 500 }
    )
  }
}
