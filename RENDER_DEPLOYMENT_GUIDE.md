# 🚀 Guide Complet : Déployer Fliptracker sur Render.com

## 📊 Architecture du Déploiement

```
┌─────────────────────────────────────────────────────┐
│  Render.com                                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  📱 Frontend (Static Site)                          │
│  - URL: fliptracker-frontend.onrender.com          │
│  - Buildé: React + Vite                            │
│  - Stocké: CDN statique                            │
│                                                      │
│  🔙 Backend (Web Service)                           │
│  - URL: fliptracker-backend.onrender.com           │
│  - Framework: NestJS                               │
│  - Base de données: Firestore (Firebase)           │
│  - Auth: Google OAuth                              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## ✅ Prérequis

- ✔️ Compte GitHub avec le repo Fliptracker
- ✔️ Compte Render.com (gratuit ou payant)
- ✔️ Clés Google OAuth (voir section Variables d'Environnement)
- ✔️ Fichier `serviceAccountKey.json` Firebase

---

## 🔧 Étape 1 : Préparer le Repo GitHub

### 1.1 Pousser vers GitHub

```bash
cd /workspaces/Fliptracker-gemini
git add .
git commit -m "Prepare for Render deployment"
git push origin monorepo
```

### 1.2 Vérifier la structure du monorepo

Render doit voir cette structure :
```
fliptracker/
├── package.json (root)
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json
├── apps/
│   ├── backend/
│   │   ├── package.json
│   │   ├── src/main.ts
│   │   └── tsconfig.json
│   └── frontend/
│       ├── package.json
│       ├── vite.config.ts
│       └── tsconfig.json
```

---

## 🌐 Étape 2 : Créer le Web Service Backend sur Render

### 2.1 Accéder à Render.com

1. Allez sur **[dashboard.render.com](https://dashboard.render.com)**
2. Connectez-vous avec GitHub
3. Cliquez sur **"New +"** → **"Web Service"**

### 2.2 Connecter votre repository GitHub

- Sélectionnez **fliptracker-gemini** repository
- Branch: **monorepo** (ou votre branche principale)
- Root Directory: `fliptracker/apps/backend`

### 2.3 Configurer le Web Service

```
Name:                    fliptracker-backend
Environment:             Node
Region:                  Frankfurt (EU-West)
Branch:                  monorepo
Root Directory:          fliptracker/apps/backend
Build Command:           pnpm install && pnpm build
Start Command:           node dist/main
```

### 2.4 Ajouter les variables d'environnement

1. Scrollez vers le bas → Section **Environment**
2. Cliquez sur **"Add Environment Variable"**

Copiez-collez ces variables (voir section "Variables d'Environnement" ci-dessous) :

```
NODE_ENV                 production
PORT                     3001
FRONTEND_URL             https://fliptracker-frontend.onrender.com
GOOGLE_CLIENT_ID         YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET     YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI      https://fliptracker-backend.onrender.com/api/auth/callback/google
FIREBASE_PROJECT_ID      fliptracker-52632
FIREBASE_CLIENT_EMAIL    your-firebase-client-email@...iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY     (voir instructions ci-dessous)
```

### 2.5 Créer le service

- Cliquez sur **"Create Web Service"**
- Attendez la première build (5-10 min)
- Notez votre URL backend : `https://fliptracker-backend.onrender.com`

---

## 🎨 Étape 3 : Déployer le Frontend (Static Site)

### 3.1 Créer un Static Site

1. Cliquez sur **"New +"** → **"Static Site"**
2. Sélectionnez **fliptracker-gemini** repository
3. Branch: **monorepo**
4. Root Directory: `fliptracker/apps/frontend`

### 3.2 Configurer le Static Site

```
Name:                    fliptracker-frontend
Branch:                  monorepo
Root Directory:          fliptracker/apps/frontend
Build Command:           pnpm install && pnpm build
Publish Directory:       dist
```

### 3.3 Ajouter les variables d'environnement

1. Scrollez vers le bas → Section **Environment**
2. Ajoutez ces variables :

```
VITE_API_URL             https://fliptracker-backend.onrender.com/api
VITE_FIREBASE_API_KEY    AIzaSyCX1-uVQiSZBbiLDOPQjaNXX67RHgO_6mc
VITE_FIREBASE_AUTH_DOMAIN fliptracker-52632.firebaseapp.com
VITE_FIREBASE_PROJECT_ID fliptracker-52632
VITE_FIREBASE_STORAGE_BUCKET fliptracker-52632.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID 675025970889
VITE_FIREBASE_APP_ID     1:675025970889:web:186ff8e7f1082cc05ecf18
VITE_FIREBASE_MEASUREMENT_ID G-Q2QFQ0552W
```

### 3.4 Créer le service

- Cliquez sur **"Create Static Site"**
- Attendez la build (3-5 min)
- Notez votre URL frontend : `https://fliptracker-frontend.onrender.com`

---

## 🔑 Étape 4 : Configurer les Variables d'Environnement

### 4.1 FIREBASE_PRIVATE_KEY

Le `FIREBASE_PRIVATE_KEY` doit être une seule ligne sans retours à la ligne.

**Option 1 : Depuis Firebase Console**

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet `fliptracker-52632`
3. **Paramètres du projet** → Onglet **Comptes de service**
4. Cliquez sur **Générer une nouvelle clé privée**
5. Téléchargez `serviceAccountKey.json`
6. Ouvrez le fichier et cherchez le champ `"private_key"`
7. Copiez la valeur (elle ressemble à `"-----BEGIN PRIVATE KEY-----\nMIIEv..."`

**Option 2 : À partir du fichier JSON**

```bash
# Sur votre machine locale
cat serviceAccountKey.json | jq -r '.private_key' | tr '\n' '\\n'
```

Cela affichera la clé dans le format correct pour Render.

### 4.2 Google OAuth

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Sélectionnez le projet `fliptracker-52632`
3. **APIs & Services** → **Credentials**
4. Trouvez votre OAuth 2.0 Client ID
5. Copiez `Client ID` et `Client Secret`
6. Mettez à jour le **GOOGLE_REDIRECT_URI** dans vos secrets Render

---

## 📝 Étape 5 : Mise à Jour des Variables après Déploiement

Une fois que vos services sont déployés sur Render, mettez à jour les URLs :

### Pour le Backend

1. Allez dans les **Environment Variables** du Web Service backend
2. Mettez à jour `FRONTEND_URL` avec votre URL frontend Render officielle

### Pour le Frontend

1. Allez dans les **Environment Variables** du Static Site frontend
2. Mettez à jour `VITE_API_URL` si vous avez changé le nom du service

### Pour Google OAuth

Si vous n'avez pas encore créé les credentials Google :

1. [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
3. Type: **Web Application**
4. Authorized redirect URIs:
   ```
   https://fliptracker-backend.onrender.com/api/auth/callback/google
   ```
5. Copiez les clés dans Render

---

## 🚨 Erreurs Fréquentes et Solutions

### ❌ Erreur 1 : CORS Error au login

**Symptôme :**
```
Access to XMLHttpRequest at 'https://fliptracker-backend...' 
from origin 'https://fliptracker-frontend...' has been blocked by CORS policy
```

**Cause :** Les URLs CORS ne correspondent pas.

**Solution :**
```bash
# Backend → Vérifier FRONTEND_URL
FRONTEND_URL=https://fliptracker-frontend.onrender.com

# Frontend → Vérifier API_URL dans vite.config ou httpClient
VITE_API_URL=https://fliptracker-backend.onrender.com/api
```

---

### ❌ Erreur 2 : Firebase Private Key Invalid

**Symptôme :**
```
Error: INVALID_ARGUMENT: Certificate has invalid format
```

**Cause :** La clé privée Firebase contient des retours à la ligne.

**Solution :**
1. Ouvrez votre `.env` ou les variables Render
2. La clé doit être sur UNE SEULE LIGNE
3. Format correct :
   ```
   -----BEGIN PRIVATE KEY-----\nMIIEv...kQw==\n-----END PRIVATE KEY-----\n
   ```

---

### ❌ Erreur 3 : 502 Bad Gateway

**Symptôme :**
```
502 Bad Gateway - The service is temporarily unavailable
```

**Cause :** Le backend crash ou ne démarre pas.

**Solution :**
1. Allez dans **Logs** du Web Service backend
2. Cherchez l'erreur exacte
3. Vérifications courantes :
   - Vérifiez que `npm run build` fonctionne localement
   - Vérifiez que toutes les dépendances sont dans `package.json`
   - Assurez-vous que le `Start Command` est correct : `node dist/main`

---

### ❌ Erreur 4 : Le frontend ne se charge pas

**Symptôme :**
```
Cannot GET /
```

**Cause :** Le dossier `dist` est vide ou mal nommé.

**Solution :**
1. Vérifiez votre `vite.config.ts` :
   ```typescript
   build: {
     outDir: 'dist',  // Doit être 'dist', pas '../../docs'
   }
   ```
2. Vérifiez le **Publish Directory** sur Render : doit être `dist`

---

### ❌ Erreur 5 : 404 sur les routes de l'API

**Symptôme :**
```
GET /api/auth/login returns 404
```

**Cause :** 
- Le backend ne démarre pas correctement
- Le global prefix n'est pas appliqué

**Solution :**
1. Vérifiez `main.ts` : doit avoir `app.setGlobalPrefix('api')`
2. Vérifiez les logs backend : `cat logs` depuis le dashboard Render

---

### ❌ Erreur 6 : "Port already in use"

**Symptôme :**
```
listen EADDRINUSE: address already in use :::3001
```

**Cause :** Le port 3001 est occupé (rare sur Render, mais peut arriver en local).

**Solution :**
1. Assurez-vous que votre `package.json` backend a :
   ```json
   "start:prod": "node dist/main"
   ```
2. Render set automatiquement le PORT via variable d'environnement

---

### ❌ Erreur 7 : Build échoue avec "pnpm not found"

**Symptôme :**
```
npm ERR! pnpm: command not found
```

**Cause :** Render n'a pas pnpm par défaut.

**Solution :**
Render détecte automatiquement `pnpm-lock.yaml` et installe pnpm. Si ça ne marche pas :

1. Allez dans **Settings** du Web Service
2. Ajoutez cette variable d'environnement :
   ```
   VITE_USE_PNPM=true
   ```

---

## ✅ Checklist de Déploiement

- [ ] Repository GitHub prêt (avec tous les fichiers)
- [ ] Backend Web Service créé sur Render
- [ ] Frontend Static Site créé sur Render
- [ ] FIREBASE_PRIVATE_KEY configurée (format correct)
- [ ] GOOGLE_CLIENT_ID et SECRET configurés
- [ ] FRONTEND_URL dans le backend pointe vers le bon domaine
- [ ] VITE_API_URL dans le frontend pointe vers le backend
- [ ] Première build réussie (vérifiez les logs)
- [ ] Frontend chargeable via HTTPS
- [ ] Login Google fonctionne
- [ ] Cookies de session travaillent correctement

---

## 🔄 Mettre à Jour le Déploiement

### Push d'une mise à jour du code

```bash
git add .
git commit -m "Update feature X"
git push origin monorepo
```

Render se redéploie automatiquement ! Vérifiez les logs dans le dashboard.

### Redéployer manuellement

1. Allez sur le Web Service ou Static Site
2. Cliquez sur **"Manual Deploy"** → **"Deploy Latest Commit"**

---

## 📞 Support et Dépannage

**Logs** : Cliquez sur votre service → Onglet **Logs** pour voir les erreurs en temps réel

**Health Check** : Si votre backend repeat crash, vérifiez :
- Que toutes les dépendances sont installées
- Que le `Start Command` est correct
- Les variables d'environnement

---

## 🎯 Prochaines Étapes

Après le déploiement réussi :

1. ✅ Testez la création d'un compte Google
2. ✅ Testez la synchronisation d'emails
3. ✅ Testez la création de colis
4. ✅ Vérifiez les performances en production
5. ✅ Mettez en place des alertes/monitoring

---

**Questions ?** Consultez la [documentation Render](https://render.com/docs) ou relisez cette guide.
