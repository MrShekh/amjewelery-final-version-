'use client'

import React, { useState, useEffect } from 'react'

interface WhatsAppStatus {
  connected: boolean
  status: string
  phone?: string
  isReady: boolean
}

interface SendWhatsAppButtonProps {
  billId: string
  customerName?: string
  customerPhone?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const SendWhatsAppButton: React.FC<SendWhatsAppButtonProps> = ({ 
  billId, 
  customerName, 
  customerPhone, 
  className = '',
  size = 'md'
}) => {
  const [sending, setSending] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null)
  const [statusChecked, setStatusChecked] = useState(false)

  // Check WhatsApp status
  const checkWhatsAppStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp/status')
      const data = await response.json()
      setWhatsappStatus(data)
    } catch (error) {
      console.error('Error checking WhatsApp status:', error)
      setWhatsappStatus({ connected: false, status: 'error', isReady: false })
    } finally {
      setStatusChecked(true)
    }
  }

  useEffect(() => {
    checkWhatsAppStatus()
    // Check status every 30 seconds
    const interval = setInterval(checkWhatsAppStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const sendBillViaWhatsApp = async () => {
    if (!whatsappStatus?.isReady) {
      alert('WhatsApp is not connected. Please connect WhatsApp first.')
      return
    }

    setSending(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/whatsapp/send-bill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : ''
        },
        body: JSON.stringify({ billId })
      })

      const result = await response.json()

      if (response.ok) {
        alert(`✅ Bill sent successfully to ${result.customerName}!\n\n📱 Sent to: ${result.phone}\n📄 Message includes PDF attachment`)
      } else {
        if (result.whatsappError && result.error.includes('not connected')) {
          alert(`❌ WhatsApp not connected!\n\nPlease open: http://localhost:5001/qr\nScan the QR code to connect WhatsApp.`)
        } else {
          alert(`❌ Failed to send bill: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('Error sending bill:', error)
      alert('❌ Failed to send bill. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4', 
    lg: 'w-5 h-5'
  }

  if (!statusChecked) {
    return (
      <button
        disabled
        className={`inline-flex items-center space-x-2 ${sizeClasses[size]} bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed ${className}`}
      >
        <div className={`animate-spin rounded-full border-2 border-gray-400 border-t-transparent ${iconSizes[size]}`}></div>
        <span>Checking...</span>
      </button>
    )
  }

  if (!whatsappStatus?.connected) {
    return (
      <button
        onClick={() => {
          alert('WhatsApp not connected!\n\nTo connect WhatsApp:\n1. Open: http://localhost:5001/qr\n2. Scan QR code with your phone\n3. Return here to send bills')
          window.open('http://localhost:5001/qr', '_blank')
        }}
        className={`inline-flex items-center space-x-2 ${sizeClasses[size]} bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg font-medium transition-colors ${className}`}
      >
        <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.687"/>
        </svg>
        <span>Connect WhatsApp</span>
      </button>
    )
  }

  return (
    <button
      onClick={sendBillViaWhatsApp}
      disabled={sending}
      className={`inline-flex items-center space-x-2 ${sizeClasses[size]} ${
        sending 
          ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
          : 'bg-green-600 hover:bg-green-700 text-white'
      } rounded-lg font-medium transition-colors ${className}`}
    >
      {sending ? (
        <>
          <div className={`animate-spin rounded-full border-2 border-white border-t-transparent ${iconSizes[size]}`}></div>
          <span>Sending...</span>
        </>
      ) : (
        <>
          <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.687"/>
          </svg>
          <span>Send WhatsApp</span>
        </>
      )}
    </button>
  )
}

export default SendWhatsAppButton
