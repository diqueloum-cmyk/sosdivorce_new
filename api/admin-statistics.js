import { setCorsHeaders, handleCorsPreflight } from '../lib/utils.js';
import { getSessionStatistics, getGlobalStatistics } from '../lib/db.js';
import logger from '../lib/logger.js';

/**
 * Endpoint admin pour récupérer les statistiques de conversion
 * GET /api/admin-statistics?days=30
 */
export default async function handler(req, res) {
  // Configurer CORS
  setCorsHeaders(res, req);

  // Gérer preflight CORS
  if (handleCorsPreflight(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vérifier l'authentification admin (à personnaliser selon votre système)
    const adminPassword = req.headers['x-admin-password'];
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      logger.security('Tentative accès admin-statistics non autorisée');
      return res.status(401).json({ error: 'Non autorisé' });
    }

    // Récupérer le nombre de jours depuis la query string (par défaut 30)
    const days = parseInt(req.query.days) || 30;

    // Récupérer les statistiques globales
    const globalStats = await getGlobalStatistics();

    // Récupérer les statistiques journalières
    const dailyStats = await getSessionStatistics(days);

    // Calculer les statistiques des 7 derniers jours
    const last7Days = dailyStats.slice(0, 7);
    const last7DaysStats = {
      first_messages: last7Days.reduce((sum, day) => sum + (day.first_messages_count || 0), 0),
      emails_collected: last7Days.reduce((sum, day) => sum + (day.emails_collected_count || 0), 0),
      payments_completed: last7Days.reduce((sum, day) => sum + (day.payments_completed_count || 0), 0),
    };

    // Calculer les taux de conversion des 7 derniers jours
    last7DaysStats.email_conversion_rate = last7DaysStats.first_messages > 0
      ? ((last7DaysStats.emails_collected / last7DaysStats.first_messages) * 100).toFixed(2)
      : 0;

    last7DaysStats.payment_conversion_rate = last7DaysStats.emails_collected > 0
      ? ((last7DaysStats.payments_completed / last7DaysStats.emails_collected) * 100).toFixed(2)
      : 0;

    last7DaysStats.total_conversion_rate = last7DaysStats.first_messages > 0
      ? ((last7DaysStats.payments_completed / last7DaysStats.first_messages) * 100).toFixed(2)
      : 0;

    logger.info('Statistiques récupérées:', { days, dailyStatsCount: dailyStats.length });

    return res.status(200).json({
      success: true,
      global: {
        total_first_messages: parseInt(globalStats.total_first_messages) || 0,
        total_emails_collected: parseInt(globalStats.total_emails_collected) || 0,
        total_payments_completed: parseInt(globalStats.total_payments_completed) || 0,
        email_conversion_rate: parseFloat(globalStats.email_conversion_rate) || 0,
        payment_conversion_rate: parseFloat(globalStats.payment_conversion_rate) || 0,
        total_conversion_rate: parseFloat(globalStats.total_conversion_rate) || 0
      },
      last7Days: last7DaysStats,
      daily: dailyStats.map(stat => ({
        date: stat.stat_date,
        first_messages: stat.first_messages_count || 0,
        emails_collected: stat.emails_collected_count || 0,
        payments_completed: stat.payments_completed_count || 0,
        email_conversion_rate: parseFloat(stat.email_conversion_rate) || 0,
        payment_conversion_rate: parseFloat(stat.payment_conversion_rate) || 0,
        total_conversion_rate: parseFloat(stat.total_conversion_rate) || 0
      }))
    });

  } catch (error) {
    logger.error('Erreur récupération statistiques:', error);
    return res.status(500).json({
      error: 'Erreur lors de la récupération des statistiques',
      details: error.message
    });
  }
}
