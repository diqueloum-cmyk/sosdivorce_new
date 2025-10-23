// Endpoint pour afficher les statistiques du cache
// URL: https://votre-site.vercel.app/api/cache-stats

import { getCacheStats, cleanExpiredCache } from '../lib/db.js';
import logger from '../lib/logger.js';

export default async function handler(req, res) {
  // Sécurité : STATS_KEY ou ADMIN_KEY obligatoire en production
  // Récupérer la clé depuis le header (plus sécurisé que query string)
  const statsKey = req.headers['x-stats-key'] || req.headers['x-admin-key'];
  const expectedKey = process.env.STATS_KEY || process.env.ADMIN_KEY;

  // Refuser si aucune clé n'est configurée (sécurité production)
  if (!expectedKey) {
    logger.error('STATS_KEY et ADMIN_KEY non configurées dans les variables d\'environnement');
    return res.status(500).json({
      error: 'Configuration manquante',
      message: 'STATS_KEY ou ADMIN_KEY doit être définie dans les variables d\'environnement.',
      help: 'Configurez STATS_KEY ou ADMIN_KEY dans les paramètres Vercel > Environment Variables'
    });
  }

  if (statsKey !== expectedKey) {
    logger.security('Tentative d\'accès cache-stats avec clé invalide');
    return res.status(403).json({
      error: 'Accès refusé. Clé de stats requise.',
      info: 'Envoyez la clé dans le header X-Stats-Key ou X-Admin-Key'
    });
  }

  try {
    // Si demandé, nettoyer d'abord le cache expiré
    let cleaned = 0;
    if (req.query.clean === 'true') {
      cleaned = await cleanExpiredCache();
    }

    // Récupérer les stats
    const stats = await getCacheStats();

    // Calculer le taux de hit (économies)
    const apiCostPerRequest = 0.002; // Exemple: $0.002 par requête OpenAI
    const savedRequests = stats.totalHits - stats.totalEntries;
    const moneySaved = savedRequests * apiCostPerRequest;

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      cache: {
        totalEntries: stats.totalEntries,
        activeEntries: stats.activeEntries,
        expiredEntries: stats.totalEntries - stats.activeEntries,
        totalHits: stats.totalHits,
        avgHitsPerEntry: Math.round(stats.avgHits * 100) / 100,
        maxHits: stats.maxHits
      },
      performance: {
        totalApiRequests: stats.totalEntries,
        requestsServedFromCache: savedRequests,
        requestsSaved: savedRequests,
        cacheHitRate: stats.totalHits > 0
          ? Math.round((savedRequests / stats.totalHits) * 100) + '%'
          : '0%'
      },
      savings: {
        apiCallsSaved: savedRequests,
        estimatedMoneySaved: '$' + moneySaved.toFixed(4),
        averageCostPerRequest: '$' + apiCostPerRequest
      },
      maintenance: {
        lastClean: req.query.clean === 'true' ? 'Maintenant' : 'Non demandé',
        entriesCleaned: cleaned,
        cleanUrl: req.url.split('?')[0] + '?key=' + statsKey + '&clean=true'
      },
      info: {
        cacheExpiration: '30 jours',
        hashAlgorithm: 'SHA-256',
        normalization: 'Minuscules + trim + espaces'
      }
    });

  } catch (error) {
    logger.error('Erreur cache-stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des stats',
      message: error.message
    });
  }
}
