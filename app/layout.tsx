import type { Metadata, Viewport } from 'next'
// globals.css is loaded per-route (dashboard/login/exam/proctor) — NOT on the public landing page
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import OfflineBanner from '@/components/shared/OfflineBanner'
import InstallPwaBanner from '@/components/shared/InstallPwaBanner'
import GoogleTranslateLoader from '@/components/shared/GoogleTranslateLoader'

export const metadata: Metadata = {
  title: 'CEI — Centre d\'Examen Intelligent',
  description: 'Système de notation intelligent — UNCHK',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e3a8a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="stylesheet" href="/fontawesome/all.min.css" />
        {/* Google Translate — masquer l'UI, garder la traduction */}
        <style dangerouslySetInnerHTML={{__html:`
          iframe.goog-te-banner-frame,.goog-te-banner-frame,.skiptranslate,
          .goog-te-gadget,.goog-te-gadget-icon,.goog-te-gadget-simple,
          .goog-te-spinner-pos,.goog-te-spinner,.goog-te-menu-frame,
          #goog-gt-tt,#google_translate_element,body>.skiptranslate
          {display:none!important;height:0!important;overflow:hidden!important}
          html,body{top:0!important;position:static!important}
        `}} />
        {/* Google Translate : chargé après l'hydratation par GoogleTranslateLoader
            (voir ce composant — chargé ici, il provoquait l'erreur React #418).
            C-16 (audit DITSI-SSSI) : pas de SRI possible sur ce script généré
            dynamiquement par Google ; compensation = CSP script-src limitée à
            translate.google.com/googleapis.com (nginx). */}
        {/* Capture le prompt d'installation PWA le plus tôt possible (avant même
            l'hydratation React) — pratique standard recommandée : si l'écouteur
            n'est posé qu'une fois le composant React monté, l'événement peut
            arriver avant et être perdu définitivement pour cette page. Le
            hook usePwaInstall relit window.__pwaDeferredPrompt à son montage. */}
        <script dangerouslySetInnerHTML={{__html:`
          window.addEventListener('beforeinstallprompt', function(e){
            e.preventDefault();
            window.__pwaDeferredPrompt = e;
            window.dispatchEvent(new CustomEvent('cei:pwa-prompt-ready'));
          });
        `}} />
        {/* Enregistrement du service worker pour PWA / offline.
            Recharge automatiquement une fois quand une nouvelle version prend le contrôle,
            pour éviter qu'un onglet déjà ouvert continue de tourner avec du JS périmé
            référençant des fichiers supprimés par un déploiement plus récent. */}
        <script dangerouslySetInnerHTML={{__html:`
          if('serviceWorker' in navigator){
            window.addEventListener('load',function(){
              navigator.serviceWorker.register('/sw.js',{scope:'/'})
                .then(function(reg){ reg.update().catch(function(){}); })
                .catch(function(){});
              var reloaded = false;
              navigator.serviceWorker.addEventListener('controllerchange',function(){
                if(reloaded) return;
                // /phone-camera échange un code de couplage à USAGE UNIQUE dès
                // le chargement puis établit une connexion LiveKit — un rechargement
                // ici (typiquement déclenché par l'enregistrement du SW lors de la
                // toute première visite d'un appareil, ex. un téléphone qui scanne
                // le QR code pour la première fois) interrompt cette séquence
                // irréversible en plein milieu et gâche le code (retour utilisateur
                // du 24/08, constaté en conditions réelles via Playwright : le
                // rechargement survient juste après l'échange du code, avant même
                // la connexion LiveKit, laissant la page dans un état d'échec alors
                // que le premier échange avait pourtant réussi).
                if(window.location.pathname.indexOf('/phone-camera')===0) return;
                reloaded = true;
                window.location.reload();
              });
            });
          }
        `}} />
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
        <OfflineBanner />
        <InstallPwaBanner />
        <GoogleTranslateLoader />
      </body>
    </html>
  )
}
