'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Ferme le menu mobile à chaque changement de page
  useEffect(() => { setSidebarOpen(false) }, [pathname])

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
      <Header onToggleSidebar={() => setSidebarOpen(o => !o)} />
      <div id="app-body">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content">{children}</main>
      </div>
    </>
  )
}
