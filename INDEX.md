# 📚 Fliptracker - Guides de déploiement

**Bienvenue!** Vous trouverez ici tous les guides pour déployer Fliptracker sur Render.com

---

## 🚀 Démarrer rapidement

### Pour les impatients (5 minutes)

👉 **Commencez par:** [QUICKSTART.md](QUICKSTART.md)

- Checklist rapide
- Les 5 commandes essentielles
- Architecture finale
- Erreurs les plus fréquentes

---

## 📖 Guides détaillés

### 1. Guide principal de déploiement
**Fichier:** [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md)  
**Durée:** 30-45 minutes  
**Contient:**
- Architecture complète
- 5 étapes de déploiement
- Variables d'environnement (backend + frontend)
- Configuration Google OAuth
- Erreurs fréquentes (7+ scénarios)
- Post-déploiement et monitoring

👉 **Lisez ceci en deuxième**

---

### 2. Configuration Firebase
**Fichier:** [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)  
**Durée:** 10 minutes  
**Contient:**
- Comment obtenir les clés Firebase
- Service account JSON
- Variables requises (backend)
- Variables requises (frontend)
- Format de la clé privée
- Dépannage Firebase

👉 **Lisez ceci pour les clés Firebase**

---

### 3. Configuration Google OAuth
**Fichier:** [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md)  
**Durée:** 10 minutes  
**Contient:**
- Créer des identifiants OAuth
- Scopes et permissions
- Authorized URIs
- Tester localement
- Flux OAuth
- Dépannage OAuth

👉 **Lisez ceci pour les clés Google**

---

### 4. Checklist imprimable
**Fichier:** [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)  
**Format:** ✅ À cocher  
**Contient:**
- 7 phases de déploiement
- Cases à cocher
- Valeurs à vérifier
- Tests de validation
- Post-déploiement

👉 **Imprimez ceci pour suivre votre progression**

---

## 🛠️ Scripts d'aide

### Scripts disponibles

```bash
# 1. Vérification principale (à exécuter en premier!)
bash fliptracker/scripts/render-deploy-helper.sh

# 2. Vérification rapide
bash fliptracker/scripts/pre-render-check.sh

# 3. Valider les variables d'environnement
node fliptracker/scripts/validate-render-env.js

# 4. Extraire les clés Firebase
node fliptracker/scripts/extract-firebase-keys.js
```

**Documentation des scripts:** [fliptracker/scripts/README.md](fliptracker/scripts/README.md)

---

## 📋 Fichiers à remplir

Vous devez compléter ces fichiers avec vos clés:

1. **Backend:** `fliptracker/apps/backend/.env.render`
   - Google OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
   - Firebase: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
   - URLs: FRONTEND_URL, GOOGLE_REDIRECT_URI

2. **Frontend:** `fliptracker/apps/frontend/.env.render`
   - API URL: VITE_API_URL
   - Firebase public: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID

---

## 🎯 Workflow recommandé

### Jour 1: Préparation

```
┌─────────────────────────────────────┐
│ 1. Lisez QUICKSTART.md (5 min)     │
│ 2. Lisez ce fichier (2 min)         │
│ 3. Exécutez render-deploy-helper.sh │
│ 4. Obtenez les clés Firebase        │
│ 5. Obtenez les clés Google OAuth    │
│ 6. Remplissez les .env.render       │
└─────────────────────────────────────┘
```

### Jour 2: Déploiement

```
┌──────────────────────────────────────┐
│ 1. git add -A && git push            │
│ 2. Créez Web Service Backend         │
│ 3. Attendez le déploiement (3-5 min) │
│ 4. Notez l'URL backend               │
│ 5. Créez Static Site Frontend        │
│ 6. Attendez le déploiement (2-3 min) │
│ 7. Notez l'URL frontend              │
└──────────────────────────────────────┘
```

### Jour 2-3: Configuration croisée

```
┌──────────────────────────────────────┐
│ 1. Mettez à jour FRONTEND_URL        │
│ 2. Mettez à jour VITE_API_URL        │
│ 3. Configurez Google OAuth           │
│ 4. Testez l'authentification         │
│ 5. Vérifiez les logs                 │
│ 6. Célébrez! 🎉                      │
└──────────────────────────────────────┘
```

---

## 🗺️ Structure du repo (après déploiement)

```
fliptracker/
├── apps/
│   ├── backend/                          ← Web Service (Render)
│   │   ├── src/
│   │   ├── dist/                         ← Deploy ceci
│   │   ├── .env.render                   ← Variables prod
│   │   └── package.json
│   │
│   └── frontend/                         ← Static Site (Render)
│       ├── src/
│       ├── dist/                         ← Deploy ceci
│       ├── .env.render                   ← Variables prod
│       └── package.json
│
├── docs/
│   ├── FIREBASE_SETUP.md                 ← Clés Firebase
│   └── GOOGLE_OAUTH_SETUP.md             ← Clés OAuth
│
├── fliptracker/scripts/
│   ├── render-deploy-helper.sh           ← À exécuter en premier!
│   ├── pre-render-check.sh               ← Vérification rapide
│   ├── validate-render-env.js            ← Valider variables
│   ├── extract-firebase-keys.js          ← Extraire clés
│   └── README.md                         ← Doc des scripts
│
├── QUICKSTART.md                         ← Commencez ici (5 min)
├── RENDER_DEPLOYMENT_GUIDE.md            ← Guide complet (30 min)
├── DEPLOYMENT_CHECKLIST.md               ← À imprimer (cocher les cases)
└── INDEX.md                              ← Ce fichier

```

---

## ⚡ Points clés à retenir

### ✅ À FAIRE

- ✅ Utilisez `pnpm` (ne changez pas à npm!)
- ✅ Vérifiez que la clé Firebase commence par `-----BEGIN PRIVATE KEY-----`
- ✅ Assurez-vous que FRONTEND_URL correspond exactement à votre domaine
- ✅ Testez Google Sign-In localement avant Render
- ✅ Vérifiez les logs Render en cas d'erreur

### ❌ À ÉVITER

- ❌ Ne commitez jamais les vraies clés dans git
- ❌ Ne réutilisez pas les secrets dev pour la prod
- ❌ Ne lancez pas `npm install` (utilisez `pnpm`)
- ❌ Ne mettez pas de vraies newlines dans FIREBASE_PRIVATE_KEY
- ❌ Ne configurez pas Google OAuth sans vérifier les redirect URIs

---

## 🚨 En cas de problème

### Erreur non trouvée dans les guides?

1. Vérifiez les logs Render (Dashboard → Service → Logs)
2. Ouvrez DevTools (F12 → Console) pour voir les erreurs client
3. Consultez [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md#erreurs-fréquentes-et-solutions)

### Besoin d'aide?

- **Firebase:** [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)
- **Google OAuth:** [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md)
- **Render:** [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md)

---

## 📊 Arborescence des guides

```
├─ QUICKSTART.md (5 min) ────────────────────┐
│                                              │
├─ RENDER_DEPLOYMENT_GUIDE.md (30 min) ─────┐│
│                                              ││
├─ docs/FIREBASE_SETUP.md (10 min) ─────────┐││
│                                              │││
├─ docs/GOOGLE_OAUTH_SETUP.md (10 min) ────┐│││
│                                              ││││
├─ DEPLOYMENT_CHECKLIST.md (À imprimer) ───┐│││
│                                              │││
├─ fliptracker/scripts/README.md ───────────┐││
│                                              ││
└─ Ce fichier (INDEX.md) ──────────────────┘││
                                              ││
                        Référence complète ───┘│
                                               │
                        Déploiement réel ──────┘

```

---

## 🎓 Apprentissage

Si vous êtes nouveau sur:

- **Monorepo (pnpm workspaces):** Consultez `fliptracker/package.json` et `pnpm-workspace.yaml`
- **NestJS:** [NestJS Docs](https://docs.nestjs.com/)
- **React + Vite:** [Vite Docs](https://vitejs.dev/)
- **Firebase:** [Firebase Docs](https://firebase.google.com/docs)
- **Google OAuth:** [OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

---

## 📞 Support

- **Documentation** → Fichiers .md ci-dessus
- **Logs** → Render Dashboard → Service → Logs
- **Console navigateur** → F12 → Console tab
- **GitHub Issues** → Si vous avez un bug

---

## ✨ Maintenant, prêt?

**Commencez par:** 👉 [QUICKSTART.md](QUICKSTART.md)

Vous devriez être en production en **moins d'une heure** 🚀

---

**Version:** 1.0 | **Status:** Production Ready ✅ | **Dernière mise à jour:** Janvier 2025
