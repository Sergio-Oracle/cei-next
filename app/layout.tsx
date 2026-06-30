import type { Metadata } from 'next'
// globals.css is loaded per-route (dashboard/login/exam/proctor) — NOT on the public landing page
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'

export const metadata: Metadata = {
  title: 'CEI — Centre d\'Examen Intelligent',
  description: 'Système de notation intelligent — UNCHK',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
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
      </head>
      <body>
        <div id="google_translate_element" style={{display:'none'}} />
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
