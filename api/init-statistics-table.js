import { createSessionStatisticsTable } from '../lib/db.js';
import logger from '../lib/logger.js';

/**
 * Endpoint pour initialiser uniquement la table session_statistics
 * GET /api/init-statistics-table
 */
export default async function handler(req, res) {
  // Sécurité : SETUP_KEY OBLIGATOIRE
  const setupKey = req.headers['x-setup-key'];
  const expectedKey = process.env.SETUP_KEY;

  if (!expectedKey) {
    logger.error('SETUP_KEY non configurée');
    return res.status(500).json({
      error: 'Configuration manquante',
      message: 'SETUP_KEY doit être définie dans les variables d\'environnement.'
    });
  }

  if (setupKey !== expectedKey) {
    logger.security('Tentative d\'accès init-statistics-table avec clé invalide');
    return res.status(403).json({
      error: 'Accès refusé. Clé de setup requise.',
      info: 'Envoyez la clé dans le header X-Setup-Key'
    });
  }

  try {
    logger.info('Initialisation de la table session_statistics...');

    const result = await createSessionStatisticsTable();

    logger.info('Table session_statistics créée avec succès');

    return res.status(200).json({
      success: true,
      message: 'Table session_statistics créée avec succès',
      details: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erreur lors de la création de la table:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la table',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
