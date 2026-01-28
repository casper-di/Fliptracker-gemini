# 🚀 Quickstart: Deployer Fliptracker sur Render.com

**Durée estimée:** 30-45 minutes  
**Niveau:** Intermédiaire  
**Prérequis:** Compte Render.com, GitHub, Google Cloud, Firebase

---

## 📋 Checklist rapide

```
ÉTAPE 1: Préparer le code local
  ☐ cd fliptracker
  ☐ bash scripts/pre-render-check.sh
  ☐ Tous les tests passent ✅

ÉTAPE 2: Configurer les clés
  ☐ Lire: docs/FIREBASE_SETUP.md
  ☐ Lire: docs/GOOGLE_OAUTH_SETUP.md
  ☐ Compléter: fliptracker/apps/backend/.env.render
  ☐ Compléter: fliptracker/apps/frontend/.env.render

ÉTAPE 3: Commit et push
  ☐ git add -A
  ☐ git commit -m "chore: render deployment setup"
  ☐ git push origin main

ÉTAPE 4: Déployer sur Render
  ☐ Créer Web Service (Backend)
  ☐ Créer Static Site (Frontend)
  ☐ Configurer variables d'environnement
  ☐ Vérifier que les déploiements réussissent

ÉTAPE 5: Mettre à jour les configurations croisées
  ☐ Backend: FRONTEND_URL = frontend-url.onrender.com
  ☐ Frontend: VITE_API_URL = backend-url.onrender.com/api
  ☐ Google Cloud: Ajouter redirect URI

ÉTAPE 6: Tester en production
  ☐ Ouvrir le site frontend
  ☐ Cliquer "Commencer maintenant"
  ☐ "Sign in with Google" fonctionne ✅
```

---

## 🏃 Les 5 minutes essentielles

### 1️⃣ Vérifier que tout compile

```bash
cd fliptracker
bash scripts/pre-render-check.sh
```

✅ Résultat attendu:
```
✅ Backend compilé
✅ Frontend compilé
✅ Tous les contrôles sont passés!
```

### 2️⃣ Obtenir les clés Firebase

```bash
# Téléchargez firebase-service-account.json depuis Firebase Console
node fliptracker/scripts/extract-firebase-keys.js
```

Ou simplement consultez [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)

### 3️⃣ Obtenir les clés Google OAuth

Consultez [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md)

### 4️⃣ Remplir les .env.render

**Backend** (`fliptracker/apps/backend/.env.render`):
```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend.onrender.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/api/auth/callback/google
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

**Frontend** (`fliptracker/apps/frontend/.env.render`):
```bash
VITE_API_URL=https://your-backend.onrender.com/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

### 5️⃣ Pousser sur GitHub

```bash
git add -A
git commit -m "chore: render deployment setup"
git push origin main
```

---

## 🔧 Commandes Render (dans le dashboard)

### Backend (Web Service)

```
Build Command:    pnpm install && pnpm build
Start Command:    node dist/main
Root Directory:   fliptracker/apps/backend
```

### Frontend (Static Site)

```
Build Command:     pnpm install && pnpm build
Publish Directory: dist
Root Directory:    fliptracker/apps/frontend
```

---

## 🎯 Architecture finale

```
┌─────────────────────────────────────────┐
│ https://fliptracker-frontend.onrender.com
│ (React app + Vite build)
└──────────────┬──────────────────────────┘
               │ Fetch to /api
               ↓
┌──────────────────────────────────────────┐
│ https://fliptracker-backend.onrender.com │
│ ├─ /api/auth/login/google                │
│ ├─ /api/auth/callback/google             │
│ ├─ /api/parcels (data)                   │
│ └─ /api/... (other endpoints)            │
└──────────────┬──────────────────────────┘
               │
               ↓
        Google OAuth &
        Firestore Database
```

---

## ⚠️ Erreurs les plus fréquentes

| Erreur | Solution |
|--------|----------|
| **502 Bad Gateway** | Backend n'écoute pas. Vérifiez les logs et `PORT=3001` |
| **CORS Error** | `FRONTEND_URL` ne correspond pas. Mettez-à-jour dans Render |
| **redirect_uri_mismatch** | L'URL callback ne correspond pas dans Google Cloud Console |
| **Cannot GET /** | Frontend: vérifiez que `dist/` est créé et publié |
| **Firebase Private Key Invalid** | Les newlines doivent être `\n` littérales, pas de vraies newlines |

👉 Consultez [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md) pour 7+ solutions détaillées

---

## 📖 Documentation complète

- [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md) - Guide complet avec 7 scénarios d'erreur
- [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) - Obtenir et configurer les clés Firebase
- [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md) - OAuth 2.0 Google configuration

---

## 🤖 Scripts d'aide

```bash
# Valider votre environnement avant déploiement
bash fliptracker/scripts/pre-render-check.sh

# Extraire les clés Firebase (requiert firebase-service-account.json)
node fliptracker/scripts/extract-firebase-keys.js

# Valider les variables d'environnement
node fliptracker/scripts/validate-render-env.js
```

---

## 🆘 Besoin d'aide?

1. **Erreur non listée** → Consultez [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md)
2. **Problème Firebase** → Voir [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)
3. **Problème OAuth** → Voir [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md)
4. **Logs d'erreur** → Render Dashboard → Service → Logs
5. **Logs navigateur** → F12 → Console (recherchez les erreurs CORS/fetch)

---

**Vous êtes prêt.e!** 🎉 Suivez la checklist ci-dessus et vous devreriez être en production en 30 minutes.

