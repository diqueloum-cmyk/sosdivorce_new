// API pour gérer le mode maintenance
// GET: Récupérer l'état actuel
// POST: Modifier l'état (avec authentification admin)

import { sql } from '@vercel/postgres';
import { setCorsHeaders, handleCorsPreflight } from '../lib/utils.js';
import logger from '../lib/logger.js';

// Créer la table de configuration si elle n'existe pas
async function ensureConfigTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS site_config (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

// Récupérer l'état de maintenance
async function getMaintenanceStatus() {
  try {
    await ensureConfigTable();
    const result = await sql`
      SELECT value FROM site_config WHERE key = 'maintenance_enabled'
    `;
    if (result.rows.length === 0) {
      // Par défaut, maintenance activée (pour les tests initiaux)
      return true;
    }
    return result.rows[0].value === 'true';
  } catch (error) {
    logger.error('Erreur récupération état maintenance:', error);
    // En cas d'erreur, activer la maintenance par sécurité
    return true;
  }
}

// Définir l'état de maintenance
async function setMaintenanceStatus(enabled) {
  try {
    await ensureConfigTable();
    await sql`
      INSERT INTO site_config (key, value, updated_at)
      VALUES ('maintenance_enabled', ${enabled ? 'true' : 'false'}, CURRENT_TIMESTAMP)
      ON CONFLICT (key)
      DO UPDATE SET value = ${enabled ? 'true' : 'false'}, updated_at = CURRENT_TIMESTAMP
    `;
    logger.info('État maintenance modifié:', { enabled });
    return true;
  } catch (error) {
    logger.error('Erreur modification état maintenance:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // Configurer CORS
  setCorsHeaders(res, req);

  // Gérer preflight CORS
  if (handleCorsPreflight(req, res)) {
    return;
  }

  // GET: Récupérer l'état de maintenance
  if (req.method === 'GET') {
    try {
      const enabled = await getMaintenanceStatus();
      return res.status(200).json({
        success: true,
        maintenanceEnabled: enabled
      });
    } catch (error) {
      logger.error('Erreur GET maintenance:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération de l\'état'
      });
    }
  }

  // POST: Modifier l'état de maintenance (protégé)
  if (req.method === 'POST') {
    try {
      // Vérifier l'authentification admin
      const adminKey = req.headers['x-admin-key'];
      const expectedKey = process.env.ADMIN_KEY || 'sosdivorce-admin-2024';

      if (adminKey !== expectedKey) {
        logger.security('Tentative non autorisée de modification maintenance:', {
          providedKey: adminKey ? 'présent' : 'absent'
        });
        return res.status(401).json({
          success: false,
          error: 'Non autorisé'
        });
      }

      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Le paramètre "enabled" (boolean) est requis'
        });
      }

      await setMaintenanceStatus(enabled);

      return res.status(200).json({
        success: true,
        maintenanceEnabled: enabled,
        message: enabled ? 'Mode maintenance activé' : 'Mode maintenance désactivé'
      });

    } catch (error) {
      logger.error('Erreur POST maintenance:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la modification de l\'état'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
