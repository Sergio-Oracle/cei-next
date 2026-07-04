'use client'

import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      position:       'fixed',
      bottom:         0,
      left:           0,
      right:          0,
      zIndex:         9999,
      backgroundColor:'#92400e',
      color:          '#fef3c7',
      padding:        '10px 16px',
      display:        'flex',
      alignItems:     'center',
      gap:            '10px',
      fontSize:       '14px',
      fontWeight:     500,
    }}>
      <i className="fas fa-wifi-slash" aria-hidden="true" />
      <span>Vous êtes hors ligne. Certaines fonctionnalités sont indisponibles.</span>
    </div>
  )
}
