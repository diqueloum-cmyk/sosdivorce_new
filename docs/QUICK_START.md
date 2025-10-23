# 🚀 Quick Start - Migration Vercel Postgres

**Démarrage rapide en 5 étapes simples**

---

## ⚡ TL;DR

Votre projet a été migré vers Vercel Postgres. Suivez ces 5 étapes pour déployer :

```
1. Créer DB Postgres sur Vercel Dashboard
2. Ajouter variable SETUP_KEY
3. Déployer : vercel --prod
4. Visiter : /api/setup-db?key=VOTRE_CLE
5. Tester : /api/test-db
```

---

## 📝 Les 5 Étapes en Détail

### 1️⃣ Créer la Base de Données (2 min)

**Sur le Dashboard Vercel :**
1. Projet `sosdivorce-site` → **Storage** → **Create Database**
2. Choisir **Postgres** → Plan **Hobby** (gratuit)
3. Nom : `sosdivorce-db` → Région : `fra1` (Frankfurt)
4. **Connect Project** → Sélectionner tous les environnements
5. ✅ Done ! Les variables `POSTGRES_*` sont auto-ajoutées

---

### 2️⃣ Ajouter la Clé de Setup (1 min)

**Settings → Environment Variables → Add New :**
- **Key** : `SETUP_KEY`
- **Value** : `sosdivorce-setup-2024-xyz123` (générer une clé aléatoire)
- **Environments** : Cocher Production, Preview, Development
- Cliquer **Save**

💡 **Conservez cette clé**, vous en aurez besoin à l'étape 4 !

---

### 3️⃣ Déployer le Code (2 min)

**Dans votre terminal :**

```bash
cd "d:\aymar\Documents\copie projet sosdivorce\sosdivorce-site - 1\sosdivorce-site"

# Déployer en production
vercel --prod
```

Attendez que Vercel affiche :
```
✅ Production: https://sosdivorce.fr [copied to clipboard]
```

---

### 4️⃣ Initialiser la Table Users (1 min)

**Dans votre navigateur, visitez UNE SEULE FOIS :**

```
https://sosdivorce.fr/api/setup-db?key=sosdivorce-setup-2024-xyz123
```

**⚠️ Remplacez la clé par celle que vous avez créée à l'étape 2**

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Base de données initialisée avec succès"
}
```

✅ Si vous voyez ça, c'est parfait !

---

### 5️⃣ Vérifier que Tout Fonctionne (1 min)

**Test 1 - Connexion DB :**
```
https://sosdivorce.fr/api/test-db
```
✅ Doit afficher `"success": true` et `"table.status": "✅ Existe"`

**Test 2 - Inscription :**
1. Aller sur `https://sosdivorce.fr`
2. Cliquer "S'inscrire"
3. Remplir le formulaire
4. ✅ Doit afficher "Inscription réussie !"

**Test 3 - Dashboard :**
```
https://sosdivorce.fr/admin.html
```
✅ Doit afficher vos statistiques et utilisateurs

**Test 4 - Persistance (IMPORTANT) :**
1. Noter le nombre d'utilisateurs
2. Redéployer : `vercel --prod`
3. Retourner sur `/admin.html`
4. ✅ Le nombre d'utilisateurs doit être **identique** (pas de perte de données !)

---

## 🎉 C'est Tout !

**Si tous les tests sont ✅, votre migration est réussie !**

### Ce qui a changé :
- ✅ Données persistantes (plus de pertes lors des redéploiements)
- ✅ Authentification sécurisée avec bcrypt
- ✅ Base de données SQL performante
- ✅ Scalabilité assurée

---

## 📚 Documentation Complète

Pour plus de détails :
- **Guide complet** : [SETUP_POSTGRES.md](SETUP_POSTGRES.md)
- **Résumé technique** : [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)
- **Checklist détaillée** : [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

---

## 🆘 Problème ?

### Erreur "No database connection"
→ Vérifier que la DB est connectée au projet dans Vercel Dashboard

### Erreur "Access denied" sur setup-db
→ Vérifier que la clé dans l'URL correspond à `SETUP_KEY`

### Table déjà créée
→ Normal ! Vous avez déjà exécuté `/api/setup-db`

### Besoin d'aide
→ Consulter [SETUP_POSTGRES.md](SETUP_POSTGRES.md) Section "Dépannage"

---

## 🔧 Commandes Utiles

```bash
# Installer les dépendances
npm install

# Tester en local
vercel dev

# Télécharger les variables d'env
vercel env pull .env.local

# Déployer en production
vercel --prod

# Voir les logs
vercel logs
```

---

## ✅ Checklist Rapide

- [ ] Database Postgres créée sur Vercel
- [ ] Variable `SETUP_KEY` ajoutée
- [ ] Code déployé avec `vercel --prod`
- [ ] `/api/setup-db?key=XXX` exécuté avec succès
- [ ] `/api/test-db` retourne success: true
- [ ] Inscription testée et fonctionnelle
- [ ] Dashboard admin affiche les données
- [ ] Données persistent après redéploiement

---

**Temps total : ~7 minutes** ⏱️

**Difficulté : Facile** 😊

**Prérequis : Compte Vercel + Projet déployé** ✅
