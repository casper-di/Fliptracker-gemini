#!/bin/bash

# 🔧 Setup script pour vérifier votre environnement avant Render
# Usage: bash fliptracker/scripts/pre-render-check.sh

set -e

echo "🔍 Vérification de l'environnement de déploiement Render.com"
echo "============================================================"

# Vérifier Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js non trouvé. Installez Node.js 18+"
    exit 1
fi

# Vérifier pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    echo "✅ pnpm: $PNPM_VERSION"
else
    echo "❌ pnpm non trouvé. Installez pnpm"
    exit 1
fi

# Vérifier que nous sommes au bon endroit
if [ ! -f "fliptracker/pnpm-workspace.yaml" ]; then
    echo "❌ Vous devez exécuter ce script depuis la racine du repo"
    exit 1
fi

echo "✅ Vous êtes dans le bon répertoire"

# Vérifier les fichiers clés
echo ""
echo "📦 Vérification de la structure..."

required_files=(
    "fliptracker/apps/backend/package.json"
    "fliptracker/apps/frontend/package.json"
    "fliptracker/pnpm-lock.yaml"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file manquant"
        exit 1
    fi
done

# Vérifier que les .env.render existent
echo ""
echo "🔐 Vérification des fichiers .env.render..."

env_files=(
    "fliptracker/apps/backend/.env.render"
    "fliptracker/apps/frontend/.env.render"
)

for file in "${env_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "⚠️  $file non trouvé (créé pendant le déploiement)"
    fi
done

# Tester la compilation
echo ""
echo "🔨 Test de compilation..."

cd fliptracker

# Install dependencies
echo "  → pnpm install..."
pnpm install > /dev/null 2>&1 && echo "✅ Dépendances installées" || echo "❌ Erreur lors de l'installation"

# Build backend
echo "  → pnpm build (backend)..."
pnpm -F backend build > /dev/null 2>&1 && echo "✅ Backend compilé" || {
    echo "❌ Erreur lors de la compilation du backend"
    cd ../..
    exit 1
}

# Build frontend
echo "  → pnpm build (frontend)..."
pnpm -F frontend build > /dev/null 2>&1 && echo "✅ Frontend compilé" || {
    echo "❌ Erreur lors de la compilation du frontend"
    cd ../..
    exit 1
}

# Vérifier les outputs
echo ""
echo "📦 Vérification des outputs de build..."

if [ -d "apps/backend/dist" ]; then
    BACKEND_SIZE=$(du -sh apps/backend/dist | cut -f1)
    echo "✅ Backend dist/ ($BACKEND_SIZE)"
else
    echo "❌ Backend dist/ non trouvé"
    cd ..
    exit 1
fi

if [ -d "apps/frontend/dist" ]; then
    FRONTEND_SIZE=$(du -sh apps/frontend/dist | cut -f1)
    echo "✅ Frontend dist/ ($FRONTEND_SIZE)"
else
    echo "❌ Frontend dist/ non trouvé"
    cd ..
    exit 1
fi

cd ../..

# Résumé final
echo ""
echo "============================================================"
echo "✅ Tous les contrôles sont passés!"
echo ""
echo "Prochaines étapes:"
echo "  1. Complétez les fichiers .env.render avec vos valeurs"
echo "  2. Committez les changements: git add -A && git commit -m 'chore: render setup'"
echo "  3. Poushez: git push origin main"
echo "  4. Créez les services sur Render.com"
echo "  5. Suivez le guide: RENDER_DEPLOYMENT_GUIDE.md"
echo ""
