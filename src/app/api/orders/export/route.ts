import { NextRequest, NextResponse } from 'next/server'
import { getOrdersCollection, getUsersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let payload
    try {
      payload = verifyToken(token)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({
      _id: new ObjectId(payload.userId),
      isActive: true
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const dateFilter = searchParams.get('dateFilter') || 'all'
    const monthFilter = searchParams.get('monthFilter')

    // Build filter query
    const filter: Record<string, any> = {}

    // Apply search
    if (search) {
      const searchRegex = new RegExp(search, 'i')
      filter.$or = [
        { orderName: { $regex: searchRegex } },
        { orderNumber: { $regex: searchRegex } },
      ]
    }

    // Apply date or month filter
    if (monthFilter && monthFilter !== 'all') {
      const [yearStr, monthStr] = monthFilter.split('-')
      const year = Number(yearStr)
      const month = Number(monthStr) || 1
      const startDate = new Date(Date.UTC(year, month - 1, 1, -5, -30))
      const endDate = new Date(Date.UTC(year, month, 1, -5, -30))
      filter.createdAt = { $gte: startDate, $lt: endDate }
    } else if (dateFilter !== 'all') {
      const now = new Date()
      let startDate: Date | null = null

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now)
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate = new Date(now)
          startDate.setMonth(now.getMonth() - 1)
          break
      }

      if (startDate) {
        filter.createdAt = { $gte: startDate }
      }
    }

    const ordersCol = await getOrdersCollection()
    const orders = await ordersCol.find(filter).sort({ createdAt: -1 }).toArray()

    // Prepare data for Excel
    const rows = orders.map((order, index) => ({
      "Sr No.": index + 1,
      "Bag Number": order.orderNumber || "",
      "Karat (KT)": order.selectedKarat ? `${order.selectedKarat}%` : "",
      "Order Name": order.orderName || "",
      "Filling In (g)": order.fillingIn || 0,
      "Finish Weight (g)": order.finishWeight || 0,
      "Date": order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN") : "",
    }))

    // Calculate totals
    const totals: any = {
      "Sr No.": "",
      "Bag Number": "",
      "Karat (KT)": "",
      "Order Name": "TOTAL",
      "Filling In (g)": 0,
      "Finish Weight (g)": 0,
      "Date": "",
    }

    orders.forEach((order) => {
      totals["Filling In (g)"] += order.fillingIn || 0
      totals["Finish Weight (g)"] += order.finishWeight || 0
    })

    // Round totals
    Object.keys(totals).forEach((key) => {
      if (typeof totals[key] === "number") {
        totals[key] = parseFloat(totals[key].toFixed(3))
      }
    })

    rows.push(totals)

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(rows)

    // Set column widths
    ws["!cols"] = [
      { wch: 6 },  // Sr No.
      { wch: 14 }, // Bag Number
      { wch: 10 }, // Karat (KT)
      { wch: 20 }, // Order Name
      { wch: 14 }, // Filling In
      { wch: 14 }, // Finish Weight
      { wch: 12 }, // Date
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Production Register")

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    const today = new Date().toISOString().split("T")[0]
    const filename = `Production_Register_${today}.xlsx`

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting orders:', error)
    return NextResponse.json({ error: 'Failed to export orders' }, { status: 500 })
  }
}
