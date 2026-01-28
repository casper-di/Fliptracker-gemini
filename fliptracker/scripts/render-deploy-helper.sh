#!/bin/bash

#
# 📦 render-deploy-helper.sh
# Script d'aide pour vérifier avant le déploiement sur Render
#
# Usage:
#   bash fliptracker/scripts/render-deploy-helper.sh
#

set -e

COLORS='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════╗"
echo "║  🚀 Fliptracker Render Deployment Helper       ║"
echo "║  Version: 1.0 | Status: Production Ready ✅    ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${COLORS}"

cd "$(dirname "$0")/../.." || exit 1

# Check if we're in the right directory
if [ ! -f "fliptracker/pnpm-workspace.yaml" ]; then
    echo -e "${RED}❌ Vous devez exécuter ce script depuis la racine du repo${COLORS}"
    exit 1
fi

echo ""
echo -e "${BLUE}📋 Phase 1: Vérification de l'environnement${COLORS}"
echo "──────────────────────────────────────────"

# Check Node
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js non trouvé${COLORS}"
    exit 1
fi
echo -e "${GREEN}✅ Node $(node -v)${COLORS}"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm non trouvé${COLORS}"
    echo "   Installez: npm install -g pnpm"
    exit 1
fi
echo -e "${GREEN}✅ pnpm $(pnpm -v)${COLORS}"

# Check Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git non trouvé${COLORS}"
    exit 1
fi
echo -e "${GREEN}✅ Git installed${COLORS}"

echo ""
echo -e "${BLUE}📦 Phase 2: Vérification de la structure${COLORS}"
echo "──────────────────────────────────────────"

# Check key files
required_files=(
    "fliptracker/package.json"
    "fliptracker/pnpm-lock.yaml"
    "fliptracker/pnpm-workspace.yaml"
    "fliptracker/apps/backend/package.json"
    "fliptracker/apps/frontend/package.json"
    "fliptracker/apps/backend/src/main.ts"
    "fliptracker/apps/frontend/index.tsx"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${COLORS}"
    else
        echo -e "${RED}❌ $file MANQUANT${COLORS}"
        exit 1
    fi
done

echo ""
echo -e "${BLUE}🔐 Phase 3: Vérification des fichiers de configuration${COLORS}"
echo "──────────────────────────────────────────"

env_files=(
    "fliptracker/apps/backend/.env.render"
    "fliptracker/apps/frontend/.env.render"
)

for file in "${env_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file existe${COLORS}"
        
        # Check if it's empty
        if [ ! -s "$file" ]; then
            echo -e "${YELLOW}⚠️  $file est vide${COLORS}"
        else
            # Check for YOUR_ placeholders
            if grep -q "YOUR_" "$file"; then
                echo -e "${YELLOW}⚠️  $file contient des placeholders (YOUR_...)${COLORS}"
            else
                echo -e "${GREEN}   Contient des valeurs de configuration${COLORS}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  $file non trouvé (sera créé lors du déploiement)${COLORS}"
    fi
done

echo ""
echo -e "${BLUE}🔨 Phase 4: Test de compilation${COLORS}"
echo "──────────────────────────────────────────"

cd fliptracker

# Install dependencies
echo "📥 Installation des dépendances..."
if pnpm install > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dépendances installées${COLORS}"
else
    echo -e "${RED}❌ Erreur lors de l'installation${COLORS}"
    exit 1
fi

# Build backend
echo "🔨 Compilation du backend..."
if pnpm -F backend build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend compilé${COLORS}"
    BACKEND_SIZE=$(du -sh apps/backend/dist 2>/dev/null | cut -f1)
    echo -e "   Taille: ${BLUE}$BACKEND_SIZE${COLORS}"
else
    echo -e "${RED}❌ Erreur de compilation du backend${COLORS}"
    pnpm -F backend build
    exit 1
fi

# Build frontend
echo "🔨 Compilation du frontend..."
if pnpm -F frontend build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend compilé${COLORS}"
    FRONTEND_SIZE=$(du -sh apps/frontend/dist 2>/dev/null | cut -f1)
    echo -e "   Taille: ${BLUE}$FRONTEND_SIZE${COLORS}"
else
    echo -e "${RED}❌ Erreur de compilation du frontend${COLORS}"
    pnpm -F frontend build
    exit 1
fi

cd ../..

echo ""
echo -e "${BLUE}✅ Phase 5: Résumé de l'état${COLORS}"
echo "──────────────────────────────────────────"

git_status=$(git status --porcelain | wc -l)
if [ "$git_status" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Fichiers non commités: $git_status${COLORS}"
    echo "   Exécutez: git add -A && git commit -m 'chore: render deployment'"
else
    echo -e "${GREEN}✅ Tous les changements sont commités${COLORS}"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${COLORS}"
echo -e "${BLUE}║  🎉 Prêt pour le déploiement Render!         ║${COLORS}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${COLORS}"

echo ""
echo -e "${YELLOW}Prochaines étapes:${COLORS}"
echo "  1️⃣  git push origin main"
echo "  2️⃣  Ouvrez: https://dashboard.render.com"
echo "  3️⃣  Créez Web Service (backend) + Static Site (frontend)"
echo "  4️⃣  Configurez les variables d'environnement"
echo "  5️⃣  Consultez: RENDER_DEPLOYMENT_GUIDE.md pour les détails"
echo ""
echo -e "${YELLOW}Documentation:${COLORS}"
echo "  📖 QUICKSTART.md                  - Guide rapide (5 min)"
echo "  📖 RENDER_DEPLOYMENT_GUIDE.md     - Guide complet (30 min)"
echo "  📖 docs/FIREBASE_SETUP.md         - Configuration Firebase"
echo "  📖 docs/GOOGLE_OAUTH_SETUP.md     - Configuration OAuth"
echo ""
echo -e "${BLUE}Bonne chance! 🚀${COLORS}"
echo ""
