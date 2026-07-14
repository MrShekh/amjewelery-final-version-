'use client'

import { useState } from 'react'

interface OrderImageProps {
  src?: string | null
  alt?: string
  orderName?: string
  className?: string
  fallbackClassName?: string
}

const OrderImage: React.FC<OrderImageProps> = ({ 
  src, 
  alt = 'Order', 
  orderName = 'Order',
  className = "w-full h-full object-cover rounded-lg hover:scale-105 transition-transform duration-300",
  fallbackClassName = "w-full h-full flex items-center justify-center"
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [loading, setLoading] = useState(true)

  const handleImageLoad = () => {
    console.log('✅ Image loaded successfully:', src)
    setImageLoaded(true)
    setLoading(false)
  }

  const handleImageError = () => {
    console.log('❌ Image failed to load:', src)
    setImageError(true)
    setLoading(false)
  }

  if (!src) {
    return (
      <div className={`${fallbackClassName} bg-gray-50`}>
        <div className="text-center">
          <div className="text-6xl opacity-50">💍</div>
          <div className="text-xs text-gray-500 mt-2">No image</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className={`${fallbackClassName} bg-gray-100 absolute inset-0 z-10`}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <div className="text-xs text-gray-500 mt-2">Loading...</div>
          </div>
        </div>
      )}
      
      {imageError ? (
        <div className={`${fallbackClassName} bg-red-50`}>
          <div className="text-center">
            <div className="text-6xl opacity-50">💍</div>
            <div className="text-xs text-red-500 mt-2">Image not found</div>
            <div className="text-xs text-gray-400 mt-1">{orderName}</div>
          </div>
        </div>
      ) : (
        <>
          <img
            src={src}
            alt={alt}
            className={className}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ 
              opacity: imageLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out'
            }}
          />
          
          {imageLoaded && (
            <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded">
              📷
            </div>
          )}
        </>
      )}
      
      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded max-w-full overflow-hidden">
          <div className="truncate" title={src || 'No URL'}>
            {src ? src.substring(src.lastIndexOf('/') + 1) : 'No URL'}
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderImage
