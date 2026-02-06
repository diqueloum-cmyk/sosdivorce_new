import { setCorsHeaders, handleCorsPreflight } from '../lib/utils.js';
import {
  getAllUnpaidSessions,
  getUnpaidSession,
  getUnpaidSessionMessages,
  getUnpaidSessionStats
} from '../lib/db.js';
import logger from '../lib/logger.js';

export default async function handler(req, res) {
  // Configurer CORS
  setCorsHeaders(res, req);

  // Gérer preflight CORS
  if (handleCorsPreflight(req, res)) {
    return;
  }

  // Vérifier l'authentification admin
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    logger.security('Tentative d\'accès admin unpaid sessions non autorisé');
    return res.status(401).json({ error: 'Accès non autorisé' });
  }

  try {
    const { action, sessionId, limit = 50, offset = 0 } =
      req.method === 'GET' ? req.query : req.body;

    switch (action || 'list') {
      case 'list':
        // Lister toutes les sessions unpaid
        const sessions = await getAllUnpaidSessions(
          parseInt(limit),
          parseInt(offset)
        );

        // Compter le nombre total pour la pagination
        const total = sessions.length;
        const page = Math.floor(parseInt(offset) / parseInt(limit)) + 1;
        const totalPages = Math.ceil(total / parseInt(limit));

        return res.status(200).json({
          success: true,
          sessions,
          pagination: {
            page,
            totalPages,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
          }
        });

      case 'messages':
        // Récupérer les messages d'une session unpaid
        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId requis' });
        }

        const session = await getUnpaidSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: 'Session non trouvée' });
        }

        const messages = await getUnpaidSessionMessages(session.id);

        return res.status(200).json({
          success: true,
          session: {
            id: session.id,
            session_uuid: session.session_uuid,
            email: session.email,
            expertise: session.expertise,
            amount: session.amount,
            payment_intent_id: session.payment_intent_id,
            thread_id: session.thread_id,
            created_at: session.created_at,
            email_collected_at: session.email_collected_at,
            payment_attempts: session.payment_attempts
          },
          messages,
          count: messages.length
        });

      case 'stats':
        // Statistiques des sessions unpaid
        const stats = await getUnpaidSessionStats();

        return res.status(200).json({
          success: true,
          stats
        });

      case 'export':
        // Export CSV des sessions unpaid
        const allSessions = await getAllUnpaidSessions(1000, 0);

        // Créer le CSV
        const csvHeaders = ['ID', 'Email', 'Expertise', 'Montant', 'Date collecte email', 'Messages', 'Tentatives paiement'];
        const csvRows = allSessions.map(s => [
          s.id,
          s.email || 'N/A',
          s.expertise || 'Non sélectionné',
          s.amount ? (s.amount / 100) + '€' : '0€',
          s.email_collected_at ? new Date(s.email_collected_at).toLocaleString('fr-FR') : 'N/A',
          s.messageCount || 0,
          s.payment_attempts || 0
        ].join(';'));

        const csvContent = [csvHeaders.join(';'), ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=sessions_non_payees.csv');
        return res.status(200).send('\uFEFF' + csvContent); // BOM pour Excel

      default:
        return res.status(400).json({ error: 'Action non reconnue' });
    }

  } catch (error) {
    logger.error('Admin Unpaid Sessions API Error:', error);
    return res.status(500).json({
      error: 'Erreur lors de la récupération des données'
    });
  }
}
