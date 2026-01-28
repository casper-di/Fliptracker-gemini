#!/bin/bash

# 🛠️ Script d'aide pour extraire et configurer les variables Render
# Usage: chmod +x render-setup.sh && ./render-setup.sh

echo "==================================="
echo "  🚀 Render Deployment Helper"
echo "==================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Firebase Private Key
echo -e "${YELLOW}1️⃣  Firebase Private Key${NC}"
echo "Cherchez votre fichier serviceAccountKey.json"
echo ""

if [ -f "serviceAccountKey.json" ]; then
    echo -e "${GREEN}✓ Fichier trouvé!${NC}"
    PRIVATE_KEY=$(cat serviceAccountKey.json | jq -r '.private_key')
    echo ""
    echo "Copiez cette clé privée et collez-la dans Render:"
    echo "==========================================="
    echo "$PRIVATE_KEY"
    echo "==========================================="
else
    echo -e "${RED}✗ Fichier serviceAccountKey.json non trouvé${NC}"
    echo "  Téléchargez-le depuis Firebase Console → Paramètres → Comptes de service"
    echo ""
fi

echo ""
echo -e "${YELLOW}2️⃣  Google OAuth Credentials${NC}"
echo "Visitez: https://console.cloud.google.com"
echo "  → APIs & Services → Credentials"
echo ""
echo "Notez votre:"
echo "  • GOOGLE_CLIENT_ID: (starts with: ...apps.googleusercontent.com)"
echo "  • GOOGLE_CLIENT_SECRET: (starts with: GOCSPX-...)"
echo ""

echo -e "${YELLOW}3️⃣  Variables d'environnement pour Render${NC}"
echo ""
echo "Copiez ces variables dans votre dashboard Render:"
echo ""
echo "=== BACKEND (Web Service) ==="
cat << 'EOF'
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://fliptracker-frontend.onrender.com
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=https://fliptracker-backend.onrender.com/api/auth/callback/google
FIREBASE_PROJECT_ID=fliptracker-52632
FIREBASE_CLIENT_EMAIL=YOUR_CLIENT_EMAIL_HERE
FIREBASE_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
EOF

echo ""
echo "=== FRONTEND (Static Site) ==="
cat << 'EOF'
VITE_API_URL=https://fliptracker-backend.onrender.com/api
VITE_FIREBASE_API_KEY=AIzaSyCX1-uVQiSZBbiLDOPQjaNXX67RHgO_6mc
VITE_FIREBASE_AUTH_DOMAIN=fliptracker-52632.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=fliptracker-52632
VITE_FIREBASE_STORAGE_BUCKET=fliptracker-52632.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=675025970889
VITE_FIREBASE_APP_ID=1:675025970889:web:186ff8e7f1082cc05ecf18
VITE_FIREBASE_MEASUREMENT_ID=G-Q2QFQ0552W
EOF

echo ""
echo -e "${GREEN}✓ Guide terminé!${NC}"
echo ""
echo "Prochaines étapes:"
echo "  1. Créez un Web Service backend sur Render"
echo "  2. Créez un Static Site frontend sur Render"
echo "  3. Ajoutez les variables d'environnement"
echo "  4. Attendez le déploiement et testez!"
echo ""
