# Système de Statistiques de Conversion

## Vue d'ensemble

Ce système permet de suivre le parcours utilisateur complet depuis le premier message jusqu'au paiement, avec des compteurs automatiques et des taux de conversion calculés.

## Parcours utilisateur suivi

```
Premier Message → Email Collecté → Paiement Effectué
```

## Nouvelle table: `session_statistics`

### Structure
```sql
CREATE TABLE session_statistics (
  id SERIAL PRIMARY KEY,
  stat_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  first_messages_count INTEGER DEFAULT 0,
  emails_collected_count INTEGER DEFAULT 0,
  payments_completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Colonnes ajoutées aux tables existantes

#### `paid_sessions` et `unpaid_sessions_with_email`
- `first_message_sent` (BOOLEAN) - Indique si le premier message a été envoyé (pour éviter les doublons dans les stats)

## Fonctions de comptage automatique

### 1. `incrementFirstMessage()`
Incrémente le compteur de premiers messages (appelé automatiquement lors du premier message utilisateur).

### 2. `incrementEmailCollected()`
Incrémente le compteur d'emails collectés (appelé automatiquement lors de la collecte d'email).

### 3. `incrementPaymentCompleted()`
Incrémente le compteur de paiements complétés (appelé automatiquement lors de la confirmation de paiement).

## Fonctions de récupération

### `getSessionStatistics(days = 30)`
Récupère les statistiques journalières sur une période donnée.

**Retour:**
```javascript
[
  {
    stat_date: '2026-02-07',
    first_messages_count: 50,
    emails_collected_count: 30,
    payments_completed_count: 10,
    email_conversion_rate: 60.00,      // % messages → emails
    payment_conversion_rate: 33.33,    // % emails → paiements
    total_conversion_rate: 20.00       // % messages → paiements
  },
  // ...
]
```

### `getGlobalStatistics()`
Récupère les statistiques globales (tous les temps).

**Retour:**
```javascript
{
  total_first_messages: 500,
  total_emails_collected: 300,
  total_payments_completed: 100,
  email_conversion_rate: 60.00,
  payment_conversion_rate: 33.33,
  total_conversion_rate: 20.00
}
```

## API Endpoint

### `GET /api/admin-statistics?days=30`

**Headers requis:**
```
X-Admin-Password: [ADMIN_PASSWORD depuis .env]
```

**Réponse:**
```javascript
{
  success: true,
  global: {
    total_first_messages: 500,
    total_emails_collected: 300,
    total_payments_completed: 100,
    email_conversion_rate: 60.00,
    payment_conversion_rate: 33.33,
    total_conversion_rate: 20.00
  },
  last7Days: {
    first_messages: 50,
    emails_collected: 30,
    payments_completed: 10,
    email_conversion_rate: 60.00,
    payment_conversion_rate: 33.33,
    total_conversion_rate: 20.00
  },
  daily: [
    // Statistiques journalières des 30 derniers jours
  ]
}
```

## Interface Admin

Les statistiques sont affichées dans l'onglet "Statistiques" de la page admin (/admin.html).

### Sections affichées:

1. **Statistiques Globales** - Tous les temps
   - Premiers messages totaux
   - Emails collectés totaux
   - Paiements complétés totaux
   - Taux de conversion global

2. **Statistiques 7 derniers jours**
   - Mêmes métriques que globales mais sur 7 jours

3. **Tableau détaillé par jour (30 jours)**
   - Date
   - Nombre de premiers messages
   - Nombre d'emails collectés
   - Nombre de paiements
   - Taux email (% messages → emails)
   - Taux paiement (% emails → paiements)
   - Conversion totale (% messages → paiements)

## Installation / Migration

### 1. Ajouter la table de statistiques

Exécutez le script de migration:
```
GET https://votre-site.vercel.app/api/add-first-message-tracking
```

Cela ajoutera:
- La colonne `first_message_sent` aux tables `paid_sessions` et `unpaid_sessions_with_email`
- Marquera les sessions existantes qui ont déjà des messages

### 2. Initialiser la table de statistiques

Si vous configurez une nouvelle base de données, le script `/api/setup-db` créera automatiquement la table `session_statistics`.

Pour une base existante, appelez manuellement:
```javascript
await createSessionStatisticsTable();
```

## Intégration dans le code

### Marquage du premier message

Le code dans `/api/chat.js` marque automatiquement le premier message:

```javascript
// Pour sessions payantes
await markPaidSessionFirstMessage(sessionId);

// Pour sessions non payées
await markUnpaidSessionFirstMessage(sessionId);
```

### Collecte d'email

Le code dans `/lib/db.js` incrémente automatiquement lors de la collecte d'email:

```javascript
export async function updateUnpaidSessionEmail(sessionUuid, email) {
  // ... mise à jour de l'email ...
  await incrementEmailCollected();
}
```

### Paiement complété

Le code dans `/lib/db.js` incrémente automatiquement lors du paiement:

```javascript
export async function markPaidSessionCompleted(sessionUuid, email) {
  // ... marquer comme payé ...
  await incrementPaymentCompleted();
}
```

## Requêtes SQL utiles

### Vérifier les statistiques du jour
```sql
SELECT * FROM session_statistics
WHERE stat_date = CURRENT_DATE;
```

### Réinitialiser les statistiques (ATTENTION!)
```sql
TRUNCATE TABLE session_statistics;
```

### Voir les sessions avec premier message
```sql
SELECT COUNT(*) FROM paid_sessions
WHERE first_message_sent = TRUE;

SELECT COUNT(*) FROM unpaid_sessions_with_email
WHERE first_message_sent = TRUE;
```

## Métriques importantes à surveiller

1. **Taux Email** (Message → Email)
   - Objectif: > 50%
   - Indique l'engagement initial de l'utilisateur

2. **Taux Paiement** (Email → Paiement)
   - Objectif: > 30%
   - Indique la conversion après engagement

3. **Conversion Totale** (Message → Paiement)
   - Objectif: > 15-20%
   - Indique l'efficacité globale du tunnel

## Notes techniques

- Les compteurs sont incrémentés de manière atomique avec `ON CONFLICT DO UPDATE`
- Le flag `first_message_sent` évite de compter plusieurs fois le même utilisateur
- Les statistiques sont calculées par jour avec `CURRENT_DATE`
- Les taux de conversion sont calculés en temps réel dans les requêtes SQL

## Dépannage

### Les statistiques ne s'affichent pas
1. Vérifiez que la table `session_statistics` existe
2. Vérifiez que `ADMIN_PASSWORD` est défini dans les variables d'environnement
3. Vérifiez les logs pour voir si les incréments fonctionnent

### Les compteurs semblent incorrects
1. Vérifiez que le champ `first_message_sent` est bien à FALSE par défaut
2. Vérifiez que les fonctions `mark*FirstMessage()` sont appelées
3. Consultez les logs pour voir les appels à `incrementFirstMessage()`
