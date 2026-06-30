'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function DashboardRoot() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    if (user.role === 'admin')       router.replace('/dashboard/admin')
    else if (user.role === 'professor')   router.replace('/dashboard/professor')
    else if (user.role === 'student')     router.replace('/dashboard/student')
    else if (user.role === 'surveillant') router.replace('/dashboard/surveillant')
  }, [user, router])

  return (
    <div className="loader">
      <div className="spinner" />
      <p>Redirection…</p>
    </div>
  )
}
