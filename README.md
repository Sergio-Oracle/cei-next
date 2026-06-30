# CEI Frontend — Next.js 16 + TypeScript

**Centre d'Examen Intelligent** — Interface web pour la plateforme de surveillance d'examens en ligne.  
Dépôt Backend : [Sergio-Oracle/cei-api-v2](https://github.com/Sergio-Oracle/cei-api-v2) · Port par défaut : **5173**

---

## Architecture globale

```
┌────────────────────────────────────────────────────────────┐
│  Serveur de production (Linux / Ubuntu)                    │
│                                                            │
│  ┌─────────────────────┐    ┌──────────────────────────┐  │
│  │  cei-next (ce repo) │    │  cei-api-v2 (backend)    │  │
│  │  Next.js standalone │◄──►│  Flask + Gunicorn        │  │
│  │  Port 5173          │    │  Port 8100               │  │
│  └──────────┬──────────┘    └──────────────────────────┘  │
│             │                                              │
│  ┌──────────▼──────────┐                                  │
│  │  Nginx (proxy)      │  Port 443 / 80                   │
│  └─────────────────────┘                                  │
└────────────────────────────────────────────────────────────┘
```

---

## Prérequis

- **Node.js 18+** (`node --version`)
- **npm 9+** (`npm --version`)
- Le backend `cei-api-v2` doit être démarré sur le port 8100 (ou URL personnalisée)

---

## Variables d'environnement

Créer un fichier `.env.local` à la racine du projet :

```env
# URL du backend Flask (sans slash final)
NEXT_PUBLIC_API_URL=http://localhost:8100
```

> En production, remplacer par l'URL publique du backend, ex : `http://62.171.190.6:8100`

---

## Installation et développement local

```bash
# 1. Cloner le dépôt
git clone https://github.com/Sergio-Oracle/cei-next.git
cd cei-next

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env.local   # puis éditer .env.local
# ou créer manuellement .env.local avec NEXT_PUBLIC_API_URL

# 4. Lancer le serveur de développement
npm run dev
# → http://localhost:3000
```

---

## Build et déploiement en production (Linux)

### 1. Build

```bash
npm run build
```

Le build produit un **standalone** dans `.next/standalone/` (inclut Node.js, pas besoin d'installer next en production).

### 2. Copier les assets statiques

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

> Les icônes FontAwesome sont dans `public/fontawesome/` — elles doivent être copiées manuellement car elles ne font pas partie du build Next.js.

### 3. Script de déploiement automatique

Le script `deploy.sh` à la racine fait tout en une commande :

```bash
chmod +x deploy.sh
./deploy.sh
```

Ce script :
1. Build le projet (`npm run build`)
2. Copie `.next/static` et `public/` dans le standalone
3. Redémarre le service systemd `cei-next`
4. Vérifie que le serveur répond sur le port 5173

### 4. Service systemd

Créer `/etc/systemd/system/cei-next.service` :

```ini
[Unit]
Description=CEI Next.js Frontend
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/cei-next/.next/standalone
ExecStart=/usr/bin/node server.js
Environment=PORT=5173
Environment=HOSTNAME=0.0.0.0
Environment=NEXT_PUBLIC_API_URL=http://62.171.190.6:8100
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable cei-next
systemctl start cei-next
systemctl status cei-next
```

---

## Configuration Nginx (proxy)

Exemple de bloc serveur dans `/etc/nginx/sites-enabled/cei` :

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    # Frontend Next.js
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API Backend Flask (optionnel — si même domaine)
    location /api/ {
        proxy_pass http://127.0.0.1:8100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Structure du projet

```
cei-next/
├── app/
│   ├── dashboard/
│   │   ├── admin/        # Pages administrateur
│   │   │   ├── exams/    # Gestion des examens (ExamCopiesModal, ExamToolbarModals…)
│   │   │   └── …
│   │   ├── professor/    # Pages professeur
│   │   ├── student/      # Pages étudiant
│   │   └── surveillant/  # Pages surveillant/procteur
│   ├── exam/             # Interface de passation d'examen
│   ├── login/            # Authentification
│   └── proctor/          # Interface de surveillance live
├── components/           # Composants réutilisables (Modal, Spinner…)
├── contexts/             # React Context (Auth, Toast)
├── hooks/                # Custom hooks
├── lib/
│   └── api.ts            # Client HTTP avec PASETO + refresh automatique
├── public/
│   └── fontawesome/      # Icônes FA Pro (all.min.css + webfonts/)
├── types/                # Types TypeScript partagés
└── deploy.sh             # Script de déploiement one-shot
```

---

## Authentification

Le client API (`lib/api.ts`) gère automatiquement :

- **PASETO v4** — token stocké dans `localStorage` clé `token`
- **Refresh automatique** — cookie httpOnly `refresh_token` (7 jours), rotation à chaque refresh
- **Blob authentifié** — `api.blob(path)` pour les téléchargements protégés (PDF, ZIP) qui nécessitent l'en-tête `Authorization`

---

## Acteurs et accès

| Rôle | Chemin dashboard | Description |
|------|-----------------|-------------|
| Admin | `/dashboard/admin` | Gestion complète : examens, utilisateurs, copies, rapports |
| Professeur | `/dashboard/professor` | Création d'examens, correction des copies |
| Étudiant | `/dashboard/student` | Passation d'examen, résultats |
| Surveillant | `/dashboard/surveillant` | Monitoring live, gestion incidents |
| Procteur | `/proctor` | Interface de surveillance temps réel |

---

## Dépôts liés

| Partie | Dépôt | Port |
|--------|-------|------|
| Frontend (ce dépôt) | [Sergio-Oracle/cei-next](https://github.com/Sergio-Oracle/cei-next) | 5173 |
| Backend API | [Sergio-Oracle/cei-api-v2](https://github.com/Sergio-Oracle/cei-api-v2) | 8100 |
