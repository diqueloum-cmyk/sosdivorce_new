import { sql } from '@vercel/postgres';
import logger from '../lib/logger.js';

/**
 * Script de migration pour ajouter le tracking des premiers messages
 * Ajoute la colonne first_message_sent aux tables paid_sessions et unpaid_sessions_with_email
 */
export default async function handler(req, res) {
  try {
    // Ajouter la colonne first_message_sent à paid_sessions
    await sql`
      ALTER TABLE paid_sessions
      ADD COLUMN IF NOT EXISTS first_message_sent BOOLEAN DEFAULT FALSE
    `;
    logger.info('Colonne first_message_sent ajoutée à paid_sessions');

    // Ajouter la colonne first_message_sent à unpaid_sessions_with_email
    await sql`
      ALTER TABLE unpaid_sessions_with_email
      ADD COLUMN IF NOT EXISTS first_message_sent BOOLEAN DEFAULT FALSE
    `;
    logger.info('Colonne first_message_sent ajoutée à unpaid_sessions_with_email');

    // Mettre à jour les sessions existantes qui ont déjà des messages
    await sql`
      UPDATE paid_sessions ps
      SET first_message_sent = TRUE
      WHERE EXISTS (
        SELECT 1 FROM paid_messages pm
        WHERE pm.session_id = ps.id
        AND pm.role = 'user'
      )
      AND first_message_sent = FALSE
    `;
    logger.info('Sessions payantes existantes mises à jour');

    await sql`
      UPDATE unpaid_sessions_with_email us
      SET first_message_sent = TRUE
      WHERE EXISTS (
        SELECT 1 FROM unpaid_messages um
        WHERE um.session_id = us.id
        AND um.role = 'user'
      )
      AND first_message_sent = FALSE
    `;
    logger.info('Sessions non payées existantes mises à jour');

    return res.status(200).json({
      success: true,
      message: 'Migration first_message_sent effectuée avec succès'
    });

  } catch (error) {
    logger.error('Erreur migration first_message_sent:', error);
    return res.status(500).json({
      error: 'Erreur lors de la migration',
      details: error.message
    });
  }
}
