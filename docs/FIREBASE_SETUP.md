# 🔑 Configuration Firebase pour Render

## Comment obtenir vos clés Firebase

### 1. Ouvrir Firebase Console

Accédez à https://console.firebase.google.com

### 2. Sélectionner votre projet

Choisissez le projet Firebase associé à Fliptracker

### 3. Obtenir les clés publiques (pour le frontend)

**Chemin:** Project Settings → General → Your apps → Fliptracker (Web)

Vous trouverez un code de configuration qui ressemble à:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "fliptracker-xxxxx.firebaseapp.com",
  projectId: "fliptracker-xxxxx",
  storageBucket: "fliptracker-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

**Variables pour Render frontend:**
```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=fliptracker-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=fliptracker-xxxxx
```

### 4. Créer une clé de service (pour le backend)

**Chemin:** Project Settings → Service Accounts

1. Cliquez sur "Generate New Private Key"
2. Un fichier JSON se télécharge (ex: `fliptracker-xxxxx-xxxxx.json`)
3. Ouvrez ce fichier et copiez ces valeurs:

```json
{
  "type": "service_account",
  "project_id": "fliptracker-xxxxx",
  "private_key_id": "xxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-abc@fliptracker-xxxxx.iam.gserviceaccount.com",
  "client_id": "123456789",
  ...
}
```

**Variables pour Render backend:**
```bash
FIREBASE_PROJECT_ID=fliptracker-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc@fliptracker-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

### ⚠️ Important: Format de FIREBASE_PRIVATE_KEY

La clé privée doit être sur **une seule ligne** dans Render:
- ❌ Pas de vraies newlines/retours à la ligne
- ✅ Utilisez `\n` littéralement (juste les caractères backslash+n)

**Si vous avez python:**
```python
import json

with open('firebase-key.json') as f:
    data = json.load(f)
    
print(f"FIREBASE_PRIVATE_KEY={data['private_key']}")
```

### 5. Vérifier vos clés

**Backend (.env.render):**
```bash
FIREBASE_PROJECT_ID=fliptracker-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc@...iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n
```

**Frontend (.env.render):**
```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=fliptracker-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=fliptracker-xxxxx
```

### 6. Configurer les règles Firestore

**Chemin:** Firestore Database → Rules

Assurez-vous que vos règles permettent:
- ✅ Lecture/écriture pour les utilisateurs authentifiés
- ✅ Authentification via Google OAuth

**Exemple de règles minimales:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 🔐 Sécurité

- 🚫 Ne commitez jamais `firebase-key.json` dans git
- 🔒 Les variables d'environnement Render sont chiffrées
- 🛡️ Utilisez des règles Firestore restrictives en production
- 🔄 Régénérez les clés si compromises

### Dépannage

**Erreur: "Invalid service account"**
- Vérifiez que `FIREBASE_PRIVATE_KEY` commence par `-----BEGIN PRIVATE KEY-----`
- Vérifiez que les `\n` sont littérales (pas de vraies newlines)
- Vérifiez que `FIREBASE_PROJECT_ID` et `FIREBASE_CLIENT_EMAIL` correspondent

**Erreur: "Permission denied" lors de la lecture Firestore**
- Allez à Firestore → Rules
- Vérifiez les conditions `allow read, write`
- Testez localement avec l'émulateur Firebase

**Clé expirée après 1 an**
- Régénérez une nouvelle clé dans Service Accounts
- Mettez à jour les variables dans Render
- L'app redéploiera automatiquement

