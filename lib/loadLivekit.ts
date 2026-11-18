// Chargement du client LiveKit (script UMD) depuis trois sources : si un CDN est lent ou bloqué sur le réseau de l'étudiant, les autres prennent le relais.
const SOURCES = [
  'https://cdn.jsdelivr.net/npm/livekit-client@2.5.7/dist/livekit-client.umd.min.js',
  'https://unpkg.com/livekit-client@2.5.7/dist/livekit-client.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/livekit-client/2.5.7/livekit-client.umd.min.js',
]

/** Résout avec l'objet global `LivekitClient`, ou rejette si aucune des trois sources n'est joignable. */
export function loadLivekit(): Promise<any> {
  const w = window as any
  if (w.LivekitClient) return Promise.resolve(w.LivekitClient)
  return new Promise((resolve, reject) => {
    const next = (i: number) => {
      if (i >= SOURCES.length) { reject(new Error('client LiveKit indisponible (3 sources)')); return }
      const s = document.createElement('script')
      s.src = SOURCES[i]; s.crossOrigin = 'anonymous'
      s.onload = () => (w.LivekitClient ? resolve(w.LivekitClient) : next(i + 1))
      s.onerror = () => { s.remove(); next(i + 1) }
      document.head.appendChild(s)
    }
    next(0)
  })
}
