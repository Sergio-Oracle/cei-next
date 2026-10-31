'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type St = 'wait' | 'run' | 'ok' | 'warn' | 'ko'
interface Check { id: string; label: string; st: St; msg: string; help?: string }

const ICON: Record<St, { c: string; i: string }> = {
  wait: { c: '#94a3b8', i: 'fa-circle' }, run: { c: '#1d4ed8', i: 'fa-spinner fa-spin' },
  ok: { c: '#059669', i: 'fa-circle-check' }, warn: { c: '#b45309', i: 'fa-triangle-exclamation' }, ko: { c: '#b91c1c', i: 'fa-circle-xmark' },
}
const bridge = () => (typeof window !== 'undefined' ? (window as any).ceiClient : undefined)
const osName = () => { const u = navigator.userAgent; return /windows/i.test(u) ? 'windows' : /mac/i.test(u) ? 'mac' : 'linux' }

function mediaHelp(e: any): string {
  const os = osName()
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
    if (os === 'windows') return "Windows bloque l'accès : Paramètres, Confidentialité et sécurité, Caméra / Microphone, puis activez « Autoriser les applications de bureau à accéder à la caméra / au microphone »."
    if (os === 'mac') return "macOS a refusé : Réglages Système, Confidentialité et sécurité, Caméra / Microphone, cochez CEI Examen (ou votre navigateur), puis relancez l'application."
    return "L'accès a été refusé : autorisez la caméra et le micro quand la fenêtre le demande, puis relancez le test."
  }
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return "Aucun appareil trouvé : branchez la caméra / le micro, vérifiez qu'ils sont activés, puis relancez le test."
  if (e?.name === 'NotReadableError') return "L'appareil est déjà utilisé par un autre logiciel (Zoom, Teams, navigateur…) : fermez-le puis relancez le test."
  return "Vérifiez les branchements et les autorisations, puis relancez le test."
}

/** Test du poste avant un examen : caméra, micro, partage d'écran complet, connexion, visioconférence, écrans. Aucune donnée n'est enregistrée. */
export default function TestPostePage() {
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  const [checks, setChecks] = useState<Check[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [level, setLevel] = useState(0)
  const streams = useRef<MediaStream[]>([])

  const set = useCallback((id: string, label: string, st: St, msg = '', help?: string) =>
    setChecks(cs => { const i = cs.findIndex(c => c.id === id); const n = { id, label, st, msg, help }; if (i < 0) return [...cs, n]; const x = [...cs]; x[i] = n; return x }), [])

  const stopAll = () => { streams.current.forEach(s => s.getTracks().forEach(t => t.stop())); streams.current = [] }
  useEffect(() => stopAll, [])

  async function runAuto() {
    stopAll(); setChecks([]); setDone(false); setRunning(true)
    // 1. Application et système
    const c = bridge()
    if (c?.info) {
      const info = await c.info().catch(() => null)
      set('app', 'Application CEI Examen', 'ok', `Version ${info?.version ?? '?'} sur ${info?.platform ?? 'votre système'}${info?.vm ? ' — machine virtuelle détectée' : ''}`)
      if (info?.vm) set('app', 'Application CEI Examen', 'warn', `Version ${info.version} — une machine virtuelle a été détectée : elle sera signalée au surveillant. Utilisez votre ordinateur réel.`)
    } else set('app', 'Application CEI Examen', 'warn', 'Vous êtes dans un navigateur ordinaire.', "Pour les examens verrouillés, ouvrez ce test dans l'application CEI Examen (page de téléchargement du site).")

    // 2. Écrans
    const st = await c?.status?.().catch(() => null)
    const nb = st?.displays ?? (((window as any).screen?.isExtended) ? 2 : 1)
    const small = window.screen.width < 1024 || window.screen.height < 600
    set('screen', 'Écran', nb > 1 ? 'warn' : small ? 'warn' : 'ok',
      nb > 1 ? `${nb} écrans détectés` : `${window.screen.width} × ${window.screen.height}${small ? ' — écran petit' : ''}`,
      nb > 1 ? "Débranchez les écrans supplémentaires : ils seront masqués et signalés pendant l'examen." : small ? "Utilisez un écran d'au moins 1024 × 600." : undefined)
    if (st?.media) {
      const bad = ['camera', 'microphone'].filter(k => st.media[k] === 'denied')
      if (bad.length) set('os', 'Autorisations du système', 'ko', `Refusées : ${bad.map(k => (k === 'camera' ? 'caméra' : 'micro')).join(', ')}`, mediaHelp({ name: 'NotAllowedError' }))
      else if (osName() === 'mac' && st.media.screen && st.media.screen !== 'granted') set('os', 'Autorisations du système', 'warn', "L'enregistrement de l'écran n'est pas encore autorisé", "macOS : Réglages Système, Confidentialité et sécurité, Enregistrement de l'écran, cochez CEI Examen, puis relancez l'application. (La demande s'affiche au premier partage d'écran.)")
    }

    // 3. Caméra + micro
    set('cam', 'Caméra', 'run', 'Ouverture…'); set('mic', 'Microphone', 'run', 'Ouverture…')
    try { await c?.askMedia?.() } catch { /* sans effet hors macOS */ }
    let cam: MediaStream | null = null
    try {
      cam = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: { echoCancellation: true } })
      streams.current.push(cam)
      const v = cam.getVideoTracks()[0], a = cam.getAudioTracks()[0]
      const w = v?.getSettings().width || 0
      set('cam', 'Caméra', v?.readyState === 'live' ? (w >= 320 ? 'ok' : 'warn') : 'ko', v ? `${v.label || 'Caméra'} — ${w}×${v.getSettings().height}` : 'Aucune image', w && w < 320 ? 'Image de faible qualité : améliorez la caméra ou la lumière.' : undefined)
      if (videoRef.current) { videoRef.current.srcObject = new MediaStream([v]); videoRef.current.play().catch(() => {}) }
      // niveau sonore pendant 4 s : l'étudiant parle
      if (a) {
        const ctx = new AudioContext(), src = ctx.createMediaStreamSource(new MediaStream([a])), an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an)
        const buf = new Uint8Array(an.frequencyBinCount); let peak = 0
        set('mic', 'Microphone', 'run', 'Dites quelques mots à voix normale…')
        const t0 = performance.now()
        await new Promise<void>(res => { const tick = () => { an.getByteTimeDomainData(buf); const m = Math.max(...buf.map(x => Math.abs(x - 128))) / 128; peak = Math.max(peak, m); setLevel(m); if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else res() }; tick() })
        ctx.close().catch(() => {})
        set('mic', 'Microphone', peak > 0.04 ? 'ok' : 'warn', peak > 0.04 ? `${a.label || 'Micro'} — signal reçu` : 'Aucun son entendu', peak > 0.04 ? undefined : "Parlez plus fort, vérifiez que le micro n'est pas coupé (bouton ou réglage du système) et que le bon micro est choisi.")
      } else set('mic', 'Microphone', 'ko', 'Aucun micro', mediaHelp({ name: 'NotFoundError' }))
    } catch (e: any) {
      set('cam', 'Caméra', 'ko', `Impossible d'ouvrir la caméra ou le micro (${e?.name || 'erreur'})`, mediaHelp(e)); set('mic', 'Microphone', 'ko', 'Non testé', mediaHelp(e))
    }

    // 4. Visioconférence : transmission WebRTC
    set('rtc', 'Visioconférence (transmission vidéo)', 'run', 'Essai…')
    try {
      const a = new RTCPeerConnection(), b = new RTCPeerConnection()
      a.onicecandidate = e => e.candidate && b.addIceCandidate(e.candidate); b.onicecandidate = e => e.candidate && a.addIceCandidate(e.candidate)
      const trk = cam?.getVideoTracks()[0]
      if (!trk) throw new Error('pas de caméra')
      a.addTrack(trk, cam!)
      const got = new Promise<boolean>(r => { b.ontrack = () => r(true); setTimeout(() => r(false), 9000) })
      await a.setLocalDescription(await a.createOffer()); await b.setRemoteDescription(a.localDescription!)
      await b.setLocalDescription(await b.createAnswer()); await a.setRemoteDescription(b.localDescription!)
      const ok = await got; await new Promise(r => setTimeout(r, 1200))
      let sent = 0; (await a.getStats()).forEach(r => { if (r.type === 'outbound-rtp' && r.kind === 'video') sent = r.bytesSent || 0 })
      a.close(); b.close()
      set('rtc', 'Visioconférence (transmission vidéo)', ok && sent > 500 ? 'ok' : 'ko', ok && sent > 500 ? 'La vidéo est bien transmise' : 'La vidéo ne passe pas', 'Désactivez un éventuel VPN ou un logiciel de sécurité qui bloque la visioconférence, puis relancez le test.')
    } catch { set('rtc', 'Visioconférence (transmission vidéo)', 'warn', 'Non testée (caméra indisponible)') }

    // 5. Connexion au serveur : délai + débit
    set('net', 'Connexion à la plateforme', 'run', 'Mesure…')
    try {
      const times: number[] = []
      for (let i = 0; i < 4; i++) { const t = performance.now(); await fetch(`${base}/api/health`, { cache: 'no-store' }); times.push(performance.now() - t) }
      const ping = Math.round(times.sort((x, y) => x - y)[1])
      const t1 = performance.now(); const r = await fetch(`/models/faceapi/face_landmark_68_model-shard1?x=${Date.now()}`, { cache: 'no-store' }); const bytes = (await r.arrayBuffer()).byteLength
      const mbit = (bytes * 8) / 1e6 / ((performance.now() - t1) / 1000)
      const st2: St = mbit < 2 || ping > 1500 ? 'ko' : mbit < 4 || ping > 600 ? 'warn' : 'ok'
      set('net', 'Connexion à la plateforme', st2, `Délai ${ping} ms · débit ${mbit.toFixed(1)} Mbit/s`, st2 === 'ok' ? undefined : "Connexion trop lente pour la surveillance vidéo (4 Mbit/s recommandés) : rapprochez-vous du routeur, utilisez un câble réseau, fermez les téléchargements.")
    } catch { set('net', 'Connexion à la plateforme', 'ko', 'Plateforme injoignable', 'Vérifiez votre connexion internet.') }

    // 6. Serveur de visioconférence et bibliothèque
    set('sfu', 'Serveur de visioconférence', 'run', 'Essai…')
    try {
      const host = location.hostname
      const sfu = /^cei\.unchk\.sn$/.test(host) ? 'https://sfu-cei.unchk.sn' : `https://sfu-${host}`
      await Promise.all([fetch(sfu, { mode: 'no-cors', cache: 'no-store' }), fetch('https://cdn.jsdelivr.net/npm/livekit-client@2.5.7/package.json', { mode: 'no-cors', cache: 'no-store' })])
      set('sfu', 'Serveur de visioconférence', 'ok', 'Joignable')
    } catch { set('sfu', 'Serveur de visioconférence', 'warn', 'Non joignable depuis ce réseau', "Si vous êtes sur un réseau d'établissement ou un VPN, essayez un autre réseau (partage de connexion du téléphone) : sans accès, la surveillance vidéo ne fonctionnera pas.") }

    // 7. Détection du visage
    const gl = (() => { try { const cv = document.createElement('canvas'); return !!(cv.getContext('webgl2') || cv.getContext('webgl')) } catch { return false } })()
    set('ai', 'Détection du visage', typeof WebAssembly === 'object' ? (gl ? 'ok' : 'warn') : 'ko', typeof WebAssembly !== 'object' ? 'WebAssembly indisponible' : gl ? 'Moteur disponible' : 'Accélération graphique indisponible : la détection sera plus lente', gl ? undefined : 'Mettez à jour les pilotes de la carte graphique.')

    // 8. Notifications
    try { const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission; set('notif', 'Notifications', p === 'granted' ? 'ok' : 'warn', p === 'granted' ? 'Autorisées' : 'Non autorisées', "Autorisez-les pour recevoir les messages de l'enseignant.") } catch { /* sans notifications */ }

    set('screenshare', "Partage d'écran complet", 'wait', 'À tester : cliquez sur le bouton ci-dessous (le navigateur exige un clic).')
    setRunning(false); setDone(true)
  }

  async function testScreen() {
    set('screenshare', "Partage d'écran complet", 'run', 'Choisissez « Écran entier »…')
    try {
      const ss = await (navigator.mediaDevices as any).getDisplayMedia({ video: { cursor: 'always', displaySurface: 'monitor' }, preferCurrentTab: false, audio: false })
      const t = ss.getVideoTracks()[0], surface = t?.getSettings?.()?.displaySurface
      t.stop()
      if (surface !== undefined && surface !== 'monitor') set('screenshare', "Partage d'écran complet", 'ko', `Vous avez partagé « ${surface === 'window' ? 'une fenêtre' : 'un onglet'} »`, "Choisissez « Écran entier » : une fenêtre ou un onglet est refusé pendant l'examen.")
      else set('screenshare', "Partage d'écran complet", 'ok', 'Écran entier partagé : accepté pour l\'examen')
    } catch (e: any) {
      set('screenshare', "Partage d'écran complet", 'ko', `Partage impossible (${e?.name || 'erreur'})`, osName() === 'mac' ? "macOS : Réglages Système, Confidentialité et sécurité, Enregistrement de l'écran, cochez CEI Examen (ou votre navigateur), puis relancez." : "Cliquez sur « Partager » dans la fenêtre du navigateur et choisissez « Écran entier ».")
    }
  }

  const bad = checks.filter(c => c.st === 'ko').length, warn = checks.filter(c => c.st === 'warn').length
  const screenOk = checks.find(c => c.id === 'screenshare')?.st === 'ok'
  const report = () => navigator.clipboard?.writeText(`Test du poste CEI — ${new Date().toLocaleString('fr-FR')}\n${navigator.userAgent}\n` + checks.map(c => `[${c.st.toUpperCase()}] ${c.label} : ${c.msg}`).join('\n'))

  return (
    <main style={{ minHeight: '100vh', background: '#f1f5f9', padding: 'calc(36px + var(--pwa-banner-height, 0px)) 16px 36px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontSize: 27, color: '#0f172a', margin: '0 0 6px' }}>Test de mon poste</h1>
        <p style={{ color: '#475569', fontSize: 16.5, lineHeight: 1.6, margin: '0 0 18px' }}>Vérifiez en deux minutes, <b>avant le jour de l&apos;examen</b>, que votre caméra, votre micro, le partage d&apos;écran et votre connexion fonctionnent. Rien n&apos;est enregistré.</p>
        <button onClick={runAuto} disabled={running} style={{ padding: '12px 22px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 16.5, cursor: running ? 'wait' : 'pointer', marginBottom: 18 }}>
          <i className={`fas ${running ? 'fa-spinner fa-spin' : 'fa-play'}`} style={{ marginRight: 8 }} />{running ? 'Test en cours…' : done ? 'Relancer le test' : 'Lancer le test'}
        </button>

        {checks.length > 0 && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ width: 200, height: 150, background: '#0f172a', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
              <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 6, background: 'rgba(255,255,255,.25)', borderRadius: 4 }}><div style={{ width: `${Math.min(100, level * 260)}%`, height: '100%', background: '#34d399', borderRadius: 4 }} /></div>
            </div>
            <div style={{ flex: 1, minWidth: 220, fontSize: 15, color: '#475569', alignSelf: 'center' }}>Votre image et le niveau sonore s&apos;affichent ici pendant le test. Placez-vous face à la caméra, bien éclairé.</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {checks.map(c => (
            <div key={c.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `4px solid ${ICON[c.st].c}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className={`fas ${ICON[c.st].i}`} style={{ color: ICON[c.st].c, fontSize: 19 }} />
                <b style={{ flex: 1, color: '#0f172a' }}>{c.label}</b>
              </div>
              {c.msg && <div style={{ color: '#334155', fontSize: 15, margin: '4px 0 0 29px' }}>{c.msg}</div>}
              {c.help && (c.st === 'ko' || c.st === 'warn') && <div style={{ color: '#92400e', fontSize: 14.5, margin: '4px 0 0 29px', lineHeight: 1.55 }}>{c.help}</div>}
              {c.id === 'screenshare' && c.st !== 'ok' && c.st !== 'run' && (
                <button onClick={testScreen} style={{ margin: '8px 0 0 29px', padding: '8px 16px', border: '1.5px solid #1d4ed8', borderRadius: 8, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}>
                  <i className="fas fa-display" style={{ marginRight: 6 }} />Tester le partage d&apos;écran
                </button>
              )}
            </div>
          ))}
        </div>

        {done && (
          <div style={{ marginTop: 18, padding: '14px 18px', borderRadius: 12, background: bad ? '#fef2f2' : (warn || !screenOk) ? '#fffbeb' : '#ecfdf5', border: `1px solid ${bad ? '#fecaca' : (warn || !screenOk) ? '#fde68a' : '#a7f3d0'}`, color: '#0f172a' }}>
            <b>{bad ? `${bad} point(s) à corriger avant l'examen.` : !screenOk ? "Testez maintenant le partage d'écran, dernier contrôle." : warn ? `${warn} point(s) à surveiller, mais votre poste est utilisable.` : 'Votre poste est prêt pour l\'examen.'}</b>
            <div style={{ marginTop: 8 }}><button onClick={report} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}><i className="fas fa-copy" style={{ marginRight: 6 }} />Copier le rapport (pour le support)</button></div>
          </div>
        )}
        <p style={{ marginTop: 18, fontSize: 14.5 }}><Link href="/telecharger-client" style={{ color: '#2563eb' }}>Télécharger l&apos;application</Link> · <Link href="/login" style={{ color: '#2563eb' }}>Connexion</Link></p>
      </div>
    </main>
  )
}
