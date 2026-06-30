'use client'

import { useEffect } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
}

export default function Modal({ title, onClose, children, maxWidth = 600 }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="modal"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-content" style={{ maxWidth, width: '100%', margin: '5% auto' }}>
        <button className="modal-close" onClick={onClose}>
          <i className="fa-solid fa-times" />
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
