import { setCorsHeaders, handleCorsPreflight } from '../lib/utils.js';
import {
  getAllPaidSessions,
  getPaidSessionMessages,
  getPaymentStats
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
    logger.security('Tentative d\'accès admin non autorisé');
    return res.status(401).json({ error: 'Accès non autorisé' });
  }

  try {
    const { action, sessionId, limit = 50, offset = 0, paidOnly = false } =
      req.method === 'GET' ? req.query : req.body;

    switch (action || 'list') {
      case 'list':
        // Lister toutes les sessions payantes
        const sessions = await getAllPaidSessions(
          parseInt(limit),
          parseInt(offset),
          paidOnly === 'true' || paidOnly === true
        );

        return res.status(200).json({
          success: true,
          sessions,
          count: sessions.length
        });

      case 'messages':
        // Récupérer les messages d'une session
        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId requis' });
        }

        const messages = await getPaidSessionMessages(parseInt(sessionId));

        return res.status(200).json({
          success: true,
          messages,
          count: messages.length
        });

      case 'stats':
        // Statistiques des paiements
        const stats = await getPaymentStats();

        return res.status(200).json({
          success: true,
          stats
        });

      case 'export':
        // Export CSV des sessions payées
        const allSessions = await getAllPaidSessions(1000, 0, true);

        // Créer le CSV
        const csvHeaders = ['ID', 'Email', 'Formule', 'Montant', 'Date Paiement', 'Messages'];
        const csvRows = allSessions.map(s => [
          s.id,
          s.email || 'N/A',
          s.expertise || 'N/A',
          s.amount ? (s.amount / 100) + '€' : 'N/A',
          s.paidAt ? new Date(s.paidAt).toLocaleString('fr-FR') : 'Non payé',
          s.messageCount || 0
        ].join(';'));

        const csvContent = [csvHeaders.join(';'), ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=paiements_sosdivorce.csv');
        return res.status(200).send('\uFEFF' + csvContent); // BOM pour Excel

      default:
        return res.status(400).json({ error: 'Action non reconnue' });
    }

  } catch (error) {
    logger.error('Admin Payments API Error:', error);
    return res.status(500).json({
      error: 'Erreur lors de la récupération des données'
    });
  }
}
