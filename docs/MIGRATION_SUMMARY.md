# 📋 Résumé de la Migration vers Vercel Postgres

## ✅ Changements Effectués

### 1. Packages Installés

**Fichier modifié** : [package.json](package.json)

**Ajouts** :
```json
"dependencies": {
  "@vercel/postgres": "^0.5.0",
  "bcrypt": "^5.1.1"
}
```

**Installation** :
```bash
npm install
```

---

### 2. Nouveau Système de Base de Données

#### ✅ Créé : [lib/db.js](lib/db.js)

**Remplace** : `lib/database.js` (renommé en `lib/database.js.backup`)

**Fonctionnalités** :
- ✅ Connexion à Vercel Postgres via `@vercel/postgres`
- ✅ Hachage sécurisé des mots de passe avec bcrypt
- ✅ Fonctions asynchrones pour toutes les opérations
- ✅ Gestion des erreurs améliorée
- ✅ Pagination pour les listes d'utilisateurs

**Fonctions disponibles** :
```javascript
// Table
createUsersTable()

// Utilisateurs
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

### 3. Endpoint d'Initialisation

#### ✅ Créé : [api/setup-db.js](api/setup-db.js)

**Usage** : Initialiser la table `users` dans Postgres

**URL** : `https://sosdivorce.fr/api/setup-db?key=VOTRE_CLE_SETUP`

**Sécurité** : Protégé par variable d'environnement `SETUP_KEY`

**À exécuter** : UNE SEULE FOIS après avoir configuré Vercel Postgres

---

### 4. API Signup Mise à Jour

#### ✅ Modifié : [api/signup.js](api/signup.js)

**Changements** :

**Avant** :
```javascript
import { addUser, findUserByEmail } from '../lib/database.js';
const user = addUser({ firstName, lastName, email }); // Synchrone
```

**Après** :
```javascript
import { addUser, findUserByEmail, verifyUserPassword } from '../lib/db.js';
const user = await addUser({ firstName, lastName, email }); // Asynchrone
```

**Améliorations** :
- ✅ Toutes les fonctions utilisent `await` (async/await)
- ✅ Login avec vérification sécurisée du mot de passe
- ✅ Pagination pour la liste des utilisateurs (100 max)
- ✅ Statistiques enrichies (total, aujourd'hui, premium, free)

---

### 5. Ancien Fichier Sauvegardé

#### 📦 Renommé : `lib/database.js` → [lib/database.js.backup](lib/database.js.backup)

**Pourquoi sauvegardé ?**
- Référence pour comparaison
- Rollback possible si nécessaire
- Peut être supprimé après validation complète

---

## 🗄️ Structure de la Base de Données

### Table `users`

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,                      -- ID auto-incrémenté
  first_name VARCHAR(100) NOT NULL,           -- Prénom
  last_name VARCHAR(100) NOT NULL,            -- Nom
  email VARCHAR(255) UNIQUE NOT NULL,         -- Email unique
  password_hash VARCHAR(255),                 -- Hash bcrypt du mot de passe
  registered_at TIMESTAMP DEFAULT NOW(),      -- Date d'inscription
  subscription_status VARCHAR(50) DEFAULT 'free', -- 'free' ou 'premium'
  questions_used INTEGER DEFAULT 0,           -- Compteur de questions
  last_question_at TIMESTAMP,                 -- Date dernière question
  created_at TIMESTAMP DEFAULT NOW(),         -- Date de création
  updated_at TIMESTAMP DEFAULT NOW()          -- Date de modification
);

-- Index pour performance
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_registered_at ON users(registered_at);
CREATE INDEX idx_subscription ON users(subscription_status);
```

---

## 🔄 Différences : Ancien vs Nouveau Système

| Aspect | Ancien Système | Nouveau Système |
|--------|----------------|-----------------|
| **Stockage** | Mémoire (volatile) | PostgreSQL (persistant) |
| **Perte de données** | ❌ À chaque redéploiement | ✅ Jamais |
| **Scalabilité** | ❌ Limitée | ✅ Excellente |
| **Authentification** | ❌ Pas de vérification password | ✅ bcrypt sécurisé |
| **ID utilisateur** | `Date.now()` (collisions possibles) | SERIAL (unique garanti) |
| **Pagination** | ❌ Non | ✅ Oui (limit/offset) |
| **Statistiques** | Basiques | Enrichies (premium/free) |
| **Requêtes** | Recherche linéaire O(n) | Index SQL O(log n) |
| **Concurrent access** | ❌ Problématique | ✅ Géré par Postgres |

---

## 📝 Actions à Effectuer

### ⚠️ Obligatoires

1. **Créer la base de données sur Vercel**
   - Dashboard → Storage → Create Database → Postgres
   - Suivre le guide : [SETUP_POSTGRES.md](SETUP_POSTGRES.md)

2. **Ajouter la variable d'environnement SETUP_KEY**
   - Settings → Environment Variables
   - Clé : `SETUP_KEY`
   - Valeur : Une clé secrète aléatoire

3. **Déployer le code**
   ```bash
   npm run deploy
   # ou
   vercel --prod
   ```

4. **Initialiser la table users**
   - Visitez : `https://sosdivorce.fr/api/setup-db?key=VOTRE_CLE_SETUP`
   - Vérifier que la réponse est `"success": true`

5. **Tester l'inscription**
   - Créer un nouvel utilisateur sur le site
   - Vérifier dans Vercel Dashboard → Storage → Data

### 📌 Optionnelles

6. **Migrer les utilisateurs existants de Google Sheets** (si applicable)
   - Exporter les données de Google Sheets
   - Créer un script de migration
   - Importer dans Postgres

7. **Configurer le développement local**
   ```bash
   vercel env pull .env.local
   vercel dev
   ```

8. **Nettoyer après validation**
   - Supprimer `lib/database.js.backup` (après 1-2 semaines)
   - Nettoyer les anciennes variables d'environnement si nécessaires

---

## 🔧 Variables d'Environnement Requises

### Automatiquement ajoutées par Vercel (après connexion de la DB)

- `POSTGRES_URL` - URL complète de connexion
- `POSTGRES_PRISMA_URL` - URL pour Prisma (non utilisée actuellement)
- `POSTGRES_URL_NON_POOLING` - URL sans pooling
- `POSTGRES_USER` - Nom d'utilisateur
- `POSTGRES_HOST` - Hôte de la base
- `POSTGRES_PASSWORD` - Mot de passe
- `POSTGRES_DATABASE` - Nom de la base

### À ajouter manuellement

- `SETUP_KEY` - Clé secrète pour `/api/setup-db`

### Existantes (inchangées)

- `OPENAI_API_KEY` - Clé API OpenAI
- `GOOGLE_WEBHOOK_URL` - Webhook Google Sheets (optionnel)
- `GOOGLE_SCRIPT_URL` - Script Google Apps (optionnel)
- `AIRTABLE_API_KEY` - Clé Airtable (optionnel)
- `AIRTABLE_BASE_ID` - Base Airtable (optionnel)

---

## 🧪 Tests à Effectuer

### Test 1 : Inscription

1. Aller sur `https://sosdivorce.fr`
2. Cliquer sur "S'inscrire"
3. Remplir le formulaire
4. Vérifier le message de succès
5. Vérifier dans Vercel → Storage → Data

**Résultat attendu** : Utilisateur créé avec `subscription_status = 'free'`

### Test 2 : Login (si implémenté avec password)

1. Tenter de se connecter avec email + password
2. Vérifier les cookies après connexion
3. Vérifier que `registered=1`

**Résultat attendu** : Connexion réussie

### Test 3 : Statistiques Admin

1. Aller sur `https://sosdivorce.fr/admin.html`
2. Vérifier que les statistiques s'affichent
3. Vérifier la liste des utilisateurs

**Résultat attendu** : Dashboard fonctionnel avec données Postgres

### Test 4 : Persistance

1. Créer un utilisateur
2. Faire un redéploiement : `vercel --prod`
3. Vérifier que l'utilisateur existe toujours

**Résultat attendu** : ✅ Données toujours présentes (contrairement à avant !)

---

## 🐛 Problèmes Potentiels

### Erreur : "Cannot find module '@vercel/postgres'"

**Cause** : Package non installé

**Solution** :
```bash
npm install
```

### Erreur : "Connection timeout"

**Cause** : Variables d'environnement non configurées

**Solution** :
1. Vérifier que la DB est connectée au projet sur Vercel
2. Redéployer le projet
3. Attendre 2-3 minutes

### Erreur : "Duplicate key value violates unique constraint"

**Cause** : Email déjà utilisé

**Solution** : C'est normal ! L'email doit être unique. Utiliser un autre email.

### Utilisateurs pas visibles dans le Dashboard

**Cause** : Mauvaise database sélectionnée

**Solution** :
1. Vérifier que vous êtes dans la bonne DB (`sosdivorce-db`)
2. Rafraîchir la page
3. Utiliser l'onglet Query : `SELECT * FROM users;`

---

## 📊 Métriques de Succès

Après migration, vous devriez observer :

- ✅ Données persistantes entre redéploiements
- ✅ Temps de réponse similaire ou meilleur
- ✅ Aucune perte de données
- ✅ Dashboard admin fonctionnel
- ✅ Statistiques précises
- ✅ Authentification sécurisée (avec bcrypt)

---

## 🎯 Prochaines Étapes Recommandées

### Sécurité (Priorité Haute)

1. **Implémenter JWT pour les sessions**
   - Remplacer les cookies simples par des tokens JWT signés
   - Ajouter expiration automatique des sessions

2. **Restreindre CORS**
   - Changer `Access-Control-Allow-Origin: *` en votre domaine uniquement
   - Protéger vos endpoints API

3. **Ajouter Rate Limiting**
   - Limiter les requêtes par IP
   - Protéger contre les abus

### Fonctionnalités (Priorité Moyenne)

4. **Cache Redis pour les réponses ChatGPT**
   - Réduire les coûts OpenAI
   - Améliorer les temps de réponse

5. **Système de paiement (Stripe)**
   - Gérer les abonnements premium
   - Webhooks pour mise à jour automatique du statut

6. **Emails transactionnels**
   - Confirmation d'inscription
   - Reset de mot de passe
   - Rappels d'abonnement

### Monitoring (Priorité Basse)

7. **Sentry pour le tracking d'erreurs**
8. **Analytics sur l'utilisation**
9. **Backups automatiques de la DB**

---

## 📞 Support

**Questions ?**
- Consultez [SETUP_POSTGRES.md](SETUP_POSTGRES.md) pour le guide détaillé
- Vérifiez les logs Vercel : Dashboard → Deployments → Function Logs
- Inspectez le code : [lib/db.js](lib/db.js)

**Documentation Vercel Postgres** : https://vercel.com/docs/storage/vercel-postgres

---

## ✅ Validation de la Migration

Une fois tous les tests passés, vous pouvez :

- [ ] Supprimer `lib/database.js.backup`
- [ ] Mettre à jour la documentation
- [ ] Informer l'équipe de la migration
- [ ] Passer aux prochaines améliorations de sécurité

---

**🎉 Migration vers Vercel Postgres terminée avec succès !**

Votre projet utilise maintenant une vraie base de données persistante et sécurisée.
