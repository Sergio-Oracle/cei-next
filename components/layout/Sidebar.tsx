'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface NavItem {
  label: string
  href: string
  icon: string
  exact?: boolean
}

type NavEntry = { divider: string } | NavItem

function isDivider(e: NavEntry): e is { divider: string } {
  return 'divider' in e
}

const adminNav: NavEntry[] = [
  { label: 'Dashboard',           href: '/dashboard/admin',                icon: 'fa-chart-line',      exact: true },
  { divider: 'Gestion' },
  { label: 'Utilisateurs',        href: '/dashboard/admin/users',          icon: 'fa-users' },
  { label: 'Maquette',            href: '/dashboard/admin/formations',     icon: 'fa-layer-group' },
  { label: 'Affectations EC',     href: '/dashboard/admin/affectations',   icon: 'fa-link' },
  { label: 'Groupes Surveillants',href: '/dashboard/admin/proctor-groups', icon: 'fa-user-shield' },
  { label: 'Inscriptions UE',     href: '/dashboard/admin/enrollments',    icon: 'fa-user-graduate' },
  { divider: 'Sujets & Examens' },
  { label: 'Générer Suggestions', href: '/dashboard/admin/suggestions',    icon: 'fa-magic' },
  { label: 'Créer Sujet',         href: '/dashboard/admin/create-subject', icon: 'fa-plus-circle' },
  { label: 'Sujets',              href: '/dashboard/admin/subjects',       icon: 'fa-file-alt' },
  { label: 'Examens en Ligne',    href: '/dashboard/admin/exams',          icon: 'fa-laptop-code' },
  { label: 'Historique Examens',  href: '/dashboard/admin/history',        icon: 'fa-history' },
  { label: 'Calendrier',          href: '/dashboard/admin/calendar',       icon: 'fa-calendar-alt' },
  { divider: 'Évaluations' },
  { label: 'Copies Corrigées',    href: '/dashboard/admin/papers',         icon: 'fa-check-circle' },
  { label: 'Relevés de Notes',    href: '/dashboard/admin/transcripts',    icon: 'fa-file-alt' },
  { label: 'Réclamations',        href: '/dashboard/admin/reclamations',   icon: 'fa-exclamation-triangle' },
  { divider: 'Administration' },
  { label: 'Banque questions',    href: '/dashboard/admin/questions',      icon: 'fa-database' },
  { label: 'Analytique',          href: '/dashboard/admin/analytics',      icon: 'fa-chart-bar' },
  { label: 'Sécurité',            href: '/dashboard/admin/security',       icon: 'fa-shield-alt' },
]

const professorNav: NavEntry[] = [
  { label: 'Dashboard',            href: '/dashboard/professor',                icon: 'fa-chart-line',    exact: true },
  { divider: 'Sujets & Examens' },
  { label: 'Générer Suggestions',  href: '/dashboard/professor/suggestions',    icon: 'fa-magic' },
  { label: 'Créer Sujet',          href: '/dashboard/professor/create-subject', icon: 'fa-plus-circle' },
  { label: 'Mes Sujets',           href: '/dashboard/professor/subjects',       icon: 'fa-book' },
  { label: 'Examens en Ligne',     href: '/dashboard/professor/exams',          icon: 'fa-laptop-code' },
  { divider: 'Corrections' },
  { label: 'Corriger Copies',             href: '/dashboard/professor/papers',             icon: 'fa-pencil-alt' },
  { label: 'Copies Corrigées',          href: '/dashboard/professor/corrected',          icon: 'fa-check-circle' },
  { label: 'Corriger Examens en Ligne', href: '/dashboard/professor/online-correction',  icon: 'fa-check-double' },
  { divider: 'Ressources' },
  { label: 'Banque de Questions',  href: '/dashboard/professor/questions',      icon: 'fa-database' },
  { label: 'Calendrier',           href: '/dashboard/professor/calendar',       icon: 'fa-calendar-alt' },
  { divider: 'Étudiants' },
  { label: 'Mes Étudiants',        href: '/dashboard/professor/students',       icon: 'fa-users' },
  { divider: 'Résultats' },
  { label: 'Résultats',            href: '/dashboard/professor/results',         icon: 'fa-chart-pie' },
  { label: 'Analytique',           href: '/dashboard/professor/analytics',       icon: 'fa-chart-bar' },
  { label: 'Relevés de Notes',     href: '/dashboard/professor/transcripts',    icon: 'fa-file-alt' },
  { label: 'Réclamations',         href: '/dashboard/professor/reclamations',   icon: 'fa-exclamation-triangle' },
  { label: 'Sécurité',             href: '/dashboard/professor/security',       icon: 'fa-shield-alt' },
  { label: 'Notifications',        href: '/dashboard/professor/notifications',  icon: 'fa-bell' },
]

const surveillantNav: NavEntry[] = [
  { label: 'Dashboard',    href: '/dashboard/surveillant',          icon: 'fa-tachometer-alt', exact: true },
  { divider: 'Surveillance' },
  { label: 'Mes Examens',  href: '/dashboard/surveillant/exams',    icon: 'fa-clipboard-list' },
  { label: 'Calendrier',   href: '/dashboard/surveillant/calendar', icon: 'fa-calendar-alt' },
]

const studentNav: NavEntry[] = [
  { label: 'Mes Notes',            href: '/dashboard/student',                icon: 'fa-chart-bar',       exact: true },
  { divider: 'Examens' },
  { label: 'Mes Examens en Ligne', href: '/dashboard/student/exams',          icon: 'fa-laptop-code' },
  { label: 'Planning',             href: '/dashboard/student/planning',       icon: 'fa-calendar-alt' },
  { divider: 'Résultats' },
  { label: 'Mes Relevés',          href: '/dashboard/student/transcripts',    icon: 'fa-file-alt' },
  { label: 'Mes Réclamations',     href: '/dashboard/student/reclamations',   icon: 'fa-exclamation-circle' },
  { divider: 'Aide' },
  { label: 'Aide',                 href: '/dashboard/student/aide',           icon: 'fa-question-circle' },
]

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname()
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link
      href={item.href}
      className={`nav-tab${active ? ' active' : ''}`}
      title={collapsed ? item.label : undefined}
    >
      <i className={`fas ${item.icon}`} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed') === '1'
    setCollapsed(saved)
    const theme = localStorage.getItem('theme')
    if (theme === 'dark') document.body.classList.add('theme-dark')
    else document.body.classList.remove('theme-dark')
  }, [])

  // Retour #11 — indicateur "il reste des options non affichées" quand le
  // menu déborde verticalement (remplace le défilement horizontal peu
  // visible par un dégradé + re-calculé à chaque changement de taille)
  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return
    const check = () => setHasOverflow(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [collapsed])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', next ? '1' : '0')
  }

  const navItems: NavEntry[] =
    user?.role === 'admin'       ? adminNav :
    user?.role === 'professor'   ? professorNav :
    user?.role === 'surveillant' ? surveillantNav :
    studentNav

  return (
    <>
      <div
        id="sidebar-overlay"
        className={open ? 'visible' : ''}
        onClick={onClose}
      />
      <div ref={sidebarRef} className={`sidebar${collapsed ? ' collapsed' : ''}${open ? ' open' : ''}${hasOverflow ? ' has-overflow' : ''}`}>
        <button
          className="sidebar-collapse-btn"
          onClick={toggleCollapse}
          title={collapsed ? 'Développer' : 'Réduire'}
        >
          <i className="fas fa-chevron-left" />
        </button>

        <nav className="nav-tabs">
          {navItems.map((entry, i) =>
            isDivider(entry)
              ? <div key={`div-${i}`} className="nav-divider">{entry.divider}</div>
              : <NavLink key={entry.href} item={entry} collapsed={collapsed} />
          )}
        </nav>
        <div className="sidebar-scroll-fade">
          <i className="fas fa-chevron-down" style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#94a3b8' }} />
        </div>
      </div>
    </>
  )
}
