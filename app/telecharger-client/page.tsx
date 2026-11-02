'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Release { name: string; platform: string; arch?: string; kind?: string; label: string; size: number; sha256: string; url: string }
interface Releases { version: string | null; files: Release[]; notes?: string }
type Os = 'win32' | 'darwin' | 'linux' | 'mobile' | 'other'
interface Detected { os: Os; arch: 'x64' | 'arm64' | 'unknown'; label: string; edge: boolean }

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
  const edge = /\bEdg(e|A|iOS)?\//.test(ua)           // Microsoft Edge : son filtre SmartScreen retient les .exe peu connus (voir « installer-zip »)
  return { os, arch, label: OS_LABEL[os] + archTxt, edge }
}

/** Meilleure version pour ce poste : même système ; même architecture ou version universelle ; sinon (Windows ARM) la version 64 bits Intel-AMD, qui s'y exécute. */
function pick(files: Release[], d: Detected): { file?: Release; note?: string } {
  // Installateur d'abord, archive en dernier recours. Le ZIP contenant l'installateur n'est proposé d'office qu'à Edge :
  // Edge retient le .exe (« n'est pas fréquemment téléchargé ») mais laisse passer une archive.
  const zipFirst = d.os === 'win32' && d.edge
  const rank = (f: Release) => (f.kind === 'installer-zip' ? (zipFirst ? -1 : 3) : f.kind === 'installer' ? 0 : f.kind === 'portable' ? 1 : 2)
  const same = files.filter(f => f.platform === d.os).sort((a, b) => rank(a) - rank(b))
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
  win32: "Double-cliquez sur le fichier téléchargé et suivez l'assistant (aucun droit administrateur requis) : l'application apparaît sur le Bureau et dans le menu Démarrer. Si l'écran « Windows a protégé votre ordinateur » apparaît : Informations complémentaires, puis Exécuter quand même.",
  darwin: "Ouvrez l'image disque et glissez CEI Examen dans Applications. Au premier lancement : clic droit sur l'application, puis Ouvrir (ou, dans le Terminal : xattr -cr \"/Applications/CEI Examen.app\"). Autorisez ensuite la caméra, le micro et l'enregistrement de l'écran quand macOS le demande.",
  linux: "Double-cliquez sur le fichier .deb : le Centre de logiciels s'ouvre, cliquez sur Installer (mot de passe de session demandé). CEI Examen apparaît ensuite dans le menu des applications, comme sous Windows. Dans le Terminal : sudo apt install ./CEI-Examen-*-linux-amd64.deb. Version AppImage (sans installation) : autorisez son exécution (clic droit, Propriétés), puis double-clic ; si rien ne se lance, installez libfuse2 (sudo apt install libfuse2) ou utilisez plutôt le .deb.",
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
  const howto = !choice?.file || !det ? '' : det.os === 'win32' && choice.file.kind === 'installer-zip' ? "Faites un clic droit sur le fichier ZIP téléchargé, puis Extraire tout, puis double-cliquez sur « Installer CEI Examen » et suivez l'assistant (aucun droit administrateur requis) : l'application apparaît sur le Bureau et dans le menu Démarrer. Si l'écran « Windows a protégé votre ordinateur » apparaît : Informations complémentaires, puis Exécuter quand même." : det.os === 'win32' && choice.file.kind === 'archive' ? "Extrayez l'archive ZIP (clic droit, Extraire tout), puis lancez « CEI Examen.exe ». Si l'écran « Windows a protégé votre ordinateur » apparaît : Informations complémentaires, puis Exécuter quand même." : HOWTO[det.os]
  return (
    <main className="dl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="dl-wrap">
        <header className="dl-hero">
          <span className="dl-badge"><i className="fas fa-lock" /> Examens surveillés · UNCHK</span>
          <h1>Application CEI Examen</h1>
          <p>
            C&apos;est <b>la seule application à installer</b>{' '}sur ordinateur : elle sert pour vos notes et vos examens. Pour les examens qui l&apos;exigent, elle verrouille votre poste en plein écran pendant la composition, comme Safe Exam Browser. Vous l&apos;installez <b>une seule fois</b>.
          </p>
        </header>

        <section className="dl-card dl-main">
          {err && <div className="dl-err">{err}</div>}
          {!rel && !err && <div className="dl-muted">Détection de votre ordinateur…</div>}

          {rel && det && det.os === 'mobile' && (
            <div>
              <b>Vous êtes sur {OS_LABEL.mobile}.</b> L&apos;application CEI Examen est réservée aux ordinateurs (Windows, macOS, Linux) : les examens surveillés se passent sur ordinateur.
              Sur ce téléphone, continuez à utiliser le site, ou la version web installable.
            </div>
          )}

          {rel && det && det.os !== 'mobile' && files.length === 0 && <div className="dl-warn-txt">L&apos;application n&apos;est pas encore disponible au téléchargement. Contactez votre enseignant.</div>}

          {rel && det && det.os !== 'mobile' && files.length > 0 && (
            choice?.file ? (
              <>
                <div className="dl-detect">Nous avons détecté : <b>{det.label}</b></div>
                <a className="dl-btn" href={`${base}${choice.file.url}`} download={choice.file.name}>
                  <i className="fas fa-download" />
                  <span>
                    <b>Télécharger pour {OS_LABEL[det.os]}</b>
                    <small>{choice.file.label} · version {rel.version} · {mb(choice.file.size)}</small>
                  </span>
                </a>
                {choice.note && <div className="dl-warn-txt">{choice.note}</div>}
                <dl className="dl-facts">
                  <div><dt><i className="fas fa-desktop" /> Configuration requise</dt><dd>{REQ[det.os]}.</dd></div>
                  <div><dt><i className="fas fa-wand-magic-sparkles" /> Installation</dt><dd>{howto}</dd></div>
                </dl>
              </>
            ) : (
              <div>
                <div className="dl-detect">Nous avons détecté : <b>{det.label}</b></div>
                <b>{choice?.note || `La version pour ${OS_LABEL[det.os]} n'est pas encore disponible.`}</b>
                {det.os === 'darwin' && ' Elle sera publiée avant les examens concernés ; en attendant, utilisez un ordinateur Windows ou Linux, ou contactez votre enseignant.'}
              </div>
            )
          )}

          {others.length > 0 && det?.os !== 'mobile' && (
            <details className="dl-more">
              <summary>Autres systèmes et versions</summary>
              <div className="dl-list">
                {others.map(f => (
                  <a key={f.name} href={`${base}${f.url}`}>
                    <i className="fas fa-download" />
                    <span><b>{f.label}</b><small>{f.name} · {mb(f.size)}</small></span>
                  </a>
                ))}
              </div>
            </details>
          )}
        </section>

        <h2 className="dl-h2">En 3 étapes</h2>
        <ol className="dl-steps">
          <li><span className="n">1</span><div><b>Téléchargez</b><p>Cliquez sur le grand bouton bleu. Le bon fichier pour votre ordinateur est choisi pour vous.</p></div></li>
          <li><span className="n">2</span><div><b>Installez</b><p>Ouvrez le fichier et suivez l&apos;assistant. Si un avertissement apparaît, c&apos;est normal : voir l&apos;encadré ci-dessous.</p></div></li>
          <li><span className="n">3</span><div><b>Testez votre poste</b><p>Lancez le test : il vérifie caméra, micro, écran et connexion avant le jour de l&apos;examen.</p></div></li>
        </ol>

        <section className="dl-card dl-alert">
          <h2><i className="fas fa-shield-alt" /> Un avertissement apparaît ? C&apos;est normal</h2>
          <p>L&apos;application est récente et n&apos;est pas encore connue de Microsoft : votre navigateur et Windows demandent donc une confirmation. <b>Ce n&apos;est pas un virus.</b> Suivez ces étapes :</p>
          <ol className="dl-num">
            <li><b>Edge</b> : « n&apos;est pas fréquemment téléchargé » → cliquez sur <b>⋯</b> à droite de la ligne, puis <b>Conserver</b>, puis <b>Conserver quand même</b>.</li>
            <li><b>Chrome</b> : « Ce fichier n&apos;est pas couramment téléchargé » → cliquez sur la flèche ou <b>⋮</b>, puis <b>Conserver</b>.</li>
            <li><b>Windows</b> (au lancement) : « Windows a protégé votre ordinateur » → <b>Informations complémentaires</b>, puis <b>Exécuter quand même</b>.</li>
          </ol>
          <p>Si vous voyez un fichier « Non confirmé … .crdownload » dans vos téléchargements, c&apos;est que l&apos;étape « Conserver » n&apos;a pas été faite : rouvrez la liste des téléchargements (<kbd>Ctrl</kbd> + <kbd>J</kbd>) et confirmez, ou supprimez ce fichier et recommencez.</p>
          <p className="dl-small">
            Autre source du même fichier : <a href="https://github.com/Sergio-Oracle/cei-client/releases/latest" target="_blank" rel="noopener noreferrer">page des versions sur GitHub</a>.
            En salle d&apos;examen, le responsable peut aussi vous remettre l&apos;installateur sur clé USB ou sur un partage interne : il s&apos;installe alors sans avertissement du navigateur.
          </p>
        </section>

        <section className="dl-card">
          <h2><i className="fas fa-stethoscope" /> Vérifiez votre poste avant l&apos;examen</h2>
          <p>Après l&apos;installation, lancez le <b>test du poste</b> : il contrôle votre caméra, votre micro, le partage d&apos;écran complet, votre connexion et la visioconférence, et vous dit précisément ce qu&apos;il faut corriger.</p>
          <Link href="/test-poste" className="dl-btn2"><i className="fas fa-stethoscope" /> Tester mon poste</Link>
        </section>

        <section className="dl-card">
          <h2><i className="fas fa-book-open" /> Comment l&apos;utiliser</h2>
          <ol className="dl-num">
            <li>Installez l&apos;application, ouvrez-la et connectez-vous avec votre compte habituel.</li>
            <li>Ouvrez votre examen depuis votre tableau de bord, comme d&apos;habitude.</li>
            <li>Dès le démarrage, l&apos;écran passe en plein écran verrouillé jusqu&apos;à la fin de l&apos;examen.</li>
            <li><b>Enregistrez et fermez vos autres applications</b> (bloc-notes, navigateurs, assistants d&apos;intelligence artificielle…) : l&apos;application les ferme toutes, y compris un chatbot ouvert dans un onglet. Branchez un seul écran.</li>
          </ol>
          <p className="dl-small">Pendant l&apos;examen, changer d&apos;application, fermer la fenêtre ou ouvrir un autre site est impossible ; toute tentative est signalée au surveillant.</p>
        </section>

        <section className="dl-card">
          <h2><i className="fas fa-circle-question" /> Vous aviez installé la version web de CEI ?</h2>
          <p>L&apos;application CEI Examen la <b>remplace</b> : elle sert pour vos notes, vos réclamations, vos examens ordinaires <i>et</i> les examens verrouillés. Vous n&apos;avez donc besoin que d&apos;une seule application. Une fois CEI Examen installée, vous pouvez désinstaller l&apos;ancienne :</p>
          <ul>
            <li><b>Chrome</b> : tapez <code>chrome://apps</code>, clic droit sur CEI, <i>Désinstaller</i>. <b>Edge</b> : <code>edge://apps</code>, puis <i>Désinstaller</i>.</li>
            <li><b>Windows</b> : Paramètres, Applications, Applications installées, CEI, <i>Désinstaller</i>.</li>
          </ul>
          <p className="dl-small">Sur téléphone ou tablette, l&apos;application CEI Examen n&apos;existe pas : gardez la version web installée.</p>
        </section>
        <p className="dl-back"><Link href="/login">← Retour à la connexion</Link></p>
      </div>
    </main>
  )
}

const CSS = `
@font-face{font-family:'Mona Sans';font-style:normal;font-weight:200 900;font-display:swap;src:url(/fonts/mona-sans-latin-wght-normal.woff2) format('woff2-variations');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Mona Sans';font-style:normal;font-weight:200 900;font-display:swap;src:url(/fonts/mona-sans-latin-ext-wght-normal.woff2) format('woff2-variations');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
.dl{min-height:100vh;background:#f1f5f9;padding:calc(48px + var(--pwa-banner-height,0px)) 16px 56px;font-family:'Mona Sans',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:18px;line-height:1.75;color:#334155;-webkit-font-smoothing:antialiased}
.dl *{box-sizing:border-box}
.dl-wrap{max-width:820px;margin:0 auto}
.dl-hero{margin:0 0 28px}
.dl-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:#dbeafe;color:#1e40af;font-size:14.5px;font-weight:600;margin-bottom:14px}
.dl-hero h1{font-size:clamp(32px,5vw,44px);line-height:1.15;font-weight:800;letter-spacing:-.02em;color:#0f172a;margin:0 0 14px}
.dl-hero p{font-size:19.5px;line-height:1.75;color:#475569;margin:0}
.dl-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:28px 30px;margin-bottom:24px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.dl-card h2{font-size:22px;line-height:1.35;font-weight:700;color:#0f172a;margin:0 0 12px;display:flex;align-items:center;gap:10px}
.dl-card h2 i{color:#2563eb;font-size:20px}
.dl-card p{margin:0 0 14px}
.dl-card ul{margin:0 0 14px;padding-left:24px}
.dl-card li{margin-bottom:8px}
.dl-main{border-color:#bfdbfe;box-shadow:0 6px 24px rgba(37,99,235,.08)}
.dl-detect{font-size:17px;color:#64748b;margin-bottom:6px}
.dl-detect b{color:#0f172a}
.dl a.dl-btn{color:#fff;display:flex;align-items:center;gap:18px;padding:22px 26px;margin:10px 0 18px;background:#1d4ed8;color:#fff;border-radius:16px;text-decoration:none;box-shadow:0 6px 18px rgba(29,78,216,.28);transition:background .15s,transform .15s}
.dl-btn:hover{background:#1e40af;transform:translateY(-1px)}
.dl-btn:focus-visible,.dl-btn2:focus-visible{outline:3px solid #93c5fd;outline-offset:3px}
.dl-btn i{font-size:32px}
.dl-btn span{flex:1}
.dl-btn b{display:block;font-size:24px;line-height:1.3;font-weight:700}
.dl-btn small{display:block;font-size:16px;opacity:.92;margin-top:2px}
.dl-facts{margin:0;display:grid;gap:14px}
.dl-facts div{background:#f8fafc;border-radius:12px;padding:16px 18px}
.dl-facts dt{font-weight:700;color:#0f172a;font-size:17px;margin-bottom:4px}
.dl-facts dt i{color:#2563eb;margin-right:8px;width:18px;text-align:center}
.dl-facts dd{margin:0;font-size:17px;line-height:1.75}
.dl-warn-txt{color:#92400e;font-size:17px;margin-bottom:10px}
.dl-err{color:#b91c1c}
.dl-muted{color:#64748b}
.dl-more{margin-top:18px}
.dl-more summary{cursor:pointer;color:#1d4ed8;font-weight:600;font-size:17px}
.dl-list{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.dl-list a{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1.5px solid #e2e8f0;border-radius:12px;text-decoration:none;color:#0f172a}
.dl-list a:hover{border-color:#93c5fd;background:#f8fafc}
.dl-list i{color:#2563eb}
.dl-list span{flex:1}
.dl-list small{display:block;color:#64748b;font-size:15px}
.dl-h2{font-size:24px;font-weight:700;color:#0f172a;margin:34px 0 14px}
.dl-steps{list-style:none;margin:0 0 28px;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.dl-steps li{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:10px}
.dl-steps .n{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#16a34a;color:#fff;font-weight:700;font-size:19px}
.dl-steps b{display:block;font-size:19px;color:#0f172a}
.dl-steps p{margin:4px 0 0;font-size:16.5px;line-height:1.65}
.dl-alert{background:#fffbeb;border:1.5px solid #fcd34d}
.dl-alert h2,.dl-alert h2 i{color:#92400e}
.dl-num{margin:0 0 14px;padding-left:26px}
.dl-num li{padding-left:6px}
.dl-small{font-size:16px;color:#64748b}
.dl p a,.dl li a{color:#1d4ed8}
.dl kbd{background:#fff;border:1px solid #cbd5e1;border-bottom-width:2px;border-radius:6px;padding:1px 8px;font-size:15px;font-family:inherit;font-weight:600}
.dl code{background:#f1f5f9;border-radius:6px;padding:2px 7px;font-size:16px}
.dl-btn2{display:inline-flex;align-items:center;gap:10px;padding:13px 24px;background:#eff6ff;color:#1d4ed8!important;border:1.5px solid #bfdbfe;border-radius:12px;font-weight:700;text-decoration:none}
.dl-btn2:hover{background:#dbeafe}
.dl-back{margin-top:22px;font-size:17px}
@media(max-width:700px){.dl{font-size:17px;padding-top:calc(28px + var(--pwa-banner-height,0px))}.dl-card{padding:22px 18px}.dl-steps{grid-template-columns:1fr}.dl-btn{padding:18px}.dl-btn b{font-size:21px}}
`
