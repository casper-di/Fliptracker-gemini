# 🚨 Solution NLP pour Render.com

## ❌ Problème

**Ollama ne peut PAS être déployé sur Render** car :
- Render n'offre pas d'instances GPU
- Ollama nécessite ~4.7GB pour le modèle + 2GB RAM en exécution
- Render ne permet pas l'installation de binaires système (Ollama CLI)
- Les Web Services Render sont éphémères (pas de persistence)

## ✅ Solution Immédiate : Désactiver NLP en Production

### Étape 1 : Ajouter la variable d'environnement sur Render

Dans le dashboard Render (Web Service Backend) :

```bash
NLP_ENABLED=false
```

### Étape 2 : Le système fonctionnera avec les parsers déterministes

Les parsers actuels supportent déjà :
- ✅ Vinted Go (SALE + PURCHASE)
- ✅ Mondial Relay
- ✅ Chronopost
- ✅ Colissimo
- ✅ DHL
- ✅ UPS
- ✅ FedEx

### Étape 3 : NLP reste disponible en développement local

Pour le développement local (avec Ollama installé) :
```bash
# .env local
NLP_ENABLED=true
OLLAMA_HOST=http://localhost:11434
```

---

## 🔀 Alternatives pour NLP en Production

### Option A : API OpenAI (Simple, Rapide)

**Avantages** :
- ✅ Déploiement immédiat sur Render
- ✅ Scalable automatiquement
- ✅ Pas de serveur à gérer

**Inconvénients** :
- ❌ Coûts récurrents (~0.002$ / email)
- ❌ Données envoyées à OpenAI (RGPD à considérer)

**Configuration** :
```bash
# Render Environment Variables
NLP_ENABLED=true
NLP_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxx
```

**Code** (à modifier dans `nlp.service.ts`) :
```typescript
// Remplacer Ollama par OpenAI SDK
import OpenAI from 'openai';

async refinWithLLM(data: any): Promise<any> {
  if (process.env.NLP_PROVIDER === 'openai') {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Moins cher que GPT-4
      messages: [{ role: 'user', content: this.buildLLMPrompt(data) }],
    });
    return JSON.parse(response.choices[0].message.content);
  }
  // Fallback to Ollama for local dev
  return this.ollama.chat(...);
}
```

**Coûts estimés** :
- 1000 emails/mois : ~2€
- 10000 emails/mois : ~20€

---

### Option B : Serveur VPS séparé pour Ollama

**Architecture** :
```
Render Backend → HTTPS → VPS (Ollama) → Réponse
```

**Configuration VPS** (Hetzner CPX21 - 10€/mois) :
```bash
# Sur le VPS
curl -fsSL https://ollama.com/install.sh | sh
ollama serve --host 0.0.0.0:11434
ollama pull llama3.1:8b-instruct

# Configurer firewall
ufw allow 11434/tcp
ufw enable
```

**Configuration Render** :
```bash
# Render Environment Variables
NLP_ENABLED=true
OLLAMA_HOST=https://votre-vps.com:11434
```

**Coûts** : ~10€/mois VPS

---

### Option C : Hugging Face Inference API

**Avantages** :
- ✅ Modèles open-source (Llama, Mistral)
- ✅ Pay-per-use (pas de serveur fixe)
- ✅ Déploiement immédiat

**Inconvénients** :
- ⚠️ Cold start (~5-10 secondes première requête)
- ⚠️ Latence réseau

**Configuration** :
```bash
NLP_ENABLED=true
NLP_PROVIDER=huggingface
HF_API_TOKEN=hf_xxxxx
HF_MODEL=meta-llama/Llama-3.1-8B-Instruct
```

**Coûts** : ~0.001$ / requête (moins cher qu'OpenAI)

---

## 📊 Comparaison

| Solution | Coût/mois | Latence | Setup | RGPD |
|----------|-----------|---------|-------|------|
| **Désactivé** | 0€ | Instantané | ✅ Aucun | ✅ 100% |
| **OpenAI** | 2-20€ | 200ms | ✅ Simple | ⚠️ USA |
| **VPS Ollama** | 10€ | 300ms | ⚠️ Moyen | ✅ EU |
| **HuggingFace** | 1-10€ | 500ms | ✅ Simple | ✅ EU |

---

## 🎯 Recommandation

**Pour déployer MAINTENANT** :
1. Désactiver NLP (`NLP_ENABLED=false`)
2. Les 7 parsers déterministes sont suffisants pour Vinted/Colissimo/etc.
3. Ajouter OpenAI plus tard si besoin (2 lignes de code)

**Pour une solution RGPD complète** :
- Déployer un VPS avec Ollama (guide complet disponible)
- Budget : 10€/mois

**Pour tester rapidement l'IA** :
- Utiliser OpenAI GPT-4o-mini (0.002$/email)
- Évaluer les coûts réels avant de décider
