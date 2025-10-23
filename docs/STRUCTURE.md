# 📁 Structure du Projet - sosdivorce.fr

## Vue d'Ensemble Complète

```
sosdivorce-site/
│
├── 📄 Frontend (HTML/CSS/JS)
│   ├── index.html                  ⭐ Page principale du site
│   ├── admin.html                  👤 Dashboard administrateur
│   └── logo-sosdivorce.png         🎨 Logo du site
│
├── 🔧 Backend API (Vercel Functions)
│   └── api/
│       ├── chat.js                 💬 Chatbot OpenAI GPT-3.5-turbo
│       ├── signup.js               ✅ Inscription/connexion (MIGRÉ)
│       ├── setup-db.js             🆕 Initialisation base de données
│       ├── test-db.js              🆕 Test de connexion DB
│       ├── auth.js                 🔐 Utilitaires d'authentification
│       ├── users.js                👥 Gestion des utilisateurs
│       ├── googlesheets.js         📊 Intégration Google Sheets
│       ├── airtable.js             📋 Intégration Airtable
│       └── health.js               ❤️ Health check API
│
├── 💾 Base de Données
│   └── lib/
│       ├── db.js                   ✅ NOUVEAU - PostgreSQL (Vercel)
│       └── database.js.backup      📦 Ancien système (sauvegarde)
│
├── 📚 Documentation
│   └── docs/
│       ├── README.md               📖 Index de la documentation
│       ├── QUICK_START.md          🚀 Guide rapide (5 étapes)
│       ├── SETUP_POSTGRES.md       📘 Configuration complète
│       ├── MIGRATION_SUMMARY.md    📋 Résumé technique
│       ├── DEPLOYMENT_CHECKLIST.md ✅ Checklist déploiement
│       └── STRUCTURE.md            📁 Ce fichier
│
├── ⚙️ Configuration
│   ├── package.json                📦 Dépendances Node.js
│   ├── vercel.json                 🔧 Config Vercel
│   ├── .gitignore                  🚫 Fichiers ignorés par Git
│   └── README.md                   📄 Documentation principale
│
└── 🔒 Public & Assets
    └── public/
        ├── admin.html              👤 Page admin publique
        ├── logo-sosdivorce.png     🎨 Logo
        └── redeploy.html           🔄 Trigger de redéploiement
```

---

## 📂 Détails des Dossiers

### 🔧 `/api` - Backend Serverless

Toutes les fonctions serverless Vercel. Chaque fichier `.js` devient un endpoint `/api/nom-fichier`.

| Fichier | Endpoint | Méthode | Usage |
|---------|----------|---------|-------|
| `chat.js` | `/api/chat` | POST | Envoi de questions au chatbot IA |
| `signup.js` | `/api/signup` | POST/GET | Inscription, login, stats utilisateurs |
| `setup-db.js` | `/api/setup-db` | GET | Initialisation table users (1x) |
| `test-db.js` | `/api/test-db` | GET | Test de connexion PostgreSQL |
| `auth.js` | `/api/auth` | - | Utilitaires (non utilisé directement) |
| `users.js` | `/api/users` | POST | Gestion utilisateurs |
| `googlesheets.js` | `/api/googlesheets` | POST | Sync Google Sheets |
| `airtable.js` | `/api/airtable` | POST | Sync Airtable |
| `health.js` | `/api/health` | GET | Vérification santé API |

**Nouveaux fichiers (Migration Postgres) :**
- ✅ `setup-db.js` - Créer la table users
- ✅ `test-db.js` - Diagnostics de connexion

**Fichiers mis à jour :**
- ✅ `signup.js` - Migration vers PostgreSQL

---

### 💾 `/lib` - Bibliothèques Partagées

Code réutilisable partagé entre les fonctions API.

| Fichier | Usage | Statut |
|---------|-------|--------|
| `db.js` | **NOUVEAU** - Fonctions PostgreSQL | ✅ Actif |
| `database.js.backup` | Ancien système en mémoire | 📦 Sauvegarde |

**Fonctions disponibles dans `db.js` :**
```javascript
// Table
createUsersTable()

// CRUD Utilisateurs
addUser({ firstName, lastName, email, password })
findUserByEmail(email)
verifyUserPassword(email, password)
getAllUsers(limit, offset)
getUserCount()

// Statistiques
getStats()

// Mise à jour
updateSubscriptionStatus(email, status)
incrementQuestionCount(email)
resetQuestionCount(email)
```

---

### 📚 `/docs` - Documentation

Toute la documentation de la migration vers PostgreSQL.

| Fichier | Type | Durée | Public |
|---------|------|-------|--------|
| `README.md` | Index | 5 min | Tous |
| `QUICK_START.md` | Guide rapide | 7 min | Débutants |
| `SETUP_POSTGRES.md` | Guide complet | 20 min | Utilisateurs |
| `MIGRATION_SUMMARY.md` | Technique | 15 min | Développeurs |
| `DEPLOYMENT_CHECKLIST.md` | Checklist | 30 min | Équipe |
| `STRUCTURE.md` | Architecture | 10 min | Équipe |

**Guide de lecture :**
1. Démarrage rapide → `QUICK_START.md`
2. Configuration complète → `SETUP_POSTGRES.md`
3. Détails techniques → `MIGRATION_SUMMARY.md`
4. Déploiement méthodique → `DEPLOYMENT_CHECKLIST.md`

---

### 🔒 `/public` - Assets Publics

Fichiers statiques accessibles publiquement.

---

## 🗄️ Base de Données PostgreSQL

### Table `users`

```sql
CREATE TABLE users (
  id                  SERIAL PRIMARY KEY,
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  email               VARCHAR(255) UNIQUE NOT NULL,
  password_hash       VARCHAR(255),
  registered_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subscription_status VARCHAR(50) DEFAULT 'free',
  questions_used      INTEGER DEFAULT 0,
  last_question_at    TIMESTAMP,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Index

```sql
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_registered_at ON users(registered_at);
CREATE INDEX idx_subscription ON users(subscription_status);
```

---

## 🌐 Architecture Globale

```
┌─────────────────────────────────────────────┐
│          Frontend (Static HTML/JS)          │
│  - index.html (Landing + Chatbot)          │
│  - admin.html (Dashboard)                   │
│  - Tailwind CSS (CDN)                       │
└──────────────────┬──────────────────────────┘
                   │ Fetch API
                   │
┌──────────────────▼──────────────────────────┐
│       Vercel Serverless Functions           │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ /api/chat.js         (OpenAI)         │ │
│  │ /api/signup.js       (Auth + DB)      │ │
│  │ /api/setup-db.js     (Init DB)        │ │
│  │ /api/test-db.js      (Diagnostics)    │ │
│  │ /api/users.js        (User Mgmt)      │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ lib/db.js (Shared Database Functions) │ │
│  └────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┼──────────┬──────────┐
        │          │          │          │
┌───────▼──┐  ┌────▼──┐  ┌───▼─────┐  ┌─▼──────┐
│ OpenAI   │  │Vercel │  │ Google  │  │Airtable│
│  API     │  │Postgres  │ Sheets  │  │  CRM   │
│          │  │         │  │(webhook)│  │        │
│GPT-3.5-  │  │ 256 MB  │  │         │  │        │
│turbo     │  │ Free    │  │         │  │        │
└──────────┘  └─────────┘  └─────────┘  └────────┘
```

---

## 📦 Dépendances

### Production (`dependencies`)

```json
{
  "@vercel/postgres": "^0.5.0",  // ✅ NOUVEAU - Client PostgreSQL
  "bcrypt": "^5.1.1"              // ✅ NOUVEAU - Hachage sécurisé
}
```

### Développement (`devDependencies`)

```json
{
  "vercel": "^32.0.0"             // CLI Vercel
}
```

---

## 🔐 Variables d'Environnement

### Automatiques (Vercel Postgres)
Ajoutées automatiquement lors de la connexion de la database :

```bash
POSTGRES_URL=postgresql://...
POSTGRES_PRISMA_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...
POSTGRES_USER=default
POSTGRES_HOST=xxx.postgres.vercel-storage.com
POSTGRES_PASSWORD=***
POSTGRES_DATABASE=verceldb
```

### Manuelles (À ajouter)

```bash
# Obligatoires
OPENAI_API_KEY=sk-***              # Clé API OpenAI
SETUP_KEY=sosdivorce-setup-***     # Clé pour /api/setup-db

# Optionnelles
GOOGLE_WEBHOOK_URL=https://***     # Webhook Google Sheets
GOOGLE_SCRIPT_URL=https://***      # Google Apps Script
AIRTABLE_API_KEY=key***            # Clé Airtable
AIRTABLE_BASE_ID=app***            # Base Airtable
```

---

## 🚀 Flux de Données

### Inscription d'un Utilisateur

```
1. User remplit formulaire sur index.html
   ↓
2. Frontend → POST /api/signup
   {firstName, lastName, email}
   ↓
3. api/signup.js → lib/db.js
   addUser(userData)
   ↓
4. lib/db.js → Vercel Postgres
   INSERT INTO users...
   ↓
5. (Optionnel) → Google Sheets
   Webhook POST avec données
   ↓
6. Response → Frontend
   {ok: true, user: {...}}
   ↓
7. Frontend → Set cookies
   registered=1, user_name=..., user_email=...
```

### Question au Chatbot

```
1. User tape question dans chatbox
   ↓
2. Frontend → POST /api/chat
   {message: "..."}
   ↓
3. api/chat.js vérifie cookies
   - Non inscrit : max 2 questions
   - Inscrit : illimité
   ↓
4. api/chat.js → OpenAI API
   POST https://api.openai.com/v1/chat/completions
   ↓
5. OpenAI → Response
   {answer: "..."}
   ↓
6. api/chat.js → Frontend
   {status: 'ok', answer: '...', remaining: X}
   ↓
7. Frontend affiche réponse avec effet typing
```

---

## 📊 Tailles des Fichiers

### Code Backend

```
lib/db.js              7.9 KB   ✅ Base de données PostgreSQL
api/signup.js          6.4 KB   ✅ Inscription (mise à jour)
api/setup-db.js        2.2 KB   ✅ Initialisation DB
api/test-db.js         4.0 KB   ✅ Diagnostics
api/chat.js            3.8 KB   💬 Chatbot
```

### Documentation

```
docs/README.md                    7.6 KB   📖 Index
docs/QUICK_START.md               4.3 KB   🚀 Guide rapide
docs/SETUP_POSTGRES.md            8.7 KB   📘 Configuration
docs/MIGRATION_SUMMARY.md        10.0 KB   📋 Résumé technique
docs/DEPLOYMENT_CHECKLIST.md      9.8 KB   ✅ Checklist
docs/STRUCTURE.md                 (ce fichier)
```

**Total Documentation :** ~50 KB

---

## 🔄 Workflow de Développement

### Développement Local

```bash
# 1. Clone du projet
git clone <repo>

# 2. Installation des dépendances
npm install

# 3. Lier le projet Vercel
vercel link

# 4. Télécharger les variables d'environnement
vercel env pull .env.local

# 5. Lancer le serveur local
vercel dev
# → http://localhost:3000
```

### Déploiement Production

```bash
# 1. Tester localement
vercel dev

# 2. Déployer en production
vercel --prod

# 3. Vérifier le déploiement
vercel logs

# 4. Tester les endpoints
curl https://sosdivorce.fr/api/test-db
```

---

## 🧪 Tests à Effectuer

### Tests Backend

```bash
# Test de connexion DB
curl https://sosdivorce.fr/api/test-db

# Test health check
curl https://sosdivorce.fr/api/health

# Test inscription
curl -X POST https://sosdivorce.fr/api/signup \
  -H "Content-Type: application/json" \
  -d '{"action":"register","firstName":"Test","lastName":"User","email":"test@example.com"}'
```

### Tests Frontend

1. Visiter `https://sosdivorce.fr`
2. Poser une question au chatbot
3. S'inscrire via le modal
4. Vérifier le dashboard admin : `/admin.html`

---

## 📈 Métriques de Performance

### Latence Attendue

| Endpoint | Temps Moyen | Timeout |
|----------|-------------|---------|
| `/api/chat` | 1-3s | 30s |
| `/api/signup` | 100-300ms | 10s |
| `/api/test-db` | 50-100ms | 10s |
| `/api/setup-db` | 200-500ms | 10s |

### Limites Vercel (Plan Hobby)

- **Bandwidth :** 100 GB/mois
- **Invocations :** 100K/mois
- **Execution Time :** Max 10s (30s pour chat)
- **Database :** 256 MB (60h compute/mois)

---

## 🔒 Sécurité

### Actuellement Implémenté

- ✅ Clé API OpenAI côté serveur
- ✅ Hachage bcrypt des mots de passe
- ✅ HTTPS uniquement (Vercel)
- ✅ Validation des entrées utilisateur
- ✅ Protection endpoint setup-db (SETUP_KEY)

### À Améliorer (Prochaines Étapes)

- ⚠️ CORS trop ouvert (`*` → restreindre au domaine)
- ⚠️ Cookies non HttpOnly (vulnérable XSS)
- ⚠️ Pas de rate limiting API
- ⚠️ Pas de JWT pour sessions

Voir [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) Section "Prochaines Étapes"

---

## 📞 Ressources

### Documentation Interne
- [Index Documentation](README.md)
- [Guide Rapide](QUICK_START.md)
- [Setup Complet](SETUP_POSTGRES.md)
- [Résumé Technique](MIGRATION_SUMMARY.md)
- [Checklist](DEPLOYMENT_CHECKLIST.md)

### Documentation Externe
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Vercel Functions](https://vercel.com/docs/functions)
- [PostgreSQL](https://www.postgresql.org/docs/)

---

**Dernière mise à jour :** Octobre 2024
**Version :** 1.0 (Migration PostgreSQL)
**Projet :** sosdivorce.fr
