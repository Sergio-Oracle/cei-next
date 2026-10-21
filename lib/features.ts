/* Interrupteur des fonctions dont le serveur n'est pas encore en production
   (Moodle, Moteur RAG). Défini au BUILD : deploy-to-prod.sh met
   NEXT_PUBLIC_MOODLE_UI=0, local et préprod gardent l'interface. À retirer
   (ou passer à 1 dans deploy-to-prod.sh) seulement après validation sur
   préprod ET accord explicite de l'utilisateur pour la production. */
export const MOODLE_UI = process.env.NEXT_PUBLIC_MOODLE_UI !== '0'

/* Moteur RAG : serveur dédié pas encore livré en production. Interface masquée tant que
   deploy-to-prod.sh construit avec NEXT_PUBLIC_RAG_UI=0 (indépendant de l'interface Moodle). */
export const RAG_UI = process.env.NEXT_PUBLIC_RAG_UI !== '0'
