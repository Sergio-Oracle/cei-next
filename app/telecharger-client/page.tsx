'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Release { name: string; platform: string; arch?: string; label: string; size: number; sha256: string; url: string }
interface Releases { version: string | null; files: Release[]; notes?: string }
type Os = 'win32' | 'darwin' | 'linux' | 'mobile' | 'other'
interface Detected { os: Os; arch: 'x64' | 'arm64' | 'unknown'; label: string }

const OS_LABEL: Record<Os, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux', mobile: 'un téléphone ou une tablette', other: 'votre système' }
const mb = (n: number) => `${(n / 1048576).toFixed(0)} Mo`

/** Détecte le système ET l'architecture (Windows / macOS / Linux ; 64 bits Intel-AMD ou ARM / Apple Silicon). */
async function detect(): Promise<Detected> {
  const ua = navigator.userAgent
  const uad = (navigator as any).userAgentData
  let os: Os = 'other'
  if (/android|iphone|ipad|ipod|mobile|tablet/i.test(ua) || uad?.mobile) os = 'mobile'
  else if (/windows/i.test(uad?.platform || ua)) os = 'win32'
  else if (/mac/i.test(uad?.platform || ua)) os = 'darwin'
  else if (/linux|x11|cros/i.test(uad?.platform || ua)) os = 'linux'
  let arch: Detected['arch'] = 'unknown'
  try {
    if (uad?.getHighEntropyValues) {
      const h = await uad.getHighEntropyValues(['architecture', 'bitness'])
      arch = /arm/i.test(h.architecture || '') ? 'arm64' : (h.architecture === 'x86' && h.bitness === '64') ? 'x64' : 'unknown'
    } else if (/arm64|aarch64/i.test(ua)) arch = 'arm64'
    else if (/x86_64|win64|x64|amd64|intel/i.test(ua)) arch = 'x64'
  } catch { /* navigateur sans indice d'architecture : on propose la version générale */ }
  const archTxt = arch === 'arm64' ? (os === 'darwin' ? ' (Apple Silicon)' : ' (ARM 64 bits)') : arch === 'x64' ? (os === 'darwin' ? ' (Intel)' : ' (64 bits)') : ''
  return { os, arch, label: OS_LABEL[os] + archTxt }
}

/** Meilleure version pour ce poste : même système ; même architecture ou version universelle ; sinon (Windows ARM) la version 64 bits Intel-AMD, qui s'y exécute. */
function pick(files: Release[], d: Detected): { file?: Release; note?: string } {
  const same = files.filter(f => f.platform === d.os)
  if (!same.length) return {}
  const exact = same.find(f => f.arch === d.arch) || same.find(f => f.arch === 'universal')
  if (exact) return { file: exact }
  const x64 = same.find(f => f.arch === 'x64')
  if (x64 && d.os === 'win32' && d.arch === 'arm64') return { file: x64, note: 'Sur un PC Windows ARM, cette version 64 bits fonctionne par émulation.' }
  if (x64 && d.arch === 'unknown') return { file: x64 }
  return { note: d.os === 'linux' && d.arch === 'arm64' ? "Il n'existe pas encore de version Linux pour processeur ARM." : undefined }
}

const REQ: Record<string, string> = { win32: 'Windows 10 ou 11 (64 bits)', darwin: 'macOS récent (Intel ou Apple Silicon)', linux: 'Linux 64 bits (Ubuntu 20.04 ou plus récent, Debian, Mint…)' }
const HOWTO: Record<string, string> = {
  win32: "Extrayez l'archive ZIP (clic droit, Extraire tout), puis lancez « CEI Examen.exe ». Si l'écran « Windows a protégé votre ordinateur » apparaît : Informations complémentaires, puis Exécuter quand même.",
  darwin: "Ouvrez l'image disque et glissez CEI Examen dans Applications. Au premier lancement : clic droit sur l'application, puis Ouvrir (ou, dans le Terminal : xattr -cr \"/Applications/CEI Examen.app\"). Autorisez ensuite la caméra, le micro et l'enregistrement de l'écran quand macOS le demande.",
  linux: "Clic droit sur le fichier, Propriétés, autorisez l'exécution du fichier comme un programme, puis double-clic. (Terminal : chmod +x CEI-Examen-*.AppImage puis ./CEI-Examen-*.AppImage)",
}

/** Page publique : télécharger l'application CEI Examen — la version qui correspond à VOTRE ordinateur est choisie automatiquement. */
export default function DownloadClientPage() {
  const [rel, setRel] = useState<Releases | null>(null)
  const [err, setErr] = useState('')
  const [det, setDet] = useState<Detected | null>(null)
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  useEffect(() => {
    detect().then(setDet)
    fetch(`${base}/api/exam-client/releases`).then(r => r.json()).then(setRel).catch(() => setErr('Liste des versions indisponible pour le moment.'))
  }, []) // eslint-disable-line
  const files = rel?.files ?? []
  const choice = det && files.length ? pick(files, det) : undefined
  const others = files.filter(f => f !== choice?.file)
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 20 }
  return (
    <main style={{ minHeight: '100vh', background: '#f1f5f9', padding: 'calc(40px + var(--pwa-banner-height, 0px)) 16px 40px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, color: '#0f172a', margin: '0 0 6px' }}>Application CEI Examen</h1>
        <p style={{ color: '#475569', fontSize: 17, lineHeight: 1.6, margin: '0 0 22px' }}>
          C&apos;est <b>la seule application à installer</b> sur ordinateur : elle sert pour vos notes et vos examens. Pour les examens qui l&apos;exigent, elle verrouille votre poste en plein écran pendant la composition, comme Safe Exam Browser.
          Vous l&apos;installez une seule fois.
        </p>

        <div style={card}>
          {err && <div style={{ color: '#b91c1c' }}>{err}</div>}
          {!rel && !err && <div style={{ color: '#64748b' }}>Détection de votre ordinateur…</div>}

          {rel && det && det.os === 'mobile' && (
            <div style={{ color: '#334155', lineHeight: 1.7 }}>
              <b>Vous êtes sur {OS_LABEL.mobile}.</b> L&apos;application CEI Examen est réservée aux ordinateurs (Windows, macOS, Linux) : les examens surveillés se passent sur ordinateur.
              Sur ce téléphone, continuez à utiliser le site, ou la version web installable.
            </div>
          )}

          {rel && det && det.os !== 'mobile' && files.length === 0 && <div style={{ color: '#92400e' }}>L&apos;application n&apos;est pas encore disponible au téléchargement. Contactez votre enseignant.</div>}

          {rel && det && det.os !== 'mobile' && files.length > 0 && (
            choice?.file ? (
              <>
                <div style={{ fontSize: 15, color: '#64748b', marginBottom: 4 }}>Nous avons détecté : <b style={{ color: '#0f172a' }}>{det.label}</b></div>
                <a href={`${base}${choice.file.url}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', margin: '8px 0 10px', background: '#1d4ed8', color: '#fff', borderRadius: 12, textDecoration: 'none', boxShadow: '0 4px 14px rgba(29,78,216,.25)' }}>
                  <i className="fas fa-download" style={{ fontSize: 24 }} />
                  <span style={{ flex: 1 }}>
                    <b style={{ fontSize: 19, display: 'block' }}>Télécharger pour {OS_LABEL[det.os]}</b>
                    <small style={{ opacity: .9 }}>{choice.file.label} · version {rel.version} · {mb(choice.file.size)}</small>
                  </span>
                </a>
                {choice.note && <div style={{ fontSize: 14.5, color: '#92400e', marginBottom: 8 }}>{choice.note}</div>}
                <div style={{ fontSize: 14.5, color: '#475569', lineHeight: 1.7 }}><b>Configuration requise :</b> {REQ[det.os]}.<br /><b>Installation :</b> {HOWTO[det.os]}</div>
              </>
            ) : (
              <div style={{ color: '#334155', lineHeight: 1.7 }}>
                <div style={{ fontSize: 15, color: '#64748b', marginBottom: 6 }}>Nous avons détecté : <b style={{ color: '#0f172a' }}>{det.label}</b></div>
                <b>{choice?.note || `La version pour ${OS_LABEL[det.os]} n'est pas encore disponible.`}</b>
                {det.os === 'darwin' && ' Elle sera publiée avant les examens concernés ; en attendant, utilisez un ordinateur Windows ou Linux, ou contactez votre enseignant.'}
              </div>
            )
          )}

          {others.length > 0 && det?.os !== 'mobile' && (
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: 'pointer', color: '#2563eb', fontWeight: 600 }}>Autres systèmes et versions</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {others.map(f => (
                  <a key={f.name} href={`${base}${f.url}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, textDecoration: 'none', color: '#0f172a' }}>
                    <i className="fas fa-download" style={{ color: '#2563eb' }} />
                    <span style={{ flex: 1 }}><b>{f.label}</b><small style={{ display: 'block', color: '#64748b' }}>{f.name} · {mb(f.size)}</small></span>
                  </a>
                ))}
              </div>
            </details>
          )}
        </div>

        <div style={{ ...card, color: '#334155', lineHeight: 1.7, fontSize: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Vérifiez votre poste avant l&apos;examen</div>
          <p style={{ margin: '0 0 10px' }}>Après l&apos;installation, lancez le <b>test du poste</b> : il contrôle votre caméra, votre micro, le partage d&apos;écran complet, votre connexion et la visioconférence, et vous dit précisément ce qu&apos;il faut corriger.</p>
          <Link href="/test-poste" style={{ display: 'inline-block', padding: '10px 18px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}><i className="fas fa-stethoscope" style={{ marginRight: 8 }} />Tester mon poste</Link>
        </div>

        <div style={{ ...card, color: '#334155', lineHeight: 1.7, fontSize: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Comment l&apos;utiliser</div>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Installez l&apos;application, ouvrez-la et connectez-vous avec votre compte habituel.</li>
            <li>Ouvrez votre examen depuis votre tableau de bord, comme d&apos;habitude.</li>
            <li>Dès le démarrage, l&apos;écran passe en plein écran verrouillé jusqu&apos;à la fin de l&apos;examen.</li>
            <li><b>Enregistrez et fermez vos autres applications</b> (bloc-notes, navigateurs, assistants d&apos;intelligence artificielle…) : l&apos;application les ferme toutes, y compris un chatbot ouvert dans un onglet. Branchez un seul écran.</li>
          </ol>
          <p style={{ margin: '12px 0 0', fontSize: 14.5, color: '#64748b' }}>Pendant l&apos;examen, changer d&apos;application, fermer la fenêtre ou ouvrir un autre site est impossible ; toute tentative est signalée au surveillant.</p>
        </div>

        <div style={{ ...card, color: '#334155', lineHeight: 1.7, fontSize: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Vous aviez installé la version web de CEI ?</div>
          <p style={{ margin: '0 0 8px' }}>L&apos;application CEI Examen la <b>remplace</b> : elle sert pour vos notes, vos réclamations, vos examens ordinaires <i>et</i> les examens verrouillés. Vous n&apos;avez donc besoin que d&apos;une seule application. Une fois CEI Examen installée, vous pouvez désinstaller l&apos;ancienne :</p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15 }}>
            <li><b>Chrome</b> : tapez <code>chrome://apps</code>, clic droit sur CEI, <i>Désinstaller</i>. <b>Edge</b> : <code>edge://apps</code>, puis <i>Désinstaller</i>.</li>
            <li><b>Windows</b> : Paramètres, Applications, Applications installées, CEI, <i>Désinstaller</i>.</li>
          </ul>
          <p style={{ margin: '8px 0 0', fontSize: 14.5, color: '#64748b' }}>Sur téléphone ou tablette, l&apos;application CEI Examen n&apos;existe pas : gardez la version web installée.</p>
        </div>
        <p style={{ marginTop: 18 }}><Link href="/login" style={{ color: '#2563eb' }}>Retour à la connexion</Link></p>
      </div>
    </main>
  )
}
