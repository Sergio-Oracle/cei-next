'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Release { name: string; platform: string; label: string; size: number; sha256: string; url: string }
interface Releases { version: string | null; files: Release[]; notes?: string }

const PLATFORM_HINT = (): string => {
  if (typeof navigator === 'undefined') return ''
  const u = navigator.userAgent
  return /Windows/i.test(u) ? 'win32' : /Mac/i.test(u) ? 'darwin' : /Linux|X11/i.test(u) ? 'linux' : ''
}
const mb = (n: number) => `${(n / 1048576).toFixed(0)} Mo`

/** Page publique : télécharger l'application CEI Examen (client kiosque équivalent de Safe Exam Browser). */
export default function DownloadClientPage() {
  const [rel, setRel] = useState<Releases | null>(null)
  const [err, setErr] = useState('')
  const mine = PLATFORM_HINT()
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || ''
    fetch(`${base}/api/exam-client/releases`).then(r => r.json()).then(setRel).catch(() => setErr('Liste des versions indisponible pour le moment.'))
  }, [])
  const files = rel?.files ?? []
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  return (
    <main style={{ minHeight: '100vh', background: '#f1f5f9', padding: '40px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, color: '#0f172a', margin: '0 0 6px' }}>Application CEI Examen</h1>
        <p style={{ color: '#475569', fontSize: 17, lineHeight: 1.6, margin: '0 0 22px' }}>
          C&apos;est <b>la seule application à installer</b> sur ordinateur : elle sert pour vos cours, vos notes et vos examens. Pour les examens qui l&apos;exigent, elle verrouille votre poste en plein écran pendant la composition, comme Safe Exam Browser.
          Vous l&apos;installez une seule fois.
        </p>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Téléchargement{rel?.version ? ` — version ${rel.version}` : ''}</div>
          {err && <div style={{ color: '#b91c1c' }}>{err}</div>}
          {!rel && !err && <div style={{ color: '#64748b' }}>Chargement…</div>}
          {rel && files.length === 0 && <div style={{ color: '#92400e' }}>L&apos;application n&apos;est pas encore disponible au téléchargement. Contactez votre enseignant.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {files.map(f => (
              <a key={f.name} href={`${base}${f.url}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1.5px solid ${f.platform === mine ? '#2563eb' : '#e2e8f0'}`, borderRadius: 10, textDecoration: 'none', color: '#0f172a', background: f.platform === mine ? '#eff6ff' : '#fff' }}>
                <i className="fas fa-download" style={{ color: '#2563eb' }} />
                <span style={{ flex: 1 }}><b>{f.label}</b>{f.platform === mine && <span style={{ color: '#2563eb', marginLeft: 8, fontSize: 14 }}>recommandé pour votre ordinateur</span>}
                  <small style={{ display: 'block', color: '#64748b' }}>{f.name} · {mb(f.size)}</small></span>
              </a>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, color: '#334155', lineHeight: 1.7, fontSize: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Comment l&apos;utiliser</div>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Installez l&apos;application, ouvrez-la et connectez-vous avec votre compte habituel.</li>
            <li>Ouvrez votre examen depuis votre tableau de bord, comme d&apos;habitude.</li>
            <li>Dès le démarrage, l&apos;écran passe en plein écran verrouillé jusqu&apos;à la fin de l&apos;examen.</li>
            <li>Fermez avant tout logiciel de partage d&apos;écran, de visioconférence, de contrôle à distance et branchez un seul écran.</li>
          </ol>
          <p style={{ margin: '12px 0 0', fontSize: 14.5, color: '#475569' }}><b>Avant de commencer l&apos;examen, enregistrez et fermez vos autres applications</b> (bloc-notes, navigateurs, assistants d&apos;intelligence artificielle…) : l&apos;application les ferme toutes, y compris un chatbot ouvert dans un onglet.</p>
          <p style={{ margin: '8px 0 0', fontSize: 14.5, color: '#64748b' }}><b>Windows</b> : si l&apos;écran « Windows a protégé votre ordinateur » apparaît, cliquez sur <i>Informations complémentaires</i> puis <i>Exécuter quand même</i>. <b>Mac</b> : clic droit sur l&apos;application → <i>Ouvrir</i>, ou, dans le Terminal : <code>xattr -cr &quot;/Applications/CEI Examen.app&quot;</code>.</p>
          <p style={{ margin: '12px 0 0', fontSize: 14.5, color: '#64748b' }}>Pendant l&apos;examen, changer d&apos;application, fermer la fenêtre ou ouvrir un autre site est impossible ; toute tentative est signalée au surveillant.</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginTop: 20, color: '#334155', lineHeight: 1.7, fontSize: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Vous aviez installé la version web de CEI ?</div>
          <p style={{ margin: '0 0 8px' }}>L&apos;application CEI Examen la <b>remplace</b> : elle sert pour vos cours, vos notes, vos examens ordinaires <i>et</i> les examens verrouillés. Vous n&apos;avez donc besoin que d&apos;une seule application. Une fois CEI Examen installée, vous pouvez désinstaller l&apos;ancienne :</p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15 }}>
            <li><b>Chrome</b> : tapez <code>chrome://apps</code>, clic droit sur CEI, <i>Désinstaller</i>. <b>Edge</b> : <code>edge://apps</code>, puis <i>Désinstaller</i>.</li>
            <li><b>Windows</b> : Paramètres, Applications, Applications installées, CEI, <i>Désinstaller</i>.</li>
          </ul>
          <p style={{ margin: '8px 0 0', fontSize: 14.5, color: '#64748b' }}>Sur téléphone ou tablette, l&apos;application CEI Examen n&apos;existe pas : gardez la version web installée (les examens surveillés se passent sur ordinateur).</p>
        </div>
        <p style={{ marginTop: 18 }}><Link href="/login" style={{ color: '#2563eb' }}>Retour à la connexion</Link></p>
      </div>
    </main>
  )
}
