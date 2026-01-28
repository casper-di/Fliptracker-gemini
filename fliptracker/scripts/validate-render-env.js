#!/usr/bin/env node

/**
 * 🔍 Validation script pour vérifier les variables d'environnement
 * avant le déploiement sur Render
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ENV_VARS = [
  'NODE_ENV',
  'PORT',
  'FRONTEND_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

const FRONTEND_ENV_VARS = [
  'VITE_API_URL',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
];

console.log('\n🔍 Validation des variables d\'environnement Render\n');

// Vérifier .env files
const backendEnvPath = path.join(__dirname, 'apps/backend/.env.render');
const frontendEnvPath = path.join(__dirname, 'apps/frontend/.env.render');

let hasErrors = false;

// Vérifier backend
console.log('📦 Backend (.env.render):');
if (fs.existsSync(backendEnvPath)) {
  const content = fs.readFileSync(backendEnvPath, 'utf-8');
  BACKEND_ENV_VARS.forEach((varName) => {
    if (content.includes(varName)) {
      console.log(`  ✓ ${varName}`);
    } else {
      console.log(`  ✗ ${varName} (MANQUANT)`);
      hasErrors = true;
    }
  });
} else {
  console.log(`  ✗ Fichier .env.render non trouvé`);
  hasErrors = true;
}

// Vérifier frontend
console.log('\n🎨 Frontend (.env.render):');
if (fs.existsSync(frontendEnvPath)) {
  const content = fs.readFileSync(frontendEnvPath, 'utf-8');
  FRONTEND_ENV_VARS.forEach((varName) => {
    if (content.includes(varName)) {
      console.log(`  ✓ ${varName}`);
    } else {
      console.log(`  ✗ ${varName} (MANQUANT)`);
      hasErrors = true;
    }
  });
} else {
  console.log(`  ✗ Fichier .env.render non trouvé`);
  hasErrors = true;
}

// Vérifier build files
console.log('\n🔨 Configuration de build:');

const backendPackageJson = path.join(__dirname, 'apps/backend/package.json');
if (fs.existsSync(backendPackageJson)) {
  const pkg = JSON.parse(fs.readFileSync(backendPackageJson, 'utf-8'));
  if (pkg.scripts.build && pkg.scripts['start:prod']) {
    console.log(`  ✓ Backend scripts présents`);
  } else {
    console.log(`  ✗ Backend scripts manquants`);
    hasErrors = true;
  }
}

const frontendPackageJson = path.join(__dirname, 'apps/frontend/package.json');
if (fs.existsSync(frontendPackageJson)) {
  const pkg = JSON.parse(fs.readFileSync(frontendPackageJson, 'utf-8'));
  if (pkg.scripts.build) {
    console.log(`  ✓ Frontend build script présent`);
  } else {
    console.log(`  ✗ Frontend build script manquant`);
    hasErrors = true;
  }
}

// Résumé
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Des variables manquent. Complétez les .env.render files');
  process.exit(1);
} else {
  console.log('✅ Toutes les variables sont configurées!');
  console.log('\nProchaines étapes:');
  console.log('1. Remplacez les valeurs YOUR_... dans les .env.render');
  console.log('2. Créez les services sur Render.com');
  console.log('3. Copiez les variables dans le dashboard Render');
  console.log('4. Déployez!\n');
  process.exit(0);
}
