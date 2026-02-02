# 🌐 Exposer Ollama Local pour Backend Render

## 🎯 Objectif
Permettre au backend Render d'accéder à ton Ollama local via un tunnel HTTPS

---

## 📦 Méthode 1 : Tunnel ngrok (Temporaire, Tests)

### Étape 1 : Installer ngrok
```bash
# Ubuntu/Debian
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# macOS
brew install ngrok

# Ou télécharger : https://ngrok.com/download
```

### Étape 2 : Créer un compte ngrok
1. Aller sur https://dashboard.ngrok.com/signup
2. Copier ton authtoken
3. Authentifier :
```bash
ngrok config add-authtoken VOTRE_TOKEN
```

### Étape 3 : Exposer Ollama
```bash
# Terminal 1 : Démarrer Ollama
ollama serve

# Terminal 2 : Créer le tunnel
ngrok http 11434
```

**Résultat** :
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:11434
```

### Étape 4 : Configurer Render
Dans **Render Dashboard → Backend → Environment** :
```bash
NLP_ENABLED=true
OLLAMA_HOST=https://abc123.ngrok-free.app
```

### ⚠️ Limitations
- ❌ URL change à chaque redémarrage de ngrok
- ❌ Plan gratuit : 40 requêtes/minute max
- ❌ Latence accrue (~200ms)
- ❌ Pas de solution permanente

---

## 🏢 Méthode 2 : VPS avec Ollama (Production)

### Architecture
```
Backend Render → VPS Public (Ollama) → Réponse
                 (IP fixe / domaine)
```

### Étape 1 : Louer un VPS
**Recommandations** :
- **Hetzner CPX21** : 10€/mois, 3vCPU, 4GB RAM, EU (Allemagne)
- **Contabo VPS M** : 6€/mois, 4vCPU, 8GB RAM, EU
- **DigitalOcean Droplet** : 12$/mois, 2vCPU, 4GB RAM

### Étape 2 : Installer Ollama sur le VPS
```bash
# Se connecter au VPS
ssh root@votre-vps-ip

# Installer Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Configurer pour écouter sur toutes les interfaces
sudo systemctl edit ollama

# Ajouter ces lignes :
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"

# Redémarrer
sudo systemctl restart ollama

# Télécharger le modèle
ollama pull llama3.1:8b-instruct

# Vérifier
ollama list
```

### Étape 3 : Configurer le pare-feu
```bash
# Autoriser le port 11434
sudo ufw allow 11434/tcp
sudo ufw enable

# Tester depuis ton PC
curl http://VPS_IP:11434/api/tags
```

### Étape 4 : (Optionnel) Ajouter un domaine
```bash
# Dans ton registrar DNS (Cloudflare, OVH, etc.)
ollama.tondomaine.com  A  VPS_IP

# Installer nginx + SSL
sudo apt install nginx certbot python3-certbot-nginx

# Configurer le proxy
sudo nano /etc/nginx/sites-available/ollama

# Contenu :
server {
    server_name ollama.tondomaine.com;
    
    location / {
        proxy_pass http://localhost:11434;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Activer
sudo ln -s /etc/nginx/sites-available/ollama /etc/nginx/sites-enabled/
sudo certbot --nginx -d ollama.tondomaine.com
sudo systemctl restart nginx
```

### Étape 5 : Configurer Render
```bash
# Render Dashboard → Backend → Environment
NLP_ENABLED=true
OLLAMA_HOST=https://ollama.tondomaine.com
# Ou sans domaine :
OLLAMA_HOST=http://VPS_IP:11434
```

### ✅ Avantages
- ✅ URL fixe permanente
- ✅ Pas de limite de requêtes
- ✅ Latence faible (~50ms EU → EU)
- ✅ Solution RGPD conforme (serveur EU)

### 💰 Coûts
- VPS : 6-12€/mois
- Domaine (optionnel) : 10€/an

---

## 📊 Comparaison

| Méthode | Coût | Latence | Permanence | Sécurité |
|---------|------|---------|------------|----------|
| **ngrok** | Gratuit | ~200ms | ❌ URL change | ⚠️ Tunnel public |
| **VPS** | 10€/mois | ~50ms | ✅ IP fixe | ✅ Contrôle total |
| **Local** | 0€ | 0ms | ❌ PC allumé 24/7 | ❌ Pas d'accès distant |

---

## 🎯 Recommandation

**Pour développement/tests** :
```bash
# Tout en local (scénario 1)
Backend local + Ollama local + Frontend local
```

**Pour production** :
```bash
# Option 1 : Sans NLP (gratuit)
NLP_ENABLED=false

# Option 2 : VPS Ollama (10€/mois)
VPS Hetzner + domaine + SSL
```

**Pour test rapide Render** :
```bash
# ngrok temporaire (juste pour voir si ça marche)
ngrok http 11434
OLLAMA_HOST=https://abc123.ngrok-free.app
```
