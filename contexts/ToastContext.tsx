'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'
interface Toast { id: number; type: ToastType; message: string }

interface ToastCtx {
  toasts: Toast[]
  showToast: (msg: string, type?: ToastType, duration?: number) => void
  success: (msg: string) => void
  error:   (msg: string) => void
  warning: (msg: string) => void
  info:    (msg: string) => void
}

const ToastContext = createContext<ToastCtx | null>(null)
let _id = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const success = useCallback((msg: string) => showToast(msg, 'success'), [showToast])
  const error   = useCallback((msg: string) => showToast(msg, 'error', 5000), [showToast])
  const warning = useCallback((msg: string) => showToast(msg, 'warning'), [showToast])
  const info    = useCallback((msg: string) => showToast(msg, 'info'), [showToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info }}>
      {children}
      {/* Toast container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`} onClick={() => dismiss(t.id)}>
            <i className={`fa-solid fa-${t.type === 'success' ? 'check-circle' : t.type === 'error' ? 'circle-xmark' : t.type === 'warning' ? 'triangle-exclamation' : 'circle-info'}`} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
