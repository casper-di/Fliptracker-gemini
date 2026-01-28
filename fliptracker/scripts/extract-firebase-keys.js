#!/usr/bin/env node

/**
 * 📋 Extract Firebase keys and format for Render.com
 * Usage: node scripts/extract-firebase-keys.js
 */

const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../../../fliptracker/firebase-service-account.json');

console.log('\n📋 Extracteur de clés Firebase pour Render\n');

if (!fs.existsSync(serviceAccountPath)) {
  console.log('⚠️  Service account JSON non trouvé à:');
  console.log(`   ${serviceAccountPath}\n`);
  console.log('📝 Créez d\'abord un fichier service-account.json:');
  console.log('   1. Allez à Firebase Console');
  console.log('   2. Settings → Service Accounts');
  console.log('   3. Générez une nouvelle clé privée');
  console.log('   4. Sauvegardez en tant que "firebase-service-account.json"\n');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  
  console.log('✅ Service account trouvé!\n');
  console.log('Variables pour Render backend:\n');
  
  const vars = {
    'FIREBASE_PROJECT_ID': serviceAccount.project_id,
    'FIREBASE_CLIENT_EMAIL': serviceAccount.client_email,
    'FIREBASE_PRIVATE_KEY': serviceAccount.private_key,
  };
  
  Object.entries(vars).forEach(([key, value]) => {
    console.log(`${key}=${value}`);
  });
  
  // Format for pasting
  console.log('\n' + '='.repeat(50));
  console.log('Format pour Render Environment Variables:\n');
  
  Object.entries(vars).forEach(([key, value]) => {
    if (key === 'FIREBASE_PRIVATE_KEY') {
      // Afficher juste la structure, pas la clé réelle
      console.log(`${key}=-----BEGIN PRIVATE KEY-----\n...contenu...\n-----END PRIVATE KEY-----`);
    } else {
      console.log(`${key}=${value}`);
    }
  });
  
  console.log('\n💡 Notes importantes:');
  console.log('  • La clé privée doit être sur une seule ligne dans Render');
  console.log('  • Les retours à la ligne se matérialisent par \\\\n');
  console.log('  • Utilisez la option "multiline" si disponible dans le dashboard Render\n');
  
} catch (error) {
  console.log('❌ Erreur lors de la lecture du service account:');
  console.log(error.message);
  process.exit(1);
}
