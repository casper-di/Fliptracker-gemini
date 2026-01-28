# 🛠️ Scripts de déploiement Render

Scripts d'aide pour préparer et déployer Fliptracker sur Render.com

## 📦 Scripts disponibles

### 1. `render-deploy-helper.sh` 🚀

**Script principal de vérification**

```bash
bash fliptracker/scripts/render-deploy-helper.sh
```

**Vérifie:**
- ✅ Node.js, pnpm, Git installés
- ✅ Structure du monorepo complète
- ✅ Fichiers .env.render existent
- ✅ Backend compile sans erreurs
- ✅ Frontend compile sans erreurs
- ✅ Taille des builds
- ✅ État Git (commits)

**Résultat:** Vous êtes prêt pour Render si tous les tests passent

---

### 2. `pre-render-check.sh` 🔍

**Vérification rapide avant déploiement**

```bash
bash fliptracker/scripts/pre-render-check.sh
```

**Vérifie:**
- ✅ Node.js et pnpm disponibles
- ✅ Fichiers de configuration présents
- ✅ Build réussit
- ✅ Outputs (dist/) créés

**Résultat:** Simple check de compilation

---

### 3. `validate-render-env.js` 📋

**Valide les variables d'environnement**

```bash
node fliptracker/scripts/validate-render-env.js
```

**Vérifie:**
- ✅ Toutes les variables requises sont présentes
- ✅ Fichiers .env.render existent
- ✅ Scripts de build/start définis

**Variables vérifiées:**

Backend:
```
NODE_ENV, PORT, FRONTEND_URL
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
```

Frontend:
```
VITE_API_URL
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID
```

---

### 4. `extract-firebase-keys.js` 🔑

**Extrait les clés Firebase du service account**

```bash
node fliptracker/scripts/extract-firebase-keys.js
```

**Prérequis:**
- Fichier `fliptracker/firebase-service-account.json` présent

**Résultat:** Affiche les valeurs formatées pour Render

```
FIREBASE_PROJECT_ID=my-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@my-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

---

## 🚀 Workflow complet

### 1. Avant de commencer

```bash
# Depuis la racine du repo
bash fliptracker/scripts/render-deploy-helper.sh
```

✅ Tous les tests doivent passer

### 2. Préparer les clés

```bash
# Obtenez les clés Firebase
node fliptracker/scripts/extract-firebase-keys.js

# Consultez les guides
cat docs/FIREBASE_SETUP.md      # Firebase
cat docs/GOOGLE_OAUTH_SETUP.md  # Google OAuth
```

### 3. Remplir les .env.render

```bash
# Backend
nano fliptracker/apps/backend/.env.render
# Remplissez: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FIREBASE_*

# Frontend
nano fliptracker/apps/frontend/.env.render
# Remplissez: VITE_FIREBASE_*, VITE_API_URL
```

### 4. Valider les variables

```bash
node fliptracker/scripts/validate-render-env.js
```

✅ Pas d'erreurs = vous êtes prêt

### 5. Commit et push

```bash
git add -A
git commit -m "chore: render deployment setup"
git push origin main
```

### 6. Déployer sur Render

Suivez [RENDER_DEPLOYMENT_GUIDE.md](../RENDER_DEPLOYMENT_GUIDE.md)

---

## 📝 Variables d'environnement requises

### Backend (.env.render)

```bash
# Obligatoires
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend.onrender.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/api/auth/callback/google
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Frontend (.env.render)

```bash
# Obligatoires
VITE_API_URL=https://your-backend.onrender.com/api
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

---

## 🔧 Troubleshooting

### ❌ "Node.js not found"
```bash
# Installez Node.js 18+
# https://nodejs.org/
```

### ❌ "pnpm not found"
```bash
npm install -g pnpm@10
```

### ❌ "Firebase key invalid"
```bash
# Vérifiez que private_key commence par:
# -----BEGIN PRIVATE KEY-----
# Et finit par:
# -----END PRIVATE KEY-----\n

# Les \n doivent être littérales, pas de vraies newlines!
```

### ❌ Erreur de compilation
```bash
# Voir les logs détaillés
cd fliptracker
pnpm install
pnpm build
```

---

## 📚 Documentation

- [QUICKSTART.md](../QUICKSTART.md) - Guide rapide 5 min
- [RENDER_DEPLOYMENT_GUIDE.md](../RENDER_DEPLOYMENT_GUIDE.md) - Guide complet
- [docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md) - Firebase
- [docs/GOOGLE_OAUTH_SETUP.md](../docs/GOOGLE_OAUTH_SETUP.md) - OAuth

---

## 💡 Tips

1. **Exécutez `render-deploy-helper.sh` en premier** - Ça vérifie tout
2. **Utilisez des secrets distincts pour dev/prod** - Ne réutilisez pas les clés
3. **Testez localement d'abord** - `npm run dev` dans fliptracker/
4. **Consultez les logs Render** - Dashboard → Logs si ça casse
5. **Notez vos URLs** - Vous en aurez besoin pour Google OAuth

---

**Questions?** Consultez les guides dans `/docs/` ou [RENDER_DEPLOYMENT_GUIDE.md](../RENDER_DEPLOYMENT_GUIDE.md)

