'use client'

import { useEffect } from 'react'

/* Charge le widget Google Translate APRÈS l'hydratation React.
   Chargé auparavant depuis <head> en async, il modifiait le style de <html>
   et <body> et injectait son gadget dans un <div> rendu par React ; quand il
   finissait avant l'hydratation, React trouvait un DOM différent du HTML
   serveur → erreur React #418 intermittente sur toutes les pages. Le
   conteneur est donc créé ici, hors de l'arbre React, et le script ajouté une
   fois la page hydratée. Les sélecteurs de langue (accueil, connexion,
   en-tête) continuent d'utiliser select.goog-te-combo et le cookie googtrans. */

declare global {
  interface Window {
    googleTranslateElementInit?: () => void
    google?: any
  }
}

const SCRIPT_ID = 'cei-google-translate'

export default function GoogleTranslateLoader() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return
    if (!document.getElementById('google_translate_element')) {
      const box = document.createElement('div')
      box.id = 'google_translate_element'
      box.style.display = 'none'
      document.body.appendChild(box)
    }
    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        { pageLanguage: 'fr', includedLanguages: 'fr,en,wo', autoDisplay: false },
        'google_translate_element',
      )
    }
    const s = document.createElement('script')
    s.id = SCRIPT_ID
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
    s.async = true
    document.body.appendChild(s)
  }, [])
  return null
}
