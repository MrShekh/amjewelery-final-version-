import { NextRequest, NextResponse } from 'next/server'
import { getKarigarsCollection, getRecoveryHistoryCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

// GET /api/karigars/[id]/recovery-history - Get recovery history for karigar
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
    const recoveryHistoryCol = await getRecoveryHistoryCollection()
    
    // Check if karigar exists (we only need to confirm, not use its embedded history)
    const karigar = await karigarsCol.findOne({ _id: new ObjectId(id) }, { projection: { name: 1 } })
    if (!karigar) {
      return NextResponse.json(
        { error: 'Karigar not found' },
        { status: 404 }
      )
    }
    
    // Get recovery history ONLY from the dedicated collection.
    // Ignore any old embedded recoveryHistory array on the karigar document,
    // so cleared/empty DB state is respected.
    const recoveryHistoryFromCol = await recoveryHistoryCol.find(
      { karigarId: id },
      { 
        sort: { createdAt: -1 } // Most recent first
      }
    ).toArray()

    console.log('🔍 Recovery history from collection only:', {
      karigarId: id,
      records: recoveryHistoryFromCol.length
    })
    
    const recoveryHistory = recoveryHistoryFromCol
    
    // Format the recovery history for frontend
    const formattedHistory = recoveryHistory.map(record => {
      // Handle both collection records and karigar.recoveryHistory array items
      const isFromKarigarArray = !record.karigarId // karigar array items don't have karigarId
      
      const baseData = {
        id: record._id ? record._id.toString() : `session-${Date.now()}-${Math.random()}`,
        date: record.createdAt || record.date || new Date(),
        totalRecoveryAmount: record.totalRecoveryAmount || (record.makingCharge || 0) + (record.recoveredAmount || 0),
        makingCharge: record.makingCharge || 0,
        actualRecoveryAmount: record.actualRecoveryAmount || record.recoveredAmount || 0,
        remainingBalance: record.remainingBalance || 0,
        processTypes: record.processTypes || [],
        recoveryType: record.recoveryType || 'MANUAL',
        description: record.description || '',
        fineGoldRecovered: record.fineGoldRecovered || 0
      }
      
      // Handle karat information
      let karat = record.karat || record.karatLabel
      let karatPurity = record.karatPurity
      
      if (!karat && karatPurity) {
        // Convert purity to karat label
        if (karatPurity === 92) karat = '22k'
        else if (karatPurity === 75.5 || karatPurity === 75) karat = '18k' 
        else if (karatPurity === 80) karat = '19.2k'
        else if (karatPurity === 59) karat = '14.2k'
        else if (karatPurity === 37.5) karat = '9k'
        else karat = '22k' // default
      }
      
      if (!karatPurity && karat) {
        // Convert karat label to purity
        if (karat === '22k') karatPurity = 92
        else if (karat === '18k') karatPurity = 75.5
        else if (karat === '19.2k') karatPurity = 80
        else if (karat === '14.2k') karatPurity = 59
        else if (karat === '9k') karatPurity = 37.5
        else karatPurity = 92 // default
      }
      
      return {
        ...baseData,
        karat: karat || '22k',
        karatLabel: karat || '22k',
        karatPurity: karatPurity || 92
      }
    })
    
    return NextResponse.json({
      success: true,
      karigarName: karigar.name,
      recoveryHistory: formattedHistory,
      totalRecords: formattedHistory.length
    })
  } catch (error) {
    console.error('Error fetching recovery history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recovery history' },
      { status: 500 }
    )
  }
}
