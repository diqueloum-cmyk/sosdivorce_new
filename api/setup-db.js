// Endpoint pour initialiser la base de données
// À exécuter UNE SEULE FOIS après avoir configuré Vercel Postgres
// URL: https://votre-site.vercel.app/api/setup-db

import { createUsersTable, createCacheTable } from '../lib/db.js';
import logger from '../lib/logger.js';

export default async function handler(req, res) {
  // Sécurité : SETUP_KEY OBLIGATOIRE en production
  // Récupérer la clé depuis le header (plus sécurisé que query string)
  const setupKey = req.headers['x-setup-key'];
  const expectedKey = process.env.SETUP_KEY;

  // Refuser si SETUP_KEY n'est pas configurée (sécurité production)
  if (!expectedKey) {
    logger.error('SETUP_KEY non configurée dans les variables d\'environnement');
    return res.status(500).json({
      error: 'Configuration manquante',
      message: 'SETUP_KEY doit être définie dans les variables d\'environnement.',
      help: 'Configurez SETUP_KEY dans les paramètres Vercel > Environment Variables'
    });
  }

  if (setupKey !== expectedKey) {
    logger.security('Tentative d\'accès setup-db avec clé invalide');
    return res.status(403).json({
      error: 'Accès refusé. Clé de setup requise.',
      info: 'Envoyez la clé dans le header X-Setup-Key'
    });
  }

  try {
    logger.info('Initialisation de la base de données...');

    // Créer la table users
    const usersResult = await createUsersTable();
    logger.info('Table users créée');

    // Créer la table de cache
    const cacheResult = await createCacheTable();
    logger.info('Table chat_cache créée');

    logger.info('Base de données initialisée avec succès');

    return res.status(200).json({
      success: true,
      message: 'Base de données initialisée avec succès',
      details: {
        users: usersResult,
        cache: cacheResult
      },
      timestamp: new Date().toISOString(),
      info: {
        tables: {
          users: {
            columns: [
              'id (SERIAL PRIMARY KEY)',
              'first_name (VARCHAR 100)',
              'last_name (VARCHAR 100)',
              'email (VARCHAR 255 UNIQUE)',
              'password_hash (VARCHAR 255)',
              'registered_at (TIMESTAMP)',
              'subscription_status (VARCHAR 50)',
              'questions_used (INTEGER)',
              'last_question_at (TIMESTAMP)',
              'created_at (TIMESTAMP)',
              'updated_at (TIMESTAMP)'
            ],
            indexes: [
              'idx_email',
              'idx_registered_at',
              'idx_subscription'
            ]
          },
          chat_cache: {
            columns: [
              'id (SERIAL PRIMARY KEY)',
              'question_hash (VARCHAR 64 UNIQUE)',
              'question_text (TEXT)',
              'answer_text (TEXT)',
              'hit_count (INTEGER)',
              'created_at (TIMESTAMP)',
              'last_accessed_at (TIMESTAMP)',
              'expires_at (TIMESTAMP - 30 days)'
            ],
            indexes: [
              'idx_question_hash',
              'idx_expires_at',
              'idx_hit_count'
            ]
          }
        }
      }
    });

  } catch (error) {
    logger.error('Erreur lors de l\'initialisation:', error);

    return res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'initialisation de la base de données',
      message: error.message,
      timestamp: new Date().toISOString(),
      help: [
        '1. Vérifiez que Vercel Postgres est configuré',
        '2. Vérifiez que les variables d\'environnement sont définies',
        '3. Consultez les logs Vercel pour plus de détails'
      ]
    });
  }
}
