# 🔐 Configuration Google OAuth pour Render

## Aperçu du flux OAuth

```
┌─────────────────┐
│    Frontend     │
│ (Fliptracker)   │
└────────┬────────┘
         │ "Sign in with Google"
         ↓
┌──────────────────────┐
│   Google OAuth       │
│  Consent Screen      │
└────────┬─────────────┘
         │ Utilisateur accepte
         ↓
┌─────────────────────────┐
│      Backend Render     │
│ /api/auth/callback/google
└────────┬────────────────┘
         │ Échange le code
         ↓
┌──────────────────────┐
│ Google Token Server  │
│ Retourne ID token    │
└────────┬─────────────┘
         │
         ↓
┌─────────────────┐
│    Firestore    │
│ Crée/met à jour │
│    l'utilisateur│
└────────┬────────┘
         │
         ↓
┌──────────────────────┐
│   Frontend             │
│ Reçoit session cookie │
│ Redirection Dashboard │
└──────────────────────┘
```

## 1. Créer des identifiants OAuth

### A. Accéder à Google Cloud Console

Allez sur https://console.cloud.google.com

### B. Créer/Sélectionner un projet

1. Cliquez sur le projet dropdown en haut
2. Ou créez un nouveau projet:
   - "New Project"
   - Nom: "Fliptracker"
   - Créez

### C. Activer l'API Google+ (Identity API)

1. Menu → APIs & Services → Library
2. Cherchez "Google+ API"
3. Cliquez → Enable
4. Ou cherchez "Identity" → Google Identity Services

### D. Créer les identifiants OAuth 2.0

1. APIs & Services → Credentials
2. Cliquez "+ Create Credentials" → "OAuth 2.0 Client ID"
3. Si demandé, d'abord créez un **OAuth 2.0 Consent Screen**:
   - Cliquez "Configure Consent Screen"
   - Type d'utilisateurs: "External"
   - Remplissez:
     - App name: "Fliptracker"
     - Support email: votre email
     - Developer contact: votre email
   - Cliquez "Save and Continue"
   - Scopes: Cliquez "Add or Remove Scopes"
     - Cherchez "email" et "profile"
     - Sélectionnez-les
     - Cliquez "Update"
   - Cliquez "Save and Continue"
   - Finalisez

### E. Ajouter les URIs autorisées

Retour aux Credentials:

1. Créez un nouveau "OAuth 2.0 Client ID"
2. Type: "Web application"
3. Nom: "Fliptracker Backend"
4. **Authorized JavaScript origins:**
   - `http://localhost:3001` (développement local)
   - `https://fliptracker-backend.onrender.com` (production Render)
5. **Authorized redirect URIs:**
   - `http://localhost:3001/api/auth/callback/google` (local)
   - `https://fliptracker-backend.onrender.com/api/auth/callback/google` (production)
6. Créez

### F. Copier vos identifiants

Sur la page Credentials, vous verrez:
- **Client ID**: `123456789-abc123def456.apps.googleusercontent.com`
- **Client Secret**: `abcd1234...`

## 2. Configurer Render avec les identifiants

### Backend Web Service

**Render Dashboard → fliptracker-backend → Environment**

Ajoutez ou mettez à jour:

```bash
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=abcd1234...
GOOGLE_REDIRECT_URI=https://fliptracker-backend.onrender.com/api/auth/callback/google
```

⚠️ L'URI doit correspondre exactement à Google Cloud Console!

### Frontend Static Site

**Aucune configuration OAuth directe nécessaire**
- Le frontend redirige juste l'utilisateur vers `/api/auth/login/google` (backend)

## 3. Vérifier le flux dans le code

### Backend: `/api/auth/login/google`

Doit retourner l'URL d'authentification Google:

```typescript
@Get('login/google')
async loginGoogle() {
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?...`
  return { url: authUrl };
}
```

### Backend: `/api/auth/callback/google`

Doit gérer le callback:

```typescript
@Get('callback/google')
async googleCallback(
  @Query('code') code: string,
  @Query('error') error?: string,
) {
  // Échange le code contre un token
  // Crée/met à jour l'utilisateur
  // Retourne une redirection vers le frontend
}
```

### Frontend: `AuthPage.tsx`

Doit appeler le login:

```typescript
const signInWithGoogle = async () => {
  const response = await fetch('/api/auth/login/google');
  const data = await response.json();
  window.location.href = data.url; // Redirection vers Google
}
```

## 4. Tester localement

### Terminal 1: Backend

```bash
cd fliptracker/apps/backend
export GOOGLE_CLIENT_ID=your-id
export GOOGLE_CLIENT_SECRET=your-secret
export GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/callback/google
export FRONTEND_URL=http://localhost:5173
npm run start:dev
```

### Terminal 2: Frontend

```bash
cd fliptracker/apps/frontend
export VITE_API_URL=http://localhost:3001/api
npm run dev
```

### Dans le navigateur

1. Allez sur http://localhost:5173
2. Cliquez "Commencer maintenant"
3. Cliquez "Sign in with Google"
4. Vous êtes redirigé vers Google
5. Acceptez les permissions
6. Vous revenez à l'app et êtes connecté ✅

## 5. Dépannage OAuth

### ❌ Erreur: "redirect_uri_mismatch"

**Cause**: L'URL de callback ne correspond pas

**Solution**:
1. Vérifiez la barre d'adresse du navigateur (exact URL du callback)
2. Google Cloud Console → Credentials → Authorized redirect URIs
3. Ajoutez l'URL exacte
4. Attendez quelques minutes (cache)
5. Réessayez

### ❌ Erreur: "invalid_client"

**Cause**: Client ID ou Secret incorrect

**Solution**:
1. Vérifiez `GOOGLE_CLIENT_ID` dans Render
2. Vérifiez `GOOGLE_CLIENT_SECRET` dans Render
3. Les valeurs sont sensibles à la casse
4. Copier-collez directement depuis Google Cloud Console

### ❌ Erreur: "invalid_scope"

**Cause**: Les scopes demandés ne sont pas configurés

**Solution**:
1. Google Cloud Console → OAuth Consent Screen → Scopes
2. Assurez-vous que "email" et "profile" sont activés
3. Mettez à jour le backend (ne demandez que email + profile)

### ❌ Écran blanc après authentification

**Cause**: Généralement une erreur lors de la mise à jour de l'utilisateur Firebase

**Solution**:
1. Ouvrez DevTools (F12 → Console)
2. Cherchez les erreurs JavaScript
3. Vérifiez les logs Render du backend
4. Vérifiez que `FIREBASE_PRIVATE_KEY` est correct

### ❌ "400: redirect_uri_mismatch" lors du développement Codespaces

**Cause**: Codespaces forwarded URLs changent

**Solution**:
1. Acceptez que Codespaces nécessite l'authentification du tunnel
2. Testez plutôt sur Render (domaines stables)
3. Ou exposez OAuth dans Codespaces (complexe)

## 6. Sécurité OAuth

### ✅ Bonnes pratiques

- 🔐 Ne commitez jamais `GOOGLE_CLIENT_SECRET` dans git
- 🔒 Utilisez des variables d'environnement
- 🔄 Régénérez les secrets si compromis
- 📝 Validez les tokens dans le backend
- 🚫 Ne faites confiance qu'aux tokens signés par Google

### Rotation des secrets

Si votre secret est compromis:

1. Google Cloud Console → Credentials
2. Cliquez sur votre Client ID
3. Supprimez l'ancien secret
4. Créez un nouveau
5. Mettez à jour Render (`GOOGLE_CLIENT_SECRET`)
6. Redéploiement automatique

## 7. Scopes et permissions

### Email et profil minimum

```
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

### Si vous avez besoin de Google Drive, Calendar, etc.

Ajoutez les scopes correspondants:
1. Google Cloud Console → OAuth Consent Screen → Scopes
2. "Add or Remove Scopes"
3. Cherchez le service (ex: "Google Drive")
4. Sélectionnez les scopes
5. Mettez à jour le code backend

## Checklist de déploiement

- [ ] Client ID et Secret créés dans Google Cloud Console
- [ ] Authorized JavaScript origins incluent le domaine Render
- [ ] Authorized redirect URIs incluent `https://backend.onrender.com/api/auth/callback/google`
- [ ] Variables configurées dans Render backend
- [ ] Testé localement avec un compte Google de test
- [ ] Firebase Firestore configured pour stocker les utilisateurs
- [ ] Session cookie retournée au frontend

---

**Questions?** Consultez:
- [Google OAuth Docs](https://developers.google.com/identity/protocols/oauth2)
- [NestJS Auth Guide](https://docs.nestjs.com/techniques/authentication)
- [Firebase Documentation](https://firebase.google.com/docs)

