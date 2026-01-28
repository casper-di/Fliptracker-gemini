# ✅ Render Deployment Checklist - À imprimer

Rendez-vous sur https://render.com pour cette checklist interactive

---

## 📋 Phase 1: Préparation locale

### Vérification d'environnement
- [ ] Node.js 18+ installé (`node -v`)
- [ ] pnpm installé (`pnpm -v`)
- [ ] Git installé (`git -v`)
- [ ] Repo GitHub pushée (main branch)

### Exécuter les scripts
```bash
cd /workspaces/Fliptracker-gemini
bash fliptracker/scripts/render-deploy-helper.sh
```
- [ ] Tous les tests passent ✅
- [ ] "Prêt pour le déploiement Render"

### Configuration des clés
- [ ] Clés Firebase téléchargées
  - [ ] FIREBASE_PROJECT_ID
  - [ ] FIREBASE_CLIENT_EMAIL
  - [ ] FIREBASE_PRIVATE_KEY
  
- [ ] Clés Google OAuth obtenues
  - [ ] GOOGLE_CLIENT_ID
  - [ ] GOOGLE_CLIENT_SECRET

### Remplir les fichiers .env.render

**Backend** (`fliptracker/apps/backend/.env.render`):
```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://fliptracker-frontend.onrender.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://fliptracker-backend.onrender.com/api/auth/callback/google
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

- [ ] NODE_ENV=production
- [ ] PORT=3001
- [ ] FRONTEND_URL (sera mis à jour après déploiement)
- [ ] GOOGLE_CLIENT_ID
- [ ] GOOGLE_CLIENT_SECRET
- [ ] GOOGLE_REDIRECT_URI (sera mis à jour après déploiement)
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_CLIENT_EMAIL
- [ ] FIREBASE_PRIVATE_KEY (format avec \n littérales)

**Frontend** (`fliptracker/apps/frontend/.env.render`):
```
VITE_API_URL=https://fliptracker-backend.onrender.com/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

- [ ] VITE_API_URL (sera mis à jour après déploiement)
- [ ] VITE_FIREBASE_API_KEY
- [ ] VITE_FIREBASE_AUTH_DOMAIN
- [ ] VITE_FIREBASE_PROJECT_ID

### Git
- [ ] `git add -A`
- [ ] `git commit -m "chore: render deployment setup"`
- [ ] `git push origin main`

---

## 🚀 Phase 2: Créer le Backend sur Render

1. Allez sur https://dashboard.render.com
2. Cliquez "+ New" → "Web Service"
3. Connectez votre repo GitHub

### Configuration Web Service

| Champ | Valeur |
|-------|--------|
| Name | fliptracker-backend |
| Root Directory | `fliptracker/apps/backend` |
| Environment | Node |
| Region | Frankfurt (EU) |
| Branch | main |
| Build Command | `pnpm install && pnpm build` |
| Start Command | `node dist/main` |

- [ ] Web Service créé
- [ ] Build en cours...
- [ ] ✅ Service is live
- [ ] **Notez l'URL backend** → `https://fliptracker-backend.onrender.com`

### Variables d'environnement (Web Service)

- [ ] NODE_ENV = production
- [ ] PORT = 3001
- [ ] GOOGLE_CLIENT_ID = [votre valeur]
- [ ] GOOGLE_CLIENT_SECRET = [votre valeur]
- [ ] GOOGLE_REDIRECT_URI = https://fliptracker-backend.onrender.com/api/auth/callback/google
- [ ] FIREBASE_PROJECT_ID = [votre valeur]
- [ ] FIREBASE_CLIENT_EMAIL = [votre valeur]
- [ ] FIREBASE_PRIVATE_KEY = [votre valeur - format \n littérales]
- [ ] FRONTEND_URL = (à mettre à jour après frontend)

### Vérification des logs

Render → fliptracker-backend → Logs
- [ ] Pas d'erreurs de démarrage
- [ ] "Listening on port 3001"
- [ ] Pas d'erreurs Firebase

---

## 🎨 Phase 3: Créer le Frontend sur Render

1. Allez sur https://dashboard.render.com
2. Cliquez "+ New" → "Static Site"
3. Connectez votre repo GitHub

### Configuration Static Site

| Champ | Valeur |
|-------|--------|
| Name | fliptracker-frontend |
| Root Directory | `fliptracker/apps/frontend` |
| Build Command | `pnpm install && pnpm build` |
| Publish Directory | `dist` |
| Branch | main |

- [ ] Static Site créé
- [ ] Build en cours...
- [ ] ✅ Site is live
- [ ] **Notez l'URL frontend** → `https://fliptracker-frontend.onrender.com`

### Variables d'environnement (Static Site)

- [ ] VITE_API_URL = https://fliptracker-backend.onrender.com/api
- [ ] VITE_FIREBASE_API_KEY = [votre valeur]
- [ ] VITE_FIREBASE_AUTH_DOMAIN = [votre valeur]
- [ ] VITE_FIREBASE_PROJECT_ID = [votre valeur]

### Vérification du site

Render → fliptracker-frontend → Build Logs
- [ ] Build réussi
- [ ] Pas d'erreurs TypeScript
- [ ] Site accessible

---

## 🔄 Phase 4: Mettre à jour les configurations croisées

### Backend: FRONTEND_URL

1. Render → fliptracker-backend → Environment
2. Modifiez `FRONTEND_URL`:
   ```
   https://fliptracker-frontend.onrender.com
   ```
- [ ] Valeur mise à jour
- [ ] Service redéploie (attendre 1-2 min)

### Frontend: VITE_API_URL (si nécessaire)

1. Render → fliptracker-frontend → Environment
2. Vérifiez `VITE_API_URL`:
   ```
   https://fliptracker-backend.onrender.com/api
   ```
- [ ] Valeur correcte
- [ ] Site redéploie (attendre 1-2 min)

---

## 🔐 Phase 5: Google OAuth Configuration

1. Allez sur https://console.cloud.google.com
2. Sélectionnez votre projet
3. APIs & Services → Credentials
4. Cliquez sur votre OAuth 2.0 Client

### Authorized URIs

Mettez à jour les URIs autorisées:

**Authorized JavaScript origins:**
- [ ] `https://fliptracker-backend.onrender.com`

**Authorized redirect URIs:**
- [ ] `https://fliptracker-backend.onrender.com/api/auth/callback/google`

- [ ] URIs mises à jour
- [ ] Cliquez "Save"

---

## 🧪 Phase 6: Test complet

### Accès au site

1. Ouvrez https://fliptracker-frontend.onrender.com
- [ ] Page d'accueil affichée
- [ ] Pas d'erreurs 404
- [ ] Page responsive (mobile ok)

### Page d'authentification

1. Cliquez "Commencer maintenant"
- [ ] Redirigé vers page d'authentification
- [ ] Bouton "Sign in with Google" visible
- [ ] Pas d'erreurs JavaScript (F12 → Console)

### Google Sign-In

1. Cliquez "Sign in with Google"
- [ ] Redirigé vers page de consentement Google
- [ ] Choisissez un compte Google
- [ ] ✅ Acceptez les permissions
- [ ] Redirigé vers l'app (connecté)

### Dashboard

- [ ] Voir "Welcome, [Your Name]"
- [ ] Voir votre email
- [ ] Voir les boutons d'action
- [ ] Pas d'erreurs dans la console (F12)

### Fonctionnalités

- [ ] Ajouter une expédition (parcel)
- [ ] Voir le détail de l'expédition
- [ ] Synchroniser les emails (si implémenté)
- [ ] Se déconnecter et se reconnecter

### Vérification des logs

**Render Backend Logs:**
- [ ] POST `/api/auth/login/google` → 200
- [ ] GET `/api/auth/callback/google?code=...` → 302 redirect
- [ ] GET `/api/auth/me` → 200 + user data
- [ ] Pas d'erreurs 500

**Browser DevTools (F12):**
- [ ] Console: Pas d'erreurs CORS
- [ ] Network: Toutes les requêtes réussissent (200)
- [ ] Application: Session cookie présent

---

## 📊 Phase 7: Post-déploiement

### Monitoring

Configurez des alertes Render:
- [ ] Alertes email en cas de crash
- [ ] Logs vérifiés quotidiennement
- [ ] Uptime monitor activé

### Sauvegardes

- [ ] Sauvegardez vos variables d'environnement (Google Drive, 1Password, etc.)
- [ ] Documentez les URLs de production
- [ ] Notez les dates de création des clés

### Documentation

- [ ] Équipe informée de l'URL en production
- [ ] Accès Render partagé (si nécessaire)
- [ ] Procédure de rollback documentée

### Performance

- [ ] Testez avec https://pagespeed.web.dev
- [ ] Frontend: Vérifiez la taille du bundle
- [ ] Backend: Vérifiez les temps de réponse
- [ ] Database: Vérifiez les indexes Firestore

---

## 🚨 Dépannage rapide

Si ça ne fonctionne pas, consultez:

- **502 Bad Gateway** → Voir [RENDER_DEPLOYMENT_GUIDE.md](../RENDER_DEPLOYMENT_GUIDE.md#-error-502-bad-gateway)
- **CORS Error** → Voir [RENDER_DEPLOYMENT_GUIDE.md](../RENDER_DEPLOYMENT_GUIDE.md#-cors-error-access-to-xmlhttprequest-denied)
- **redirect_uri_mismatch** → Voir [RENDER_DEPLOYMENT_GUIDE.md](../RENDER_DEPLOYMENT_GUIDE.md#-error-google-sign-in-redirect_uri_mismatch)
- **Firebase Private Key Invalid** → Voir [docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md)
- **Build failed** → Consulter les logs Render

---

## ✅ Vous avez réussi!

Félicitations! Fliptracker est maintenant en production sur Render.com 🎉

### Prochaines étapes

- [ ] Partagez l'URL avec votre équipe
- [ ] Configurez un domaine personnalisé (optionnel)
- [ ] Mettez à jour votre documentation
- [ ] Célébrez! 🎉

---

**Besoin d'aide?**
- 📖 [RENDER_DEPLOYMENT_GUIDE.md](../RENDER_DEPLOYMENT_GUIDE.md)
- 📖 [QUICKSTART.md](../QUICKSTART.md)
- 📖 [docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md)
- 📖 [docs/GOOGLE_OAUTH_SETUP.md](../docs/GOOGLE_OAUTH_SETUP.md)

---

Imprimez cette checklist et cochez les cases au fur et à mesure! 📋✅
