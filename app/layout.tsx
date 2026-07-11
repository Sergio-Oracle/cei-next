import type { Metadata } from 'next'
// globals.css is loaded per-route (dashboard/login/exam/proctor) — NOT on the public landing page
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import OfflineBanner from '@/components/shared/OfflineBanner'
import InstallPwaBanner from '@/components/shared/InstallPwaBanner'
import CustomCursor from '@/components/shared/CustomCursor'

export const metadata: Metadata = {
  title: 'CEI — Centre d\'Examen Intelligent',
  description: 'Système de notation intelligent — UNCHK',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1e3a8a" />
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
        <script dangerouslySetInnerHTML={{__html:`
          function googleTranslateElementInit(){
            new google.translate.TranslateElement({
              pageLanguage:'fr',
              includedLanguages:'fr,en,wo',
              autoDisplay:false
            },'google_translate_element');
          }
        `}} />
        <script src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" async defer />
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
                reloaded = true;
                window.location.reload();
              });
            });
          }
        `}} />
      </head>
      <body>
        <div id="google_translate_element" style={{display:'none'}} />
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
        <OfflineBanner />
        <InstallPwaBanner />
        <CustomCursor />
      </body>
    </html>
  )
}
