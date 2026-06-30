'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner" />
        <p>Chargement…</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <>
      <Header />
      <div id="app-body">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
    </>
  )
}
