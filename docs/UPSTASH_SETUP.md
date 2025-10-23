# 🚀 Configuration Upstash Redis (Rate Limiting)

Ce guide vous explique comment configurer Upstash Redis pour activer le rate limiting sur sosdivorce.fr.

---

## ✅ **Pourquoi Upstash ?**

Le rate limiting protège votre site contre :
- 🛡️ **Spam** - Limite les inscriptions frauduleuses
- 💸 **Abus d'API OpenAI** - Économise vos crédits
- 🔒 **Attaques brute force** - Protection login admin
- ⚡ **Surcharge serveur** - Limite les requêtes par IP

**Coût : GRATUIT** jusqu'à 10,000 commandes/jour (largement suffisant)

---

## 📋 **Étape 1 : Créer un compte Upstash (5 min)**

### 1. Aller sur Upstash
👉 [https://console.upstash.com/](https://console.upstash.com/)

### 2. S'inscrire gratuitement
- Cliquez sur **"Sign Up"**
- Utilisez GitHub, Google, ou email
- Pas besoin de carte bancaire !

### 3. Vérifier votre email
- Consultez votre boîte mail
- Cliquez sur le lien de confirmation

---

## 🗄️ **Étape 2 : Créer une base de données Redis (2 min)**

### 1. Créer une database
- Dans le dashboard Upstash, cliquez sur **"Create Database"**

### 2. Configurer la database
```
Name:               sosdivorce-ratelimit
Type:               Regional (gratuit)
Region:             eu-west-1 (Europe - Paris) ← Recommandé pour la France
Primary Region:     eu-west-1
Eviction:           No Eviction (recommandé)
TLS:                Enabled (recommandé)
```

### 3. Cliquer sur "Create"
- La database sera prête en quelques secondes

---

## 🔑 **Étape 3 : Récupérer les credentials (1 min)**

### 1. Aller dans l'onglet "Details"
Vous verrez deux informations importantes :

### 2. Copier les credentials

```bash
# REST API
UPSTASH_REDIS_REST_URL=https://eu1-charming-mole-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AY8xAbCdEfGhIjKlMnOpQrStUvWxYz123456789==
```

**⚠️ IMPORTANT : Utilisez le REST API, pas le standard Redis endpoint**

---

## ⚙️ **Étape 4 : Configuration sur Vercel**

### Option A : Via le Dashboard Vercel (Recommandé)

1. **Aller dans Settings**
   - Ouvrez votre projet sosdivorce sur Vercel
   - Cliquez sur **"Settings"** → **"Environment Variables"**

2. **Ajouter les variables**

   **Variable 1 :**
   ```
   Name:  UPSTASH_REDIS_REST_URL
   Value: https://eu1-charming-mole-12345.upstash.io
   Environment: Production, Preview, Development
   ```

   **Variable 2 :**
   ```
   Name:  UPSTASH_REDIS_REST_TOKEN
   Value: AY8xAbCdEfGhIjKlMnOpQrStUvWxYz123456789==
   Environment: Production, Preview, Development
   ```

3. **Sauvegarder**
   - Cliquez sur **"Save"** pour chaque variable

4. **Redéployer**
   - Allez dans **"Deployments"**
   - Cliquez sur les 3 points du dernier déploiement
   - Cliquez sur **"Redeploy"**
   - ✅ Le rate limiting est maintenant actif !

### Option B : Via CLI Vercel

```bash
# Configurer les variables
vercel env add UPSTASH_REDIS_REST_URL production
# Collez votre URL quand demandé

vercel env add UPSTASH_REDIS_REST_TOKEN production
# Collez votre TOKEN quand demandé

# Redéployer
vercel --prod
```

---

## 🧪 **Étape 5 : Tester le rate limiting**

### Test 1 : Vérifier que ça fonctionne

```bash
# Faire 11 requêtes au chatbot (limite = 10/heure)
for i in {1..11}; do
  curl -X POST https://sosdivorce.fr/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "test"}' \
    && echo " - Request $i"
done

# La 11ème devrait retourner 429 Too Many Requests
```

### Test 2 : Vérifier les headers

```bash
curl -I -X POST https://sosdivorce.fr/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Vous devriez voir :
# X-RateLimit-Limit: 10
# X-RateLimit-Remaining: 9
# X-RateLimit-Reset: 1234567890
```

### Test 3 : Dashboard Upstash

1. Aller dans Upstash Console
2. Cliquer sur votre database
3. Aller dans **"Data Browser"**
4. Vous devriez voir des clés comme : `ratelimit:chat:xxx.xxx.xxx.xxx`

---

## 📊 **Limites configurées**

| Endpoint | Limite | Fenêtre | Utilisateur |
|----------|--------|---------|-------------|
| **Chat API** | 10 req | 1 heure | Non inscrit (par IP) |
| **Chat API** | 50 req | 1 heure | Inscrit (par email) |
| **Inscription** | 3 req | 1 heure | Par IP |
| **Login** | 5 tentatives | 15 min | Par IP (anti brute force) |
| **Admin List/Stats** | 30 req | 1 heure | Par IP |

---

## 🔧 **Modifier les limites (optionnel)**

Pour changer les limites, éditez [lib/ratelimit.js](lib/ratelimit.js) :

```javascript
// Exemple : Passer de 10 à 20 req/heure pour le chat
export const chatRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'), // ← Changez ici
  analytics: true,
  prefix: 'ratelimit:chat',
});
```

Algorithmes disponibles :
- `slidingWindow(10, '1 h')` - Fenêtre glissante (recommandé)
- `fixedWindow(10, '1 h')` - Fenêtre fixe
- `tokenBucket(10, '1 h', 1)` - Token bucket (avancé)

---

## ⚠️ **Mode développement (sans Upstash)**

Si Upstash n'est pas configuré :
- ⚠️ Le rate limiting est **désactivé**
- ⚠️ Un warning s'affiche dans les logs
- ✅ Le site fonctionne normalement
- ❌ Pas de protection contre les abus

**Logs :**
```
⚠️ Rate limiting désactivé - Upstash non configuré
```

---

## 🐛 **Dépannage**

### Problème : "Rate limiting désactivé"

**Cause :** Variables Upstash manquantes

**Solution :**
1. Vérifiez que `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` sont définis
2. Sur Vercel, vérifiez **Settings → Environment Variables**
3. Redéployez après avoir ajouté les variables

### Problème : "Error connecting to Upstash"

**Cause :** Token invalide ou URL incorrecte

**Solution :**
1. Revérifiez vos credentials dans Upstash
2. Assurez-vous d'utiliser **REST API** (pas Redis CLI)
3. Le token ne doit pas contenir d'espaces

### Problème : "Too many requests" même pour la 1ère requête

**Cause :** IP partagée ou erreur de config

**Solution :**
1. Videz le cache Redis depuis Upstash Dashboard
2. Vérifiez les préfixes dans [lib/ratelimit.js](lib/ratelimit.js)

---

## 💰 **Coûts & Quotas**

### Plan Gratuit (Free)
- ✅ 10,000 commandes/jour
- ✅ 256 MB de stockage
- ✅ TLS/SSL inclus
- ✅ Multi-région
- ✅ Pas de carte requise

### Dépassement du quota
- 💰 **$0.20 / 100k commandes** au-delà
- 💰 **$0.25 / GB** de stockage au-delà

### Estimation pour sosdivorce.fr
Avec **100 visiteurs/jour** × **3 questions** = **300 requêtes/jour**

- Gratuit : ✅ Largement dans le quota
- Coût mensuel estimé : **$0** (gratuit)

Avec **1000 visiteurs/jour** × **5 questions** = **5,000 req/jour**

- Gratuit : ✅ Dans le quota
- Coût mensuel estimé : **$0** (gratuit)

---

## 📚 **Ressources**

- 📖 [Documentation Upstash](https://docs.upstash.com/redis)
- 📖 [Rate Limiting Guide](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- 💬 [Support Upstash](https://discord.gg/upstash)
- 🎥 [Tutoriel vidéo](https://www.youtube.com/watch?v=EfaFVfW0OEo)

---

## ✅ **Checklist de configuration**

- [ ] Compte Upstash créé
- [ ] Database Redis créée (eu-west-1)
- [ ] `UPSTASH_REDIS_REST_URL` récupérée
- [ ] `UPSTASH_REDIS_REST_TOKEN` récupéré
- [ ] Variables ajoutées sur Vercel
- [ ] Site redéployé
- [ ] Test : 11 requêtes → 11ème bloquée (429)
- [ ] Vérification : Headers `X-RateLimit-*` présents
- [ ] Logs : Pas de warning "Rate limiting désactivé"

---

🎉 **Félicitations !** Votre site est maintenant protégé contre les abus !

Si vous avez des questions, consultez la documentation ou créez une issue sur GitHub.
