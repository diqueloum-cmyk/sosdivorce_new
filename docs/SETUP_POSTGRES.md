# Guide de Configuration Vercel Postgres

Ce guide vous explique comment configurer Vercel Postgres pour votre projet sosdivorce.fr.

## 📋 Prérequis

- Compte Vercel avec le projet `sosdivorce-site` déployé
- Accès au dashboard Vercel

---

## 🚀 Étape 1 : Créer la Base de Données Postgres

### 1.1 Accéder au Dashboard Vercel

1. Connectez-vous sur [vercel.com](https://vercel.com)
2. Sélectionnez votre projet **sosdivorce-site**
3. Cliquez sur l'onglet **Storage** dans le menu

### 1.2 Créer la Database

1. Cliquez sur le bouton **Create Database**
2. Sélectionnez **Postgres**
3. Configurez la database :
   - **Database Name** : `sosdivorce-db` (ou un nom de votre choix)
   - **Region** : Choisissez la région la plus proche (ex: `fra1` pour Frankfurt)
   - **Plan** : Sélectionnez **Hobby** (gratuit)
4. Cliquez sur **Create**

### 1.3 Connecter la Database au Projet

1. Une fois la database créée, cliquez sur **Connect Project**
2. Sélectionnez votre projet **sosdivorce-site**
3. Sélectionnez l'environnement :
   - ✅ **Production** (pour le site live)
   - ✅ **Preview** (pour les déploiements de test)
   - ✅ **Development** (pour le développement local)
4. Cliquez sur **Connect**

**✅ Les variables d'environnement sont automatiquement ajoutées :**
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

---

## 🔧 Étape 2 : Ajouter une Clé de Setup (Sécurité)

Pour protéger l'endpoint `/api/setup-db`, ajoutez une clé secrète :

1. Dans le dashboard Vercel, allez dans **Settings** → **Environment Variables**
2. Cliquez sur **Add New**
3. Configurez :
   - **Key** : `SETUP_KEY`
   - **Value** : Générez une clé aléatoire (ex: `sosdivorce-setup-2024-xyz123`)
   - **Environments** : Sélectionnez **Production**, **Preview**, et **Development**
4. Cliquez sur **Save**

**💡 Conservez cette clé en sécurité, vous en aurez besoin pour l'étape suivante !**

---

## 🏗️ Étape 3 : Initialiser la Table Users

### 3.1 Déployer les Changements

Avant d'initialiser la database, assurez-vous que votre code est déployé :

```bash
# Dans votre terminal
cd "d:\aymar\Documents\copie projet sosdivorce\sosdivorce-site - 1\sosdivorce-site"

# Déployer sur Vercel
npm run deploy
# ou
vercel --prod
```

### 3.2 Exécuter le Script d'Initialisation

Une fois déployé, visitez l'URL suivante **UNE SEULE FOIS** :

```
https://sosdivorce.fr/api/setup-db?key=VOTRE_CLE_SETUP
```

**Remplacez `VOTRE_CLE_SETUP` par la clé que vous avez créée à l'étape 2.**

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Base de données initialisée avec succès",
  "details": {
    "success": true,
    "message": "Table users créée avec succès"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "info": {
    "table": "users",
    "columns": [
      "id (SERIAL PRIMARY KEY)",
      "first_name (VARCHAR 100)",
      "last_name (VARCHAR 100)",
      "email (VARCHAR 255 UNIQUE)",
      "password_hash (VARCHAR 255)",
      "registered_at (TIMESTAMP)",
      "subscription_status (VARCHAR 50)",
      "questions_used (INTEGER)",
      "last_question_at (TIMESTAMP)",
      "created_at (TIMESTAMP)",
      "updated_at (TIMESTAMP)"
    ],
    "indexes": [
      "idx_email",
      "idx_registered_at",
      "idx_subscription"
    ]
  }
}
```

---

## ✅ Étape 4 : Vérifier l'Installation

### 4.1 Vérifier la Table dans Vercel

1. Retournez dans **Storage** → **Postgres**
2. Cliquez sur votre database `sosdivorce-db`
3. Allez dans l'onglet **Data**
4. Vous devriez voir la table **users** avec toutes les colonnes

### 4.2 Tester une Inscription

1. Visitez votre site : `https://sosdivorce.fr`
2. Cliquez sur **S'inscrire**
3. Remplissez le formulaire
4. Vérifiez dans **Storage** → **Data** que l'utilisateur apparaît

---

## 🔄 Étape 5 : Développement Local (Optionnel)

Pour tester localement avec Vercel Postgres :

### 5.1 Installer Vercel CLI

```bash
npm install -g vercel
```

### 5.2 Se Connecter à Vercel

```bash
vercel login
```

### 5.3 Lier le Projet

```bash
cd "d:\aymar\Documents\copie projet sosdivorce\sosdivorce-site - 1\sosdivorce-site"
vercel link
```

### 5.4 Télécharger les Variables d'Environnement

```bash
vercel env pull .env.local
```

Cela créera un fichier `.env.local` avec toutes les variables d'environnement, y compris celles de Postgres.

### 5.5 Lancer le Serveur Local

```bash
npm run dev
# ou
vercel dev
```

Visitez : `http://localhost:3000/api/setup-db?key=VOTRE_CLE`

---

## 📊 Structure de la Base de Données

### Table : `users`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | SERIAL | ID auto-incrémenté (clé primaire) |
| `first_name` | VARCHAR(100) | Prénom de l'utilisateur |
| `last_name` | VARCHAR(100) | Nom de l'utilisateur |
| `email` | VARCHAR(255) | Email unique |
| `password_hash` | VARCHAR(255) | Hash bcrypt du mot de passe |
| `registered_at` | TIMESTAMP | Date d'inscription |
| `subscription_status` | VARCHAR(50) | Statut : 'free' ou 'premium' |
| `questions_used` | INTEGER | Nombre de questions posées |
| `last_question_at` | TIMESTAMP | Date de la dernière question |
| `created_at` | TIMESTAMP | Date de création |
| `updated_at` | TIMESTAMP | Date de dernière modification |

### Index Créés

- `idx_email` : Recherche rapide par email
- `idx_registered_at` : Tri par date d'inscription
- `idx_subscription` : Filtrage par statut d'abonnement

---

## 🔍 Requêtes SQL Utiles

### Voir tous les utilisateurs

```sql
SELECT id, first_name, last_name, email, registered_at, subscription_status
FROM users
ORDER BY registered_at DESC
LIMIT 10;
```

### Compter les utilisateurs par statut

```sql
SELECT subscription_status, COUNT(*) as count
FROM users
GROUP BY subscription_status;
```

### Utilisateurs inscrits aujourd'hui

```sql
SELECT COUNT(*) as today_count
FROM users
WHERE DATE(registered_at) = CURRENT_DATE;
```

### Mettre à jour un utilisateur en premium

```sql
UPDATE users
SET subscription_status = 'premium', updated_at = CURRENT_TIMESTAMP
WHERE email = 'email@example.com';
```

---

## 🛠️ Dépannage

### Erreur : "No database connection"

**Cause** : Les variables d'environnement ne sont pas configurées.

**Solution** :
1. Vérifiez que la database est bien connectée au projet dans Vercel
2. Redéployez le projet : `vercel --prod`
3. Attendez 1-2 minutes que les variables se propagent

### Erreur : "Table already exists"

**Cause** : La table a déjà été créée.

**Solution** : C'est normal ! Vous pouvez ignorer cette erreur. Le script utilise `CREATE TABLE IF NOT EXISTS` pour éviter les duplications.

### Erreur : "Access denied"

**Cause** : La clé `SETUP_KEY` est incorrecte ou non définie.

**Solution** :
1. Vérifiez que `SETUP_KEY` est bien définie dans les variables d'environnement
2. Utilisez la bonne clé dans l'URL : `?key=VOTRE_CLE`

### Impossible de voir les données dans Vercel Dashboard

**Cause** : Les données sont dans une autre région ou base.

**Solution** :
1. Vérifiez que vous êtes dans la bonne database
2. Rafraîchissez la page
3. Utilisez l'onglet **Query** pour exécuter : `SELECT * FROM users;`

---

## 📈 Limites du Plan Gratuit (Hobby)

- **Storage** : 256 MB
- **Compute** : 60 heures/mois
- **Rows** : Pas de limite explicite, mais limité par le storage
- **Connexions** : 100 connexions simultanées

**Estimation** : Le plan gratuit peut gérer facilement **10 000+ utilisateurs**.

---

## 🚀 Prochaines Étapes

Une fois Postgres configuré, vous pouvez :

1. ✅ Migrer les utilisateurs existants de Google Sheets (si applicable)
2. ✅ Implémenter l'authentification JWT pour plus de sécurité
3. ✅ Ajouter un système de paiement (Stripe) pour les abonnements premium
4. ✅ Configurer des backups automatiques
5. ✅ Ajouter des webhooks pour synchroniser avec d'autres services

---

## 📞 Support

**Problèmes avec Vercel Postgres ?**
- Documentation : https://vercel.com/docs/storage/vercel-postgres
- Support : https://vercel.com/support

**Problèmes avec le code ?**
- Vérifiez les logs Vercel : Dashboard → Project → Deployments → Logs
- Consultez le fichier `lib/db.js` pour les fonctions disponibles

---

## ✅ Checklist de Configuration

- [ ] Database Postgres créée sur Vercel
- [ ] Database connectée au projet
- [ ] Variable `SETUP_KEY` ajoutée
- [ ] Code déployé sur Vercel
- [ ] Endpoint `/api/setup-db` exécuté avec succès
- [ ] Table `users` visible dans le dashboard
- [ ] Test d'inscription réussi
- [ ] Variables d'environnement téléchargées localement (si dev local)

---

**🎉 Félicitations ! Votre base de données Postgres est maintenant configurée et opérationnelle !**
