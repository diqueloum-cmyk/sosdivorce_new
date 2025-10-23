# ✅ Checklist de Déploiement - Migration Postgres

Suivez cette checklist étape par étape pour déployer la nouvelle version avec Vercel Postgres.

---

## 📦 Phase 1 : Préparation Locale

### ✅ Code et Dépendances

- [ ] **Vérifier que tous les fichiers sont présents**
  ```bash
  # Vérifier les nouveaux fichiers
  ls lib/db.js
  ls api/setup-db.js
  ls api/test-db.js
  ls SETUP_POSTGRES.md
  ls MIGRATION_SUMMARY.md
  ```

- [ ] **Installer les dépendances**
  ```bash
  npm install
  ```
  ✅ Doit installer `@vercel/postgres` et `bcrypt`

- [ ] **Vérifier package.json**
  - [x] `@vercel/postgres: ^0.5.0` présent dans dependencies
  - [x] `bcrypt: ^5.1.1` présent dans dependencies

- [ ] **Vérifier que l'ancien fichier est sauvegardé**
  ```bash
  ls lib/database.js.backup
  ```
  ✅ Doit exister (ancien système sauvegardé)

---

## 🚀 Phase 2 : Configuration Vercel Dashboard

### ✅ Créer la Base de Données

- [ ] **Connexion au Dashboard Vercel**
  - Aller sur [vercel.com](https://vercel.com)
  - Sélectionner le projet `sosdivorce-site`

- [ ] **Créer Postgres Database**
  1. Cliquer sur **Storage** dans le menu
  2. Cliquer sur **Create Database**
  3. Sélectionner **Postgres**
  4. Configurer :
     - Database Name: `sosdivorce-db`
     - Region: `fra1` (Frankfurt) ou la plus proche
     - Plan: **Hobby** (gratuit)
  5. Cliquer **Create**

- [ ] **Connecter la Database au Projet**
  1. Cliquer **Connect Project**
  2. Sélectionner `sosdivorce-site`
  3. Sélectionner tous les environnements :
     - [x] Production
     - [x] Preview
     - [x] Development
  4. Cliquer **Connect**

- [ ] **Vérifier les Variables d'Environnement Auto-ajoutées**
  - Aller dans **Settings** → **Environment Variables**
  - Vérifier que ces variables existent :
    - [x] `POSTGRES_URL`
    - [x] `POSTGRES_USER`
    - [x] `POSTGRES_HOST`
    - [x] `POSTGRES_PASSWORD`
    - [x] `POSTGRES_DATABASE`

### ✅ Ajouter la Clé de Setup

- [ ] **Créer SETUP_KEY**
  1. Aller dans **Settings** → **Environment Variables**
  2. Cliquer **Add New**
  3. Configurer :
     - Key: `SETUP_KEY`
     - Value: `sosdivorce-setup-2024-[RANDOM]` (générer une clé aléatoire)
     - Environments: Cocher **Production**, **Preview**, **Development**
  4. Cliquer **Save**

- [ ] **Noter la clé SETUP_KEY**
  ```
  Ma clé SETUP_KEY : _______________________________________
  ```
  ⚠️ Conservez cette clé en sécurité !

### ✅ Vérifier les Autres Variables

- [ ] **OPENAI_API_KEY existe**
  - Doit déjà être configurée
  - Sinon, l'ajouter maintenant

---

## 🔧 Phase 3 : Déploiement

### ✅ Commit et Push (si Git)

- [ ] **Vérifier les changements**
  ```bash
  git status
  ```

- [ ] **Committer les changements**
  ```bash
  git add .
  git commit -m "Migration vers Vercel Postgres - Base de données persistante"
  ```

- [ ] **Pusher vers le repository**
  ```bash
  git push origin main
  # ou
  git push origin master
  ```

### ✅ Déploiement Vercel

- [ ] **Déployer en production**
  ```bash
  vercel --prod
  ```
  ou attendre le déploiement automatique si Git est lié

- [ ] **Attendre la fin du déploiement**
  - Vercel affichera l'URL de production
  - Attendre que le statut soit "Ready"

- [ ] **Noter l'URL de production**
  ```
  URL Production : _______________________________________
  ```

---

## 🏗️ Phase 4 : Initialisation de la Base de Données

### ✅ Tester la Connexion

- [ ] **Visiter l'endpoint de test**
  ```
  https://VOTRE-URL/api/test-db
  ```

- [ ] **Vérifier la réponse**
  - `connection.status` doit être "✅ OK"
  - `table.status` sera "❌ Manquante" (normal, pas encore créée)

### ✅ Créer la Table Users

- [ ] **Exécuter le script de setup**
  ```
  https://VOTRE-URL/api/setup-db?key=VOTRE_CLE_SETUP
  ```
  Remplacer :
  - `VOTRE-URL` par votre URL de production
  - `VOTRE_CLE_SETUP` par la clé notée plus haut

- [ ] **Vérifier la réponse du setup**
  ```json
  {
    "success": true,
    "message": "Base de données initialisée avec succès"
  }
  ```
  ✅ Si vous voyez ça, c'est bon !

- [ ] **Re-tester la connexion**
  ```
  https://VOTRE-URL/api/test-db
  ```
  - `table.status` doit maintenant être "✅ Existe"
  - `structure.columnsCount` doit être 11
  - `indexes.count` doit être 4

---

## 🧪 Phase 5 : Tests Fonctionnels

### ✅ Test d'Inscription

- [ ] **Visiter le site**
  ```
  https://sosdivorce.fr
  # ou votre URL personnalisée
  ```

- [ ] **Cliquer sur "S'inscrire"**

- [ ] **Remplir le formulaire**
  - Prénom: `Test`
  - Nom: `Utilisateur`
  - Email: `test@example.com`

- [ ] **Vérifier le message de succès**
  ```
  "Inscription réussie ! Vous pouvez maintenant poser des questions illimitées."
  ```

- [ ] **Vérifier les cookies**
  - Ouvrir DevTools (F12)
  - Onglet Application → Cookies
  - Vérifier :
    - [x] `registered = 1`
    - [x] `user_name = Test`
    - [x] `user_email = test@example.com`
    - [x] `q_used = 0`

### ✅ Vérifier dans la Base de Données

- [ ] **Retourner sur Vercel Dashboard**
  1. **Storage** → `sosdivorce-db`
  2. Onglet **Data**
  3. Sélectionner la table `users`

- [ ] **Vérifier que l'utilisateur apparaît**
  - Doit voir une ligne avec :
    - first_name: `Test`
    - last_name: `Utilisateur`
    - email: `test@example.com`
    - subscription_status: `free`

### ✅ Test du Chatbot

- [ ] **Poser une question**
  - Taper : "Qu'est-ce qu'un divorce pour faute ?"
  - Cliquer "Envoyer"

- [ ] **Vérifier la réponse**
  - ✅ Réponse du chatbot reçue
  - ✅ Pas d'erreur affichée

### ✅ Test du Dashboard Admin

- [ ] **Visiter la page admin**
  ```
  https://VOTRE-URL/admin.html
  ```

- [ ] **Vérifier les statistiques**
  - Total utilisateurs : au moins 1
  - Utilisateurs aujourd'hui : au moins 1
  - Liste des utilisateurs : doit contenir l'utilisateur de test

### ✅ Test de Persistance (CRITIQUE)

- [ ] **Noter le nombre d'utilisateurs actuels**
  ```
  Nombre actuel : _______
  ```

- [ ] **Faire un redéploiement**
  ```bash
  vercel --prod
  ```

- [ ] **Attendre la fin du redéploiement**

- [ ] **Re-vérifier le dashboard admin**
  - Le nombre d'utilisateurs doit être **identique**
  - ✅ Si c'est le cas, la persistance fonctionne !

---

## 🔍 Phase 6 : Vérification Finale

### ✅ Checklist Complète

- [ ] Base de données Postgres créée et connectée
- [ ] Variable `SETUP_KEY` configurée
- [ ] Table `users` créée avec succès
- [ ] Inscription fonctionnelle
- [ ] Données visibles dans Vercel Dashboard
- [ ] Chatbot fonctionnel
- [ ] Dashboard admin affiche les données
- [ ] **Données persistantes après redéploiement** ✨
- [ ] Aucune erreur dans les logs Vercel

### ✅ Vérifier les Logs

- [ ] **Consulter les logs Vercel**
  1. Dashboard → Project → Deployments
  2. Cliquer sur le dernier déploiement
  3. Onglet **Logs**

- [ ] **Vérifier qu'il n'y a pas d'erreurs**
  - Pas de "Connection timeout"
  - Pas de "Module not found"
  - Pas de "Database error"

---

## 🎉 Phase 7 : Migration des Données Existantes (Optionnel)

Si vous avez déjà des utilisateurs dans Google Sheets :

- [ ] **Exporter les données de Google Sheets**
  - Fichier → Télécharger → CSV

- [ ] **Créer un script de migration** (à faire manuellement ou demander de l'aide)

- [ ] **Importer les utilisateurs dans Postgres**

- [ ] **Vérifier que tous les utilisateurs sont importés**

---

## 📋 Phase 8 : Nettoyage et Documentation

### ✅ Nettoyage (après 1-2 semaines de validation)

- [ ] **Supprimer le fichier backup**
  ```bash
  rm lib/database.js.backup
  ```

- [ ] **Commit le nettoyage**
  ```bash
  git add .
  git commit -m "Nettoyage: suppression ancien système de base de données"
  git push
  ```

### ✅ Documentation

- [ ] **Mettre à jour la date dans README.md**
  - Remplacer `[Date]` par la date du jour

- [ ] **Informer l'équipe de la migration**

- [ ] **Archiver cette checklist**

---

## 🆘 Dépannage

### ❌ Erreur : "No database connection"

**Solution** :
1. Vérifier que la database est connectée au projet
2. Vérifier les variables d'environnement
3. Redéployer : `vercel --prod`
4. Attendre 2-3 minutes

### ❌ Erreur : "Access denied" sur /api/setup-db

**Solution** :
1. Vérifier que `SETUP_KEY` est bien définie
2. Vérifier l'URL : `?key=VOTRE_CLE` est bien ajouté
3. Vérifier que la clé correspond exactement

### ❌ Table déjà créée

**Solution** : C'est normal ! Vous pouvez ignorer cette erreur.

### ❌ Utilisateurs ne s'affichent pas dans le dashboard

**Solution** :
1. Rafraîchir la page
2. Vérifier dans Vercel → Storage → Data
3. Exécuter une requête SQL : `SELECT * FROM users;`

### ❌ Données perdues après redéploiement

**Solution** :
1. ⚠️ Postgres n'est peut-être pas bien configuré
2. Vérifier Storage → Database → Connection
3. Re-connecter le projet à la database
4. Vérifier que les variables d'environnement sont présentes

---

## 📞 Support

**Besoin d'aide ?**

- Consulter [SETUP_POSTGRES.md](SETUP_POSTGRES.md)
- Consulter [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)
- Vérifier les logs Vercel
- Documentation Vercel Postgres : https://vercel.com/docs/storage/vercel-postgres

---

## ✅ Validation Finale

**Critères de succès** :

- ✅ Base de données créée
- ✅ Table users initialisée
- ✅ Inscription fonctionne
- ✅ Données visibles dans le dashboard
- ✅ **Données persistantes après redéploiement**
- ✅ Aucune erreur dans les logs

**Si tous ces critères sont remplis : 🎉 Migration réussie !**

---

**Date de la migration** : _______________________________________

**Effectuée par** : _______________________________________

**Notes supplémentaires** :
```
_________________________________________________________
_________________________________________________________
_________________________________________________________
```
