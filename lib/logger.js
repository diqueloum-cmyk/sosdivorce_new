/**
 * Module de logging avec niveaux conditionnels basés sur l'environnement
 *
 * En PRODUCTION (NODE_ENV=production):
 * - debug() : silencieux
 * - info() : silencieux
 * - warn() : affiché
 * - error() : affiché
 *
 * En DÉVELOPPEMENT (NODE_ENV=development ou absent):
 * - Tous les niveaux sont affichés
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Logger de debug - Uniquement en développement
 * Utilisé pour tracer le flux d'exécution et les valeurs intermédiaires
 * @param {...any} args - Arguments à logger
 */
export function debug(...args) {
  if (isDevelopment) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Logger d'information - Uniquement en développement
 * Utilisé pour les événements importants (inscriptions, connexions, cache hits)
 * @param {...any} args - Arguments à logger
 */
export function info(...args) {
  if (isDevelopment) {
    console.log('[INFO]', ...args);
  }
}

/**
 * Logger de warning - Toujours affiché
 * Utilisé pour les situations anormales mais non-bloquantes
 * @param {...any} args - Arguments à logger
 */
export function warn(...args) {
  console.warn('[WARN]', ...args);
}

/**
 * Logger d'erreur - Toujours affiché
 * Utilisé pour les erreurs qui nécessitent une attention
 * @param {...any} args - Arguments à logger
 */
export function error(...args) {
  console.error('[ERROR]', ...args);
}

/**
 * Logger d'événement de sécurité - Toujours affiché
 * Utilisé pour tracer les tentatives d'accès non autorisées, rate limiting, etc.
 * @param {...any} args - Arguments à logger
 */
export function security(...args) {
  console.warn('[SECURITY]', ...args);
}

/**
 * Helper pour logger des données sensibles uniquement en dev
 * Utile pour logger des PII (nom, email) ou des tokens
 * @param {string} message - Message à afficher
 * @param {object} sensitiveData - Données sensibles (email, nom, etc.)
 */
export function logSensitive(message, sensitiveData) {
  if (isDevelopment) {
    console.log(`[DEBUG] ${message}`, sensitiveData);
  } else {
    // En production, logger seulement un message générique sans les données
    console.log(`[INFO] ${message}`);
  }
}

// Export d'un objet logger par défaut pour faciliter l'usage
export default {
  debug,
  info,
  warn,
  error,
  security,
  logSensitive
};
