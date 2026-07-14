'use client'

import ProcessManager from './ProcessManager'

interface OrderProcessPageProps {
  orderId: string
}

// This component now uses the ProcessManager which implements
// the separated workflow for starting and completing processes
const OrderProcessPage: React.FC<OrderProcessPageProps> = ({ orderId }) => {
  // Use ProcessManager component which implements the separated workflow
  return <ProcessManager orderId={orderId} />
}

export default OrderProcessPage
