'use client'

import { useEffect } from 'react'
import { isMoodleReturn, setLtiReturn } from '@/lib/ltiReturn'

/* Page de passage après un clic sur l'activité « CEI » dans Moodle.
   1re visite : retient l'adresse de retour vers Moodle puis ouvre le tableau
   de bord (nouvelle entrée d'historique). Si l'on revient ici avec la flèche
   « Retour » du navigateur, on repart directement dans Moodle, sans repasser
   par la chaîne de lancement LTI (qui relancerait CEI). */

export default function LtiEnterPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const to = params.get('to') || '/dashboard'
    const back = params.get('back')
    const key = `cei_lti_enter_${params.get('k') || ''}`
    const go = () => {
      let done = false
      try { done = sessionStorage.getItem(key) === '1' } catch {}
      if (done) {
        window.location.replace(isMoodleReturn(back) ? back : to)
        return
      }
      try { sessionStorage.setItem(key, '1') } catch {}
      if (isMoodleReturn(back)) setLtiReturn(back)
      window.location.assign(to.startsWith('/') ? to : '/dashboard')
    }
    // Première visite de CEI sur cet appareil : le service worker (mode hors
    // ligne) s'installe et recharge la page qu'il prend en charge. On attend
    // qu'il ait pris le contrôle AVANT d'ouvrir le tableau de bord, sinon ce
    // rechargement tomberait sur le tableau de bord pendant l'ouverture de la
    // session (deux rafraîchissements de session concurrents → déconnexion).
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
    if (sw && !sw.controller) {
      let started = false
      const start = () => { if (!started) { started = true; go() } }
      sw.addEventListener('controllerchange', start, { once: true })
      setTimeout(start, 4000)   // navigateur sans SW actif, ou installation lente
    } else {
      go()
    }
    // Page restaurée depuis le cache du navigateur (flèche Retour) : le script
    // ne se relance pas tout seul.
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) go() }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 16 }}>
      <i className="fas fa-spinner fa-spin" style={{ marginRight: 10 }} /> Ouverture de CEI…
    </div>
  )
}
