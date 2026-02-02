#!/usr/bin/env node

/**
 * Setup script for NLP dependencies
 * Installs required models and libraries for local NLP processing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up NLP environment for FlipTracker...\n');

// Check if Ollama is installed
console.log('📦 Step 1: Checking Ollama installation...');
try {
  execSync('ollama --version', { stdio: 'pipe' });
  console.log('✅ Ollama is installed\n');
} catch (error) {
  console.log('❌ Ollama not found. Please install it first:');
  console.log('   Linux: curl -fsSL https://ollama.com/install.sh | sh');
  console.log('   macOS: brew install ollama');
  console.log('   Windows: Download from https://ollama.com/download\n');
  process.exit(1);
}

// Pull LLM model
console.log('📥 Step 2: Pulling LLM model (this may take a few minutes)...');
try {
  console.log('   Checking for llama3.1:8b-instruct...');
  execSync('ollama list | grep llama3.1:8b-instruct', { stdio: 'pipe' });
  console.log('✅ Model already available\n');
} catch (error) {
  console.log('   Pulling llama3.1:8b-instruct (~4.7GB)...');
  try {
    execSync('ollama pull llama3.1:8b-instruct', { stdio: 'inherit' });
    console.log('✅ Model downloaded successfully\n');
  } catch (pullError) {
    console.log('⚠️  Failed to pull model. Will attempt at runtime.\n');
  }
}

// Install node-postal (if not already installed)
console.log('📦 Step 3: Checking libpostal installation...');
try {
  require.resolve('node-postal');
  console.log('✅ node-postal is installed\n');
} catch (error) {
  console.log('⚠️  node-postal not found.');
  console.log('   Install libpostal system dependency:');
  console.log('   Ubuntu/Debian: sudo apt-get install libpostal-dev');
  console.log('   macOS: brew install libpostal');
  console.log('   Then run: npm install node-postal\n');
}

console.log('✨ NLP setup complete!');
console.log('\nℹ️  Make sure Ollama is running: ollama serve');
console.log('   Then start the backend: npm run start:dev\n');
