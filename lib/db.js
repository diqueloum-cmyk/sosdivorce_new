// Base de données PostgreSQL via Vercel Postgres
// Remplace l'ancien système en mémoire par une vraie base de données persistante

import { sql } from '@vercel/postgres';
import bcrypt from 'bcrypt';
import logger from './logger.js';

const SALT_ROUNDS = 10;

/**
 * Créer la table users si elle n'existe pas
 * À exécuter une seule fois via /api/setup-db
 */
export async function createUsersTable() {
  try {
    // Créer la table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        subscription_status VARCHAR(50) DEFAULT 'free',
        questions_used INTEGER DEFAULT 0,
        last_question_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Créer les index séparément
    await sql`CREATE INDEX IF NOT EXISTS idx_email ON users(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_registered_at ON users(registered_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscription ON users(subscription_status)`;

    return { success: true, message: 'Table users créée avec succès' };
  } catch (error) {
    logger.error('Erreur création table:', error);
    throw error;
  }
}

/**
 * Créer la table de cache pour les réponses du chatbot
 * À exécuter une seule fois via /api/setup-db
 */
export async function createCacheTable() {
  try {
    // Créer la table
    await sql`
      CREATE TABLE IF NOT EXISTS chat_cache (
        id SERIAL PRIMARY KEY,
        question_hash VARCHAR(64) UNIQUE NOT NULL,
        question_text TEXT NOT NULL,
        answer_text TEXT NOT NULL,
        hit_count INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
      )
    `;

    // Créer les index séparément
    await sql`CREATE INDEX IF NOT EXISTS idx_question_hash ON chat_cache(question_hash)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_expires_at ON chat_cache(expires_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_hit_count ON chat_cache(hit_count)`;

    return { success: true, message: 'Table chat_cache créée avec succès' };
  } catch (error) {
    logger.error('Erreur création table cache:', error);
    throw error;
  }
}

/**
 * Ajouter un nouvel utilisateur
 * @param {Object} userData - Données de l'utilisateur
 * @param {string} userData.firstName - Prénom
 * @param {string} userData.lastName - Nom
 * @param {string} userData.email - Email
 * @param {string} [userData.password] - Mot de passe (optionnel pour l'instant)
 * @returns {Object} Utilisateur créé
 */
export async function addUser(userData) {
  try {
    const { firstName, lastName, email, password } = userData;

    // Validation basique
    if (!firstName || !lastName || !email) {
      throw new Error('Tous les champs sont obligatoires');
    }

    // Vérifier si l'utilisateur existe déjà
    const existing = await findUserByEmail(email);
    if (existing) {
      throw new Error('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe si fourni
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    // Insérer l'utilisateur
    const result = await sql`
      INSERT INTO users (first_name, last_name, email, password_hash)
      VALUES (${firstName}, ${lastName}, ${email}, ${passwordHash})
      RETURNING id, first_name, last_name, email, registered_at, subscription_status
    `;

    const user = result.rows[0];

    logger.logSensitive('Utilisateur ajouté en DB', {
      id: user.id,
      email: user.email,
      timestamp: new Date().toISOString()
    });

    // Mapper les champs snake_case vers camelCase pour compatibilité avec l'API
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      registeredAt: user.registered_at,
      subscriptionStatus: user.subscription_status
    };

  } catch (error) {
    logger.error('Erreur addUser:', error);
    throw error;
  }
}

/**
 * Trouver un utilisateur par email
 * @param {string} email - Email de l'utilisateur
 * @returns {Object|null} Utilisateur trouvé ou null
 */
export async function findUserByEmail(email) {
  try {
    const result = await sql`
      SELECT * FROM users
      WHERE email = ${email}
      LIMIT 1
    `;

    const user = result.rows[0];

    if (!user) return null;

    // Mapper les champs snake_case vers camelCase pour compatibilité avec l'API
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      passwordHash: user.password_hash,
      registeredAt: user.registered_at,
      subscriptionStatus: user.subscription_status,
      questionsUsed: user.questions_used
    };

  } catch (error) {
    logger.error('Erreur findUserByEmail:', error);
    throw error;
  }
}

/**
 * Vérifier le mot de passe d'un utilisateur
 * @param {string} email - Email
 * @param {string} password - Mot de passe à vérifier
 * @returns {Object|null} Utilisateur si mot de passe correct, null sinon
 */
export async function verifyUserPassword(email, password) {
  try {
    const user = await findUserByEmail(email);

    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return null;
    }

    // Ne pas retourner le hash
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;

  } catch (error) {
    logger.error('Erreur verifyUserPassword:', error);
    throw error;
  }
}

/**
 * Récupérer tous les utilisateurs avec pagination
 * @param {number} limit - Nombre d'utilisateurs par page (défaut: 50)
 * @param {number} offset - Offset pour la pagination (défaut: 0)
 * @returns {Array} Liste des utilisateurs
 */
export async function getAllUsers(limit = 50, offset = 0) {
  try {
    const result = await sql`
      SELECT id, first_name, last_name, email, registered_at, subscription_status, questions_used
      FROM users
      ORDER BY registered_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Mapper les champs snake_case vers camelCase pour compatibilité avec l'API
    return result.rows.map(user => ({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      registeredAt: user.registered_at,
      subscriptionStatus: user.subscription_status,
      questionsUsed: user.questions_used
    }));

  } catch (error) {
    logger.error('Erreur getAllUsers:', error);
    throw error;
  }
}

/**
 * Compter le nombre total d'utilisateurs
 * @returns {number} Nombre total d'utilisateurs
 */
export async function getUserCount() {
  try {
    const result = await sql`
      SELECT COUNT(*) as count FROM users
    `;

    return parseInt(result.rows[0].count);

  } catch (error) {
    logger.error('Erreur getUserCount:', error);
    throw error;
  }
}

/**
 * Obtenir les statistiques des utilisateurs
 * @returns {Object} Statistiques
 */
export async function getStats() {
  try {
    const result = await sql`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN DATE(registered_at) = CURRENT_DATE THEN 1 END) as today_users,
        COUNT(CASE WHEN subscription_status = 'premium' THEN 1 END) as premium_users,
        COUNT(CASE WHEN subscription_status = 'free' THEN 1 END) as free_users
      FROM users
    `;

    const stats = result.rows[0];

    // Récupérer le dernier utilisateur inscrit
    const lastUserResult = await sql`
      SELECT id, first_name, last_name, email, registered_at
      FROM users
      ORDER BY registered_at DESC
      LIMIT 1
    `;

    const lastUser = lastUserResult.rows[0];

    return {
      totalUsers: parseInt(stats.total_users),
      todayUsers: parseInt(stats.today_users),
      premiumUsers: parseInt(stats.premium_users),
      freeUsers: parseInt(stats.free_users),
      lastUser: lastUser ? {
        id: lastUser.id,
        firstName: lastUser.first_name,
        lastName: lastUser.last_name,
        email: lastUser.email,
        registeredAt: lastUser.registered_at
      } : null
    };

  } catch (error) {
    logger.error('Erreur getStats:', error);
    throw error;
  }
}

/**
 * Mettre à jour le statut d'abonnement d'un utilisateur
 * @param {string} email - Email de l'utilisateur
 * @param {string} status - Nouveau statut ('free' ou 'premium')
 * @returns {Object} Utilisateur mis à jour
 */
export async function updateSubscriptionStatus(email, status) {
  try {
    const result = await sql`
      UPDATE users
      SET subscription_status = ${status}, updated_at = CURRENT_TIMESTAMP
      WHERE email = ${email}
      RETURNING id, first_name, last_name, email, subscription_status
    `;

    return result.rows[0];

  } catch (error) {
    logger.error('Erreur updateSubscriptionStatus:', error);
    throw error;
  }
}

/**
 * Incrémenter le compteur de questions d'un utilisateur
 * @param {string} email - Email de l'utilisateur
 * @returns {Object} Utilisateur mis à jour
 */
export async function incrementQuestionCount(email) {
  try {
    const result = await sql`
      UPDATE users
      SET
        questions_used = questions_used + 1,
        last_question_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = ${email}
      RETURNING id, email, questions_used, last_question_at
    `;

    return result.rows[0];

  } catch (error) {
    logger.error('Erreur incrementQuestionCount:', error);
    throw error;
  }
}

/**
 * Réinitialiser le compteur de questions (pour les utilisateurs free après 24h)
 * @param {string} email - Email de l'utilisateur
 * @returns {Object} Utilisateur mis à jour
 */
export async function resetQuestionCount(email) {
  try {
    const result = await sql`
      UPDATE users
      SET questions_used = 0, updated_at = CURRENT_TIMESTAMP
      WHERE email = ${email}
      RETURNING id, email, questions_used
    `;

    return result.rows[0];

  } catch (error) {
    logger.error('Erreur resetQuestionCount:', error);
    throw error;
  }
}

// ========================================
// FONCTIONS DE CACHE
// ========================================

/**
 * Générer un hash SHA-256 pour une question (pour le cache)
 * @param {string} question - Question à hasher
 * @returns {Promise<string>} Hash de la question
 */
async function hashQuestion(question) {
  // Normaliser la question (minuscules, trim, espaces multiples)
  const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ');

  // Créer un hash simple en base64 (compatible avec serverless)
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Récupérer une réponse depuis le cache
 * @param {string} question - Question de l'utilisateur
 * @returns {Promise<Object|null>} Réponse cachée ou null
 */
export async function getCachedAnswer(question) {
  try {
    const questionHash = await hashQuestion(question);

    const result = await sql`
      SELECT question_text, answer_text, hit_count, created_at
      FROM chat_cache
      WHERE question_hash = ${questionHash}
        AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return null;
    }

    // Mettre à jour les stats du cache
    await sql`
      UPDATE chat_cache
      SET hit_count = hit_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP
      WHERE question_hash = ${questionHash}
    `;

    logger.info('Cache HIT:', {
      question: question.substring(0, 50),
      hits: result.rows[0].hit_count + 1
    });

    return {
      answer: result.rows[0].answer_text,
      cached: true,
      hitCount: result.rows[0].hit_count + 1
    };

  } catch (error) {
    logger.error('Erreur getCachedAnswer:', error);
    // En cas d'erreur, on retourne null pour bypass le cache
    return null;
  }
}

/**
 * Sauvegarder une réponse dans le cache
 * @param {string} question - Question de l'utilisateur
 * @param {string} answer - Réponse de l'IA
 * @returns {Promise<void>}
 */
export async function saveCachedAnswer(question, answer) {
  try {
    const questionHash = await hashQuestion(question);

    await sql`
      INSERT INTO chat_cache (question_hash, question_text, answer_text)
      VALUES (${questionHash}, ${question}, ${answer})
      ON CONFLICT (question_hash)
      DO UPDATE SET
        answer_text = ${answer},
        hit_count = chat_cache.hit_count + 1,
        last_accessed_at = CURRENT_TIMESTAMP
    `;

    logger.info('Cache SAVE:', { question: question.substring(0, 50) });

  } catch (error) {
    logger.error('Erreur saveCachedAnswer:', error);
    // Ne pas bloquer si le cache échoue
  }
}

/**
 * Nettoyer les entrées expirées du cache
 * @returns {Promise<number>} Nombre d'entrées supprimées
 */
export async function cleanExpiredCache() {
  try {
    const result = await sql`
      DELETE FROM chat_cache
      WHERE expires_at < CURRENT_TIMESTAMP
      RETURNING id
    `;

    logger.info('Cache nettoyé:', result.rows.length, 'entrées supprimées');
    return result.rows.length;

  } catch (error) {
    logger.error('Erreur cleanExpiredCache:', error);
    throw error;
  }
}

/**
 * Obtenir les statistiques du cache
 * @returns {Promise<Object>} Statistiques du cache
 */
export async function getCacheStats() {
  try {
    const result = await sql`
      SELECT
        COUNT(*) as total_entries,
        SUM(hit_count) as total_hits,
        AVG(hit_count) as avg_hits,
        MAX(hit_count) as max_hits,
        COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_entries
      FROM chat_cache
    `;

    return {
      totalEntries: parseInt(result.rows[0].total_entries) || 0,
      totalHits: parseInt(result.rows[0].total_hits) || 0,
      avgHits: parseFloat(result.rows[0].avg_hits) || 0,
      maxHits: parseInt(result.rows[0].max_hits) || 0,
      activeEntries: parseInt(result.rows[0].active_entries) || 0
    };

  } catch (error) {
    logger.error('Erreur getCacheStats:', error);
    throw error;
  }
}

// ====================================
// GESTION DES CONVERSATIONS
// ====================================

/**
 * Créer les tables pour les conversations
 * À exécuter via /api/setup-db
 */
export async function createConversationTables() {
  try {
    // Table des sessions de conversation
    await sql`
      CREATE TABLE IF NOT EXISTS conversation_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) DEFAULT 'Nouvelle conversation',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0
      )
    `;

    // Table des messages individuels
    await sql`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tokens_used INTEGER DEFAULT 0,
        response_time_ms INTEGER,
        was_cached BOOLEAN DEFAULT FALSE
      )
    `;

    // Créer les index
    await sql`CREATE INDEX IF NOT EXISTS idx_session_user ON conversation_sessions(user_id, last_message_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_session ON conversation_messages(session_id, created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_role ON conversation_messages(session_id, role)`;

    logger.info('Tables de conversation créées avec succès');
    return { success: true, message: 'Tables conversation_sessions et conversation_messages créées' };

  } catch (error) {
    logger.error('Erreur création tables conversations:', error);
    throw error;
  }
}

/**
 * Migration : Ajouter le support des conversations anonymes
 * À exécuter via /api/setup-db ou endpoint dédié
 */
export async function migrateConversationTablesForAnonymous() {
  try {
    // Permettre user_id NULL
    await sql`
      ALTER TABLE conversation_sessions
      ALTER COLUMN user_id DROP NOT NULL
    `;

    // Ajouter colonnes pour utilisateurs anonymes
    await sql`
      ALTER TABLE conversation_sessions
      ADD COLUMN IF NOT EXISTS anonymous_identifier VARCHAR(255),
      ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
      ADD COLUMN IF NOT EXISTS user_agent TEXT,
      ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE
    `;

    // Créer les index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_anonymous_sessions
      ON conversation_sessions(is_anonymous, last_message_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_anonymous_identifier
      ON conversation_sessions(anonymous_identifier)
    `;

    // Mettre à jour les sessions existantes (toutes enregistrées)
    await sql`
      UPDATE conversation_sessions
      SET is_anonymous = FALSE
      WHERE is_anonymous IS NULL
    `;

    logger.info('Migration conversations anonymes réussie');
    return { success: true, message: 'Support anonymes ajouté' };

  } catch (error) {
    logger.error('Erreur migration anonymes:', error);
    throw error;
  }
}

/**
 * Créer une nouvelle session de conversation
 * @param {number} userId - ID de l'utilisateur
 * @param {string} firstQuestion - Première question pour générer le titre
 * @returns {Promise<number>} ID de la session créée
 */
export async function createConversationSession(userId, firstQuestion) {
  try {
    // Générer un titre depuis les 50 premiers caractères de la question
    const title = firstQuestion.substring(0, 50) + (firstQuestion.length > 50 ? '...' : '');

    const result = await sql`
      INSERT INTO conversation_sessions (user_id, title, message_count)
      VALUES (${userId}, ${title}, 0)
      RETURNING id
    `;

    const sessionId = result.rows[0].id;
    logger.debug('Nouvelle session créée:', { sessionId, userId, title });

    return sessionId;

  } catch (error) {
    logger.error('Erreur createConversationSession:', error);
    throw error;
  }
}

/**
 * Créer une session de conversation pour un utilisateur anonyme
 * @param {string} anonymousId - UUID unique du visiteur anonyme
 * @param {string} ipAddress - Adresse IP
 * @param {string} userAgent - User-Agent du navigateur
 * @param {string} firstQuestion - Première question pour le titre
 * @returns {Promise<number>} ID de la session créée
 */
export async function createAnonymousConversationSession(anonymousId, ipAddress, userAgent, firstQuestion) {
  try {
    const title = firstQuestion.substring(0, 50) + (firstQuestion.length > 50 ? '...' : '');

    const result = await sql`
      INSERT INTO conversation_sessions (
        user_id,
        anonymous_identifier,
        ip_address,
        user_agent,
        title,
        message_count,
        is_anonymous
      )
      VALUES (
        NULL,
        ${anonymousId},
        ${ipAddress},
        ${userAgent},
        ${title},
        0,
        TRUE
      )
      RETURNING id
    `;

    const sessionId = result.rows[0].id;
    logger.debug('Session anonyme créée:', { sessionId, anonymousId, ip: ipAddress });

    return sessionId;

  } catch (error) {
    logger.error('Erreur createAnonymousConversationSession:', error);
    throw error;
  }
}

/**
 * Ajouter un message à une session de conversation
 * @param {number} sessionId - ID de la session
 * @param {string} role - 'user' ou 'assistant'
 * @param {string} content - Contenu du message
 * @param {Object} metadata - Métadonnées optionnelles
 * @returns {Promise<number>} ID du message créé
 */
export async function addConversationMessage(sessionId, role, content, metadata = {}) {
  try {
    const { tokensUsed = 0, responseTimeMs = null, wasCached = false } = metadata;

    // Insérer le message
    const result = await sql`
      INSERT INTO conversation_messages (session_id, role, content, tokens_used, response_time_ms, was_cached)
      VALUES (${sessionId}, ${role}, ${content}, ${tokensUsed}, ${responseTimeMs}, ${wasCached})
      RETURNING id
    `;

    const messageId = result.rows[0].id;

    // Mettre à jour la session
    // N'incrémenter message_count que pour les messages utilisateur
    if (role === 'user') {
      await sql`
        UPDATE conversation_sessions
        SET last_message_at = CURRENT_TIMESTAMP,
            message_count = message_count + 1
        WHERE id = ${sessionId}
      `;
    } else {
      await sql`
        UPDATE conversation_sessions
        SET last_message_at = CURRENT_TIMESTAMP
        WHERE id = ${sessionId}
      `;
    }

    logger.debug('Message ajouté:', { messageId, sessionId, role });

    return messageId;

  } catch (error) {
    logger.error('Erreur addConversationMessage:', error);
    throw error;
  }
}

/**
 * Récupérer toutes les sessions d'un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {number} limit - Nombre maximum de sessions à retourner
 * @returns {Promise<Array>} Liste des sessions
 */
export async function getUserConversationSessions(userId, limit = 20) {
  try {
    const result = await sql`
      SELECT id, title, started_at, last_message_at, message_count
      FROM conversation_sessions
      WHERE user_id = ${userId}
      ORDER BY last_message_at DESC
      LIMIT ${limit}
    `;

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      startedAt: row.started_at,
      lastMessageAt: row.last_message_at,
      messageCount: row.message_count
    }));

  } catch (error) {
    logger.error('Erreur getUserConversationSessions:', error);
    throw error;
  }
}

/**
 * Récupérer les sessions de conversation anonymes avec pagination
 * @param {number} limit - Nombre max de sessions
 * @param {number} offset - Offset pour pagination
 * @param {string} dateFilter - Filtre optionnel (ex: '7 days', '30 days')
 * @returns {Promise<Array>} Liste des sessions anonymes
 */
export async function getAnonymousConversationSessions(limit = 50, offset = 0, dateFilter = null) {
  try {
    let query;

    if (dateFilter) {
      // Avec filtre de date
      query = sql`
        SELECT
          id,
          anonymous_identifier,
          ip_address,
          user_agent,
          title,
          started_at,
          last_message_at,
          message_count
        FROM conversation_sessions
        WHERE is_anonymous = TRUE
          AND started_at >= NOW() - INTERVAL '${sql.raw(dateFilter)}'
        ORDER BY last_message_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      // Sans filtre de date
      query = sql`
        SELECT
          id,
          anonymous_identifier,
          ip_address,
          user_agent,
          title,
          started_at,
          last_message_at,
          message_count
        FROM conversation_sessions
        WHERE is_anonymous = TRUE
        ORDER BY last_message_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    const result = await query;

    return result.rows.map(row => ({
      id: row.id,
      anonymousIdentifier: row.anonymous_identifier,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      title: row.title,
      startedAt: row.started_at,
      lastMessageAt: row.last_message_at,
      messageCount: row.message_count
    }));

  } catch (error) {
    logger.error('Erreur getAnonymousConversationSessions:', error);
    throw error;
  }
}

/**
 * Compter le nombre total de sessions anonymes
 * @param {string} dateFilter - Filtre optionnel
 * @returns {Promise<number>} Nombre total
 */
export async function countAnonymousConversationSessions(dateFilter = null) {
  try {
    let result;

    if (dateFilter) {
      result = await sql`
        SELECT COUNT(*) as count
        FROM conversation_sessions
        WHERE is_anonymous = TRUE
          AND started_at >= NOW() - INTERVAL '${sql.raw(dateFilter)}'
      `;
    } else {
      result = await sql`
        SELECT COUNT(*) as count
        FROM conversation_sessions
        WHERE is_anonymous = TRUE
      `;
    }

    return parseInt(result.rows[0].count);

  } catch (error) {
    logger.error('Erreur countAnonymousConversationSessions:', error);
    throw error;
  }
}

/**
 * Récupérer tous les messages d'une session
 * @param {number} sessionId - ID de la session
 * @param {number} userId - ID de l'utilisateur (NULL pour admin/anonymes)
 * @returns {Promise<Array>} Liste des messages
 */
export async function getSessionMessages(sessionId, userId = null) {
  try {
    // Vérifier que la session existe
    const sessionCheck = await sql`
      SELECT user_id, is_anonymous FROM conversation_sessions WHERE id = ${sessionId}
    `;

    if (sessionCheck.rows.length === 0) {
      throw new Error('Session non trouvée');
    }

    const session = sessionCheck.rows[0];

    // Si userId fourni, vérifier la propriété (sauf pour sessions anonymes vues par admin)
    if (userId !== null && !session.is_anonymous && session.user_id !== userId) {
      throw new Error('Accès non autorisé à cette session');
    }

    // Récupérer les messages
    const result = await sql`
      SELECT id, role, content, created_at, tokens_used, response_time_ms, was_cached
      FROM conversation_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `;

    return result.rows.map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
      tokensUsed: row.tokens_used,
      responseTimeMs: row.response_time_ms,
      wasCached: row.was_cached
    }));

  } catch (error) {
    logger.error('Erreur getSessionMessages:', error);
    throw error;
  }
}

/**
 * Supprimer une session de conversation
 * @param {number} sessionId - ID de la session
 * @param {number} userId - ID de l'utilisateur (pour vérification)
 * @returns {Promise<boolean>}
 */
export async function deleteConversationSession(sessionId, userId) {
  try {
    const result = await sql`
      DELETE FROM conversation_sessions
      WHERE id = ${sessionId} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.rows.length === 0) {
      throw new Error('Session non trouvée ou non autorisée');
    }

    logger.info('Session supprimée:', { sessionId, userId });
    return true;

  } catch (error) {
    logger.error('Erreur deleteConversationSession:', error);
    throw error;
  }
}

/**
 * Mettre à jour le titre d'une session
 * @param {number} sessionId - ID de la session
 * @param {number} userId - ID de l'utilisateur
 * @param {string} newTitle - Nouveau titre
 * @returns {Promise<boolean>}
 */
export async function updateSessionTitle(sessionId, userId, newTitle) {
  try {
    const result = await sql`
      UPDATE conversation_sessions
      SET title = ${newTitle}
      WHERE id = ${sessionId} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.rows.length === 0) {
      throw new Error('Session non trouvée ou non autorisée');
    }

    logger.debug('Titre de session mis à jour:', { sessionId, newTitle });
    return true;

  } catch (error) {
    logger.error('Erreur updateSessionTitle:', error);
    throw error;
  }
}

/**
 * Obtenir les statistiques de conversation d'un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<Object>} Statistiques
 */
export async function getUserConversationStats(userId) {
  try {
    const result = await sql`
      SELECT
        COUNT(DISTINCT cs.id) as total_sessions,
        COUNT(CASE WHEN cm.role = 'user' THEN 1 END) as total_messages,
        SUM(cm.tokens_used) as total_tokens,
        COUNT(CASE WHEN cm.was_cached THEN 1 END) as cached_responses
      FROM conversation_sessions cs
      LEFT JOIN conversation_messages cm ON cm.session_id = cs.id
      WHERE cs.user_id = ${userId}
    `;

    const row = result.rows[0];
    return {
      totalSessions: parseInt(row.total_sessions) || 0,
      totalMessages: parseInt(row.total_messages) || 0,
      totalTokens: parseInt(row.total_tokens) || 0,
      cachedResponses: parseInt(row.cached_responses) || 0
    };

  } catch (error) {
    logger.error('Erreur getUserConversationStats:', error);
    throw error;
  }
}

// ====================================
// GESTION DES SESSIONS PAYANTES
// ====================================

/**
 * Créer les tables pour les sessions payantes
 * À exécuter via /api/setup-db
 */
export async function createPaidSessionsTables() {
  try {
    // Table des sessions payantes
    await sql`
      CREATE TABLE IF NOT EXISTS paid_sessions (
        id SERIAL PRIMARY KEY,
        session_uuid VARCHAR(36) UNIQUE NOT NULL,
        email VARCHAR(255),
        expertise VARCHAR(20) CHECK (expertise IN ('classique', 'premium')),
        amount INTEGER DEFAULT 0,
        paid BOOLEAN DEFAULT FALSE,
        payment_intent_id VARCHAR(255),
        thread_id VARCHAR(255) NOT NULL,
        questionnaire_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP,
        email_sent BOOLEAN DEFAULT FALSE,
        email_sent_at TIMESTAMP
      )
    `;

    // Table des messages des sessions payantes
    await sql`
      CREATE TABLE IF NOT EXISTS paid_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES paid_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Créer les index
    await sql`CREATE INDEX IF NOT EXISTS idx_paid_sessions_uuid ON paid_sessions(session_uuid)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_paid_sessions_email ON paid_sessions(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_paid_sessions_payment_intent ON paid_sessions(payment_intent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_paid_sessions_paid ON paid_sessions(paid)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_paid_messages_session ON paid_messages(session_id)`;

    logger.info('Tables paid_sessions et paid_messages créées avec succès');
    return { success: true, message: 'Tables paid_sessions et paid_messages créées' };

  } catch (error) {
    logger.error('Erreur création tables paid_sessions:', error);
    throw error;
  }
}

/**
 * Créer une nouvelle session payante
 * @param {string} sessionUuid - UUID unique de la session
 * @param {string} threadId - ID du thread OpenAI
 * @returns {Promise<Object>} Session créée
 */
export async function createPaidSession(sessionUuid, threadId) {
  try {
    const result = await sql`
      INSERT INTO paid_sessions (session_uuid, thread_id)
      VALUES (${sessionUuid}, ${threadId})
      RETURNING id, session_uuid, thread_id, created_at
    `;

    const session = result.rows[0];
    logger.debug('Session payante créée:', { sessionUuid, threadId });

    return {
      id: session.id,
      sessionUuid: session.session_uuid,
      threadId: session.thread_id,
      createdAt: session.created_at
    };

  } catch (error) {
    logger.error('Erreur createPaidSession:', error);
    throw error;
  }
}

/**
 * Récupérer une session payante par son UUID
 * @param {string} sessionUuid - UUID de la session
 * @returns {Promise<Object|null>} Session ou null
 */
export async function getPaidSession(sessionUuid) {
  try {
    const result = await sql`
      SELECT *
      FROM paid_sessions
      WHERE session_uuid = ${sessionUuid}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];
    return {
      id: session.id,
      sessionUuid: session.session_uuid,
      email: session.email,
      expertise: session.expertise,
      amount: session.amount,
      paid: session.paid,
      paymentIntentId: session.payment_intent_id,
      threadId: session.thread_id,
      questionnaireData: session.questionnaire_data,
      createdAt: session.created_at,
      paidAt: session.paid_at,
      emailSent: session.email_sent,
      emailSentAt: session.email_sent_at
    };

  } catch (error) {
    logger.error('Erreur getPaidSession:', error);
    throw error;
  }
}

/**
 * Mettre à jour une session avant paiement (expertise, montant, paymentIntentId)
 * @param {string} sessionUuid - UUID de la session
 * @param {string} expertise - Type d'expertise (classique ou premium)
 * @param {number} amount - Montant en centimes
 * @param {string} paymentIntentId - ID du PaymentIntent Stripe
 * @returns {Promise<Object>} Session mise à jour
 */
export async function updatePaidSessionPayment(sessionUuid, expertise, amount, paymentIntentId) {
  try {
    const result = await sql`
      UPDATE paid_sessions
      SET expertise = ${expertise},
          amount = ${amount},
          payment_intent_id = ${paymentIntentId}
      WHERE session_uuid = ${sessionUuid}
      RETURNING id, session_uuid, expertise, amount, payment_intent_id
    `;

    if (result.rows.length === 0) {
      throw new Error('Session non trouvée');
    }

    logger.debug('Session payante mise à jour:', { sessionUuid, expertise, amount });
    return result.rows[0];

  } catch (error) {
    logger.error('Erreur updatePaidSessionPayment:', error);
    throw error;
  }
}

/**
 * Marquer une session comme payée
 * @param {string} sessionUuid - UUID de la session
 * @param {string} email - Email de l'utilisateur (collecté pendant le questionnaire)
 * @returns {Promise<Object>} Session mise à jour
 */
export async function markPaidSessionCompleted(sessionUuid, email = null) {
  try {
    const result = await sql`
      UPDATE paid_sessions
      SET paid = TRUE,
          paid_at = CURRENT_TIMESTAMP,
          email = COALESCE(${email}, email)
      WHERE session_uuid = ${sessionUuid}
      RETURNING id, session_uuid, email, expertise, amount, paid, paid_at
    `;

    if (result.rows.length === 0) {
      throw new Error('Session non trouvée');
    }

    logger.info('Paiement confirmé pour session:', { sessionUuid, email });

    // Incrémenter le compteur de paiements complétés
    await incrementPaymentCompleted();

    return result.rows[0];

  } catch (error) {
    logger.error('Erreur markPaidSessionCompleted:', error);
    throw error;
  }
}

/**
 * Mettre à jour l'email d'une session
 * @param {string} sessionUuid - UUID de la session
 * @param {string} email - Email collecté
 * @returns {Promise<Object>} Session mise à jour
 */
export async function updatePaidSessionEmail(sessionUuid, email) {
  try {
    const result = await sql`
      UPDATE paid_sessions
      SET email = ${email}
      WHERE session_uuid = ${sessionUuid}
      RETURNING id, session_uuid, email
    `;

    if (result.rows.length === 0) {
      throw new Error('Session non trouvée');
    }

    logger.debug('Email mis à jour pour session:', { sessionUuid, email });
    return result.rows[0];

  } catch (error) {
    logger.error('Erreur updatePaidSessionEmail:', error);
    throw error;
  }
}

/**
 * Marquer le premier message d'une session payante
 * @param {string} sessionUuid - UUID de la session
 * @returns {Promise<Object>} Session mise à jour
 */
export async function markPaidSessionFirstMessage(sessionUuid) {
  try {
    const result = await sql`
      UPDATE paid_sessions
      SET first_message_sent = TRUE
      WHERE session_uuid = ${sessionUuid}
        AND first_message_sent = FALSE
      RETURNING id, session_uuid, first_message_sent
    `;

    if (result.rows.length > 0) {
      logger.debug('Premier message marqué pour session payante:', { sessionUuid });
      // Incrémenter le compteur global
      await incrementFirstMessage();
    }

    return result.rows[0] || null;

  } catch (error) {
    logger.error('Erreur markPaidSessionFirstMessage:', error);
    throw error;
  }
}

/**
 * Ajouter un message à une session payante
 * @param {number} sessionId - ID de la session (pas UUID)
 * @param {string} role - 'user' ou 'assistant'
 * @param {string} content - Contenu du message
 * @returns {Promise<number>} ID du message créé
 */
export async function addPaidMessage(sessionId, role, content) {
  try {
    const result = await sql`
      INSERT INTO paid_messages (session_id, role, content)
      VALUES (${sessionId}, ${role}, ${content})
      RETURNING id
    `;

    logger.debug('Message payant ajouté:', { sessionId, role, messageId: result.rows[0].id });
    return result.rows[0].id;

  } catch (error) {
    logger.error('Erreur addPaidMessage:', error);
    throw error;
  }
}

/**
 * Récupérer tous les messages d'une session payante
 * @param {number} sessionId - ID de la session
 * @returns {Promise<Array>} Liste des messages
 */
export async function getPaidSessionMessages(sessionId) {
  try {
    const result = await sql`
      SELECT id, role, content, created_at
      FROM paid_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `;

    return result.rows.map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at
    }));

  } catch (error) {
    logger.error('Erreur getPaidSessionMessages:', error);
    throw error;
  }
}

/**
 * Récupérer toutes les sessions payantes (pour admin)
 * @param {number} limit - Nombre max de sessions
 * @param {number} offset - Offset pour pagination
 * @param {boolean} paidOnly - Si true, seulement les sessions payées
 * @returns {Promise<Array>} Liste des sessions
 */
export async function getAllPaidSessions(limit = 50, offset = 0, paidOnly = false) {
  try {
    let result;

    if (paidOnly) {
      result = await sql`
        SELECT ps.*,
               (SELECT COUNT(*) FROM paid_messages pm WHERE pm.session_id = ps.id) as message_count
        FROM paid_sessions ps
        WHERE ps.paid = TRUE
        ORDER BY ps.paid_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT ps.*,
               (SELECT COUNT(*) FROM paid_messages pm WHERE pm.session_id = ps.id) as message_count
        FROM paid_sessions ps
        ORDER BY ps.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return result.rows.map(row => ({
      id: row.id,
      sessionUuid: row.session_uuid,
      email: row.email,
      expertise: row.expertise,
      amount: row.amount,
      paid: row.paid,
      paymentIntentId: row.payment_intent_id,
      threadId: row.thread_id,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      emailSent: row.email_sent,
      messageCount: parseInt(row.message_count) || 0
    }));

  } catch (error) {
    logger.error('Erreur getAllPaidSessions:', error);
    throw error;
  }
}

/**
 * Obtenir les statistiques des paiements
 * @returns {Promise<Object>} Statistiques
 */
export async function getPaymentStats() {
  try {
    const result = await sql`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN paid = TRUE THEN 1 END) as paid_sessions,
        COUNT(CASE WHEN expertise = 'classique' AND paid = TRUE THEN 1 END) as classique_count,
        COUNT(CASE WHEN expertise = 'premium' AND paid = TRUE THEN 1 END) as premium_count,
        COALESCE(SUM(CASE WHEN paid = TRUE THEN amount END), 0) as total_revenue,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_sessions,
        COUNT(CASE WHEN DATE(paid_at) = CURRENT_DATE AND paid = TRUE THEN 1 END) as today_paid
      FROM paid_sessions
    `;

    const stats = result.rows[0];
    return {
      totalSessions: parseInt(stats.total_sessions) || 0,
      paidSessions: parseInt(stats.paid_sessions) || 0,
      classiqueCount: parseInt(stats.classique_count) || 0,
      premiumCount: parseInt(stats.premium_count) || 0,
      totalRevenue: parseInt(stats.total_revenue) || 0,
      totalRevenueEuros: (parseInt(stats.total_revenue) || 0) / 100,
      todaySessions: parseInt(stats.today_sessions) || 0,
      todayPaid: parseInt(stats.today_paid) || 0
    };

  } catch (error) {
    logger.error('Erreur getPaymentStats:', error);
    throw error;
  }
}

/**
 * Marquer l'email comme envoyé pour une session
 * @param {string} sessionUuid - UUID de la session
 * @returns {Promise<Object>} Session mise à jour
 */
export async function markEmailSent(sessionUuid) {
  try {
    const result = await sql`
      UPDATE paid_sessions
      SET email_sent = TRUE,
          email_sent_at = CURRENT_TIMESTAMP
      WHERE session_uuid = ${sessionUuid}
      RETURNING id, session_uuid, email_sent, email_sent_at
    `;

    if (result.rows.length === 0) {
      throw new Error('Session non trouvée');
    }

    logger.info('Email marqué comme envoyé pour session:', { sessionUuid });
    return result.rows[0];

  } catch (error) {
    logger.error('Erreur markEmailSent:', error);
    throw error;
  }
}

// ====================================
// UNPAID SESSIONS WITH EMAIL
// ====================================

/**
 * Créer la table unpaid_sessions_with_email
 * @returns {Promise<Object>} Résultat de la création
 */
export async function createUnpaidSessionsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS unpaid_sessions_with_email (
        id SERIAL PRIMARY KEY,
        session_uuid VARCHAR(36) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        expertise VARCHAR(20),
        amount INTEGER DEFAULT 0,
        payment_intent_id VARCHAR(255),
        thread_id VARCHAR(255) NOT NULL,
        questionnaire_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        email_collected_at TIMESTAMP,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_attempts INTEGER DEFAULT 0,
        last_payment_attempt_at TIMESTAMP,
        moved_to_paid BOOLEAN DEFAULT FALSE,
        moved_at TIMESTAMP
      )
    `;

    // Créer les index
    await sql`CREATE INDEX IF NOT EXISTS idx_unpaid_email ON unpaid_sessions_with_email(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_unpaid_uuid ON unpaid_sessions_with_email(session_uuid)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_unpaid_created ON unpaid_sessions_with_email(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_unpaid_payment_intent ON unpaid_sessions_with_email(payment_intent_id)`;

    logger.info('Table unpaid_sessions_with_email créée avec succès');
    return { success: true, message: 'Table unpaid_sessions_with_email créée' };

  } catch (error) {
    logger.error('Erreur création table unpaid_sessions_with_email:', error);
    throw error;
  }
}

/**
 * Créer la table unpaid_messages
 * @returns {Promise<Object>} Résultat de la création
 */
export async function createUnpaidMessagesTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS unpaid_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES unpaid_sessions_with_email(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_unpaid_messages_session ON unpaid_messages(session_id)`;

    logger.info('Table unpaid_messages créée avec succès');
    return { success: true, message: 'Table unpaid_messages créée' };

  } catch (error) {
    logger.error('Erreur création table unpaid_messages:', error);
    throw error;
  }
}

/**
 * Créer une session unpaid
 * @param {string} sessionUuid - UUID de la session
 * @param {string} threadId - ID du thread OpenAI
 * @returns {Promise<Object>} Session créée
 */
export async function createUnpaidSession(sessionUuid, threadId) {
  try {
    const result = await sql`
      INSERT INTO unpaid_sessions_with_email (session_uuid, thread_id, email)
      VALUES (${sessionUuid}, ${threadId}, '')
      RETURNING id, session_uuid, thread_id, created_at
    `;

    logger.info('Session unpaid créée:', { sessionUuid });
    return result.rows[0];

  } catch (error) {
    logger.error('Erreur createUnpaidSession:', error);
    throw error;
  }
}

/**
 * Récupérer une session unpaid par UUID
 * @param {string} sessionUuid - UUID de la session
 * @returns {Promise<Object|null>} Session ou null
 */
export async function getUnpaidSession(sessionUuid) {
  try {
    const result = await sql`
      SELECT * FROM unpaid_sessions_with_email
      WHERE session_uuid = ${sessionUuid}
        AND moved_to_paid = FALSE
      LIMIT 1
    `;

    return result.rows[0] || null;

  } catch (error) {
    logger.error('Erreur getUnpaidSession:', error);
    throw error;
  }
}

/**
 * Marquer le premier message d'une session unpaid
 * @param {string} sessionUuid - UUID de la session
 * @returns {Promise<Object>} Session mise à jour
 */
export async function markUnpaidSessionFirstMessage(sessionUuid) {
  try {
    const result = await sql`
      UPDATE unpaid_sessions_with_email
      SET first_message_sent = TRUE
      WHERE session_uuid = ${sessionUuid}
        AND first_message_sent = FALSE
      RETURNING id, session_uuid, first_message_sent
    `;

    if (result.rows.length > 0) {
      logger.debug('Premier message marqué pour session unpaid:', { sessionUuid });
      // Incrémenter le compteur global
      await incrementFirstMessage();
    }

    return result.rows[0] || null;

  } catch (error) {
    logger.error('Erreur markUnpaidSessionFirstMessage:', error);
    throw error;
  }
}

/**
 * Mettre à jour l'email d'une session unpaid
 * @param {string} sessionUuid - UUID de la session
 * @param {string} email - Email à mettre à jour
 * @returns {Promise<Object>} Session mise à jour
 */
export async function updateUnpaidSessionEmail(sessionUuid, email) {
  try {
    const result = await sql`
      UPDATE unpaid_sessions_with_email
      SET email = ${email},
          email_collected_at = CURRENT_TIMESTAMP,
          last_activity_at = CURRENT_TIMESTAMP
      WHERE session_uuid = ${sessionUuid}
      RETURNING id, session_uuid, email
    `;

    logger.info('Email unpaid session mis à jour:', { sessionUuid, email });

    // Incrémenter le compteur d'emails collectés
    await incrementEmailCollected();

    return result.rows[0];

  } catch (error) {
    logger.error('Erreur updateUnpaidSessionEmail:', error);
    throw error;
  }
}

/**
 * Déplacer une session depuis paid_sessions vers unpaid
 * @param {string} sessionUuid - UUID de la session
 * @param {string} email - Email collecté
 * @returns {Promise<Object>} Session unpaid créée
 */
export async function moveSessionToUnpaid(sessionUuid, email) {
  try {
    // 1. Récupérer la session dans paid_sessions
    const paidSession = await getPaidSession(sessionUuid);

    if (!paidSession) {
      throw new Error('Session non trouvée dans paid_sessions');
    }

    // 2. Créer dans unpaid_sessions_with_email
    const result = await sql`
      INSERT INTO unpaid_sessions_with_email (
        session_uuid, email, expertise, amount,
        payment_intent_id, thread_id, questionnaire_data,
        created_at, email_collected_at
      )
      VALUES (
        ${sessionUuid},
        ${email},
        ${paidSession.expertise},
        ${paidSession.amount || 0},
        ${paidSession.paymentIntentId},
        ${paidSession.threadId},
        ${paidSession.questionnaireData},
        ${paidSession.createdAt},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (session_uuid) DO UPDATE SET
        email = EXCLUDED.email,
        email_collected_at = CURRENT_TIMESTAMP
      RETURNING id, session_uuid, email
    `;

    // 3. Copier les messages de paid_messages vers unpaid_messages
    const paidMessages = await getPaidSessionMessages(paidSession.id);
    const unpaidSession = result.rows[0];

    for (const msg of paidMessages) {
      await addUnpaidMessage(unpaidSession.id, msg.role, msg.content);
    }

    logger.info('Session déplacée vers unpaid:', { sessionUuid, email });
    return unpaidSession;

  } catch (error) {
    logger.error('Erreur moveSessionToUnpaid:', error);
    throw error;
  }
}

/**
 * Ajouter un message à une session unpaid
 * @param {number} sessionId - ID de la session unpaid
 * @param {string} role - 'user' ou 'assistant'
 * @param {string} content - Contenu du message
 * @returns {Promise<Object>} Message créé
 */
export async function addUnpaidMessage(sessionId, role, content) {
  try {
    const result = await sql`
      INSERT INTO unpaid_messages (session_id, role, content)
      VALUES (${sessionId}, ${role}, ${content})
      RETURNING id, session_id, role, content, created_at
    `;

    return result.rows[0];

  } catch (error) {
    logger.error('Erreur addUnpaidMessage:', error);
    throw error;
  }
}

/**
 * Récupérer tous les messages d'une session unpaid
 * @param {number} sessionId - ID de la session
 * @returns {Promise<Array>} Liste des messages
 */
export async function getUnpaidSessionMessages(sessionId) {
  try {
    const result = await sql`
      SELECT id, session_id, role, content, created_at
      FROM unpaid_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `;

    return result.rows;

  } catch (error) {
    logger.error('Erreur getUnpaidSessionMessages:', error);
    throw error;
  }
}

/**
 * Récupérer toutes les sessions unpaid avec statistiques
 * @param {number} limit - Limite de résultats
 * @param {number} offset - Offset pour pagination
 * @returns {Promise<Array>} Liste des sessions unpaid
 */
export async function getAllUnpaidSessions(limit = 50, offset = 0) {
  try {
    const result = await sql`
      SELECT
        us.id,
        us.session_uuid,
        us.email,
        us.expertise,
        us.amount,
        us.payment_intent_id,
        us.thread_id,
        us.created_at,
        us.email_collected_at,
        us.last_activity_at,
        us.payment_attempts,
        us.last_payment_attempt_at,
        COUNT(um.id) as message_count
      FROM unpaid_sessions_with_email us
      LEFT JOIN unpaid_messages um ON us.id = um.session_id
      WHERE us.moved_to_paid = FALSE
      GROUP BY us.id
      ORDER BY us.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return result.rows.map(row => ({
      id: row.id,
      session_uuid: row.session_uuid,
      email: row.email,
      expertise: row.expertise,
      amount: row.amount,
      payment_intent_id: row.payment_intent_id,
      thread_id: row.thread_id,
      created_at: row.created_at,
      email_collected_at: row.email_collected_at,
      last_activity_at: row.last_activity_at,
      payment_attempts: row.payment_attempts,
      last_payment_attempt_at: row.last_payment_attempt_at,
      messageCount: parseInt(row.message_count) || 0
    }));

  } catch (error) {
    logger.error('Erreur getAllUnpaidSessions:', error);
    throw error;
  }
}

/**
 * Obtenir les statistiques des sessions unpaid
 * @returns {Promise<Object>} Statistiques
 */
export async function getUnpaidSessionStats() {
  try {
    const unpaidResult = await sql`
      SELECT
        COUNT(*) as total_unpaid,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_unpaid
      FROM unpaid_sessions_with_email
      WHERE moved_to_paid = FALSE
    `;

    const paidResult = await sql`
      SELECT COUNT(*) as total_paid
      FROM paid_sessions
      WHERE paid = TRUE
    `;

    const unpaid = unpaidResult.rows[0];
    const paid = paidResult.rows[0];

    const totalUnpaid = parseInt(unpaid.total_unpaid) || 0;
    const totalPaid = parseInt(paid.total_paid) || 0;
    const total = totalUnpaid + totalPaid;

    const conversionRate = total > 0
      ? ((totalPaid / total) * 100).toFixed(2)
      : 0;

    return {
      totalUnpaid,
      todayUnpaid: parseInt(unpaid.today_unpaid) || 0,
      totalPaid,
      conversionRate: parseFloat(conversionRate)
    };

  } catch (error) {
    logger.error('Erreur getUnpaidSessionStats:', error);
    throw error;
  }
}

/**
 * Migrer une session unpaid vers paid_sessions
 * @param {string} sessionUuid - UUID de la session
 * @param {string} email - Email (peut être différent de celui dans unpaid)
 * @returns {Promise<boolean>} true si migration effectuée, false sinon
 */
export async function migrateUnpaidToPaidSession(sessionUuid, email) {
  try {
    // 1. Récupérer session unpaid
    const unpaidSession = await getUnpaidSession(sessionUuid);

    if (!unpaidSession) {
      // Session déjà dans paid_sessions ou n'existe pas dans unpaid
      return false;
    }

    // 2. Récupérer messages
    const messages = await getUnpaidSessionMessages(unpaidSession.id);

    // 3. Créer/mettre à jour dans paid_sessions
    await sql`
      INSERT INTO paid_sessions (
        session_uuid, email, expertise, amount,
        payment_intent_id, thread_id, questionnaire_data,
        paid, paid_at, created_at
      )
      VALUES (
        ${unpaidSession.session_uuid},
        ${email || unpaidSession.email},
        ${unpaidSession.expertise},
        ${unpaidSession.amount},
        ${unpaidSession.payment_intent_id},
        ${unpaidSession.thread_id},
        ${unpaidSession.questionnaire_data},
        FALSE,
        NULL,
        ${unpaidSession.created_at}
      )
      ON CONFLICT (session_uuid) DO UPDATE SET
        email = EXCLUDED.email,
        expertise = EXCLUDED.expertise,
        amount = EXCLUDED.amount,
        payment_intent_id = EXCLUDED.payment_intent_id
    `;

    // 4. Récupérer l'ID de la paid_session
    const paidSession = await getPaidSession(sessionUuid);

    // 5. Copier tous les messages
    for (const msg of messages) {
      await sql`
        INSERT INTO paid_messages (session_id, role, content, created_at)
        VALUES (${paidSession.id}, ${msg.role}, ${msg.content}, ${msg.created_at})
        ON CONFLICT DO NOTHING
      `;
    }

    // 6. Marquer comme migré (soft delete)
    await markUnpaidSessionAsMoved(sessionUuid);

    logger.info('Session migrée de unpaid vers paid:', { sessionUuid });
    return true;

  } catch (error) {
    logger.error('Erreur migrateUnpaidToPaidSession:', error);
    throw error;
  }
}

/**
 * Marquer une session unpaid comme déplacée
 * @param {string} sessionUuid - UUID de la session
 * @returns {Promise<Object>} Session mise à jour
 */
export async function markUnpaidSessionAsMoved(sessionUuid) {
  try {
    const result = await sql`
      UPDATE unpaid_sessions_with_email
      SET moved_to_paid = TRUE,
          moved_at = CURRENT_TIMESTAMP
      WHERE session_uuid = ${sessionUuid}
      RETURNING id, session_uuid, moved_to_paid, moved_at
    `;

    return result.rows[0];

  } catch (error) {
    logger.error('Erreur markUnpaidSessionAsMoved:', error);
    throw error;
  }
}

// ============================================
// STATISTIQUES DES SESSIONS
// ============================================

/**
 * Créer la table des statistiques journalières
 */
export async function createSessionStatisticsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS session_statistics (
        id SERIAL PRIMARY KEY,
        stat_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
        first_messages_count INTEGER DEFAULT 0,
        emails_collected_count INTEGER DEFAULT 0,
        payments_completed_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_session_statistics_date ON session_statistics(stat_date DESC)`;

    logger.info('Table session_statistics créée avec succès');
    return { success: true, message: 'Table session_statistics créée' };

  } catch (error) {
    logger.error('Erreur création table session_statistics:', error);
    throw error;
  }
}

/**
 * Incrémenter le compteur de premiers messages
 * @returns {Promise<Object>} Statistiques mises à jour
 */
export async function incrementFirstMessage() {
  try {
    const result = await sql`
      INSERT INTO session_statistics (stat_date, first_messages_count)
      VALUES (CURRENT_DATE, 1)
      ON CONFLICT (stat_date)
      DO UPDATE SET
        first_messages_count = session_statistics.first_messages_count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    logger.debug('Premier message incrémenté:', { date: result.rows[0].stat_date });
    return result.rows[0];

  } catch (error) {
    logger.error('Erreur incrementFirstMessage:', error);
    throw error;
  }
}

/**
 * Incrémenter le compteur d'emails collectés
 * @returns {Promise<Object>} Statistiques mises à jour
 */
export async function incrementEmailCollected() {
  try {
    const result = await sql`
      INSERT INTO session_statistics (stat_date, emails_collected_count)
      VALUES (CURRENT_DATE, 1)
      ON CONFLICT (stat_date)
      DO UPDATE SET
        emails_collected_count = session_statistics.emails_collected_count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    logger.debug('Email collecté incrémenté:', { date: result.rows[0].stat_date });
    return result.rows[0];

  } catch (error) {
    logger.error('Erreur incrementEmailCollected:', error);
    throw error;
  }
}

/**
 * Incrémenter le compteur de paiements complétés
 * @returns {Promise<Object>} Statistiques mises à jour
 */
export async function incrementPaymentCompleted() {
  try {
    const result = await sql`
      INSERT INTO session_statistics (stat_date, payments_completed_count)
      VALUES (CURRENT_DATE, 1)
      ON CONFLICT (stat_date)
      DO UPDATE SET
        payments_completed_count = session_statistics.payments_completed_count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    logger.debug('Paiement complété incrémenté:', { date: result.rows[0].stat_date });
    return result.rows[0];

  } catch (error) {
    logger.error('Erreur incrementPaymentCompleted:', error);
    throw error;
  }
}

/**
 * Récupérer les statistiques d'une période
 * @param {number} days - Nombre de jours à récupérer (par défaut 30)
 * @returns {Promise<Array>} Statistiques journalières
 */
export async function getSessionStatistics(days = 30) {
  try {
    // Calculer la date de début
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const result = await sql`
      SELECT
        stat_date,
        first_messages_count,
        emails_collected_count,
        payments_completed_count,
        CASE
          WHEN first_messages_count > 0
          THEN ROUND((emails_collected_count::NUMERIC / first_messages_count::NUMERIC) * 100, 2)
          ELSE 0
        END as email_conversion_rate,
        CASE
          WHEN emails_collected_count > 0
          THEN ROUND((payments_completed_count::NUMERIC / emails_collected_count::NUMERIC) * 100, 2)
          ELSE 0
        END as payment_conversion_rate,
        CASE
          WHEN first_messages_count > 0
          THEN ROUND((payments_completed_count::NUMERIC / first_messages_count::NUMERIC) * 100, 2)
          ELSE 0
        END as total_conversion_rate
      FROM session_statistics
      WHERE stat_date >= ${startDateStr}::DATE
      ORDER BY stat_date DESC
    `;

    return result.rows;

  } catch (error) {
    logger.error('Erreur getSessionStatistics:', error);
    throw error;
  }
}

/**
 * Récupérer les statistiques globales (tous les temps)
 * @returns {Promise<Object>} Statistiques globales
 */
export async function getGlobalStatistics() {
  try {
    const result = await sql`
      SELECT
        SUM(first_messages_count) as total_first_messages,
        SUM(emails_collected_count) as total_emails_collected,
        SUM(payments_completed_count) as total_payments_completed,
        CASE
          WHEN SUM(first_messages_count) > 0
          THEN ROUND((SUM(emails_collected_count)::NUMERIC / SUM(first_messages_count)::NUMERIC) * 100, 2)
          ELSE 0
        END as email_conversion_rate,
        CASE
          WHEN SUM(emails_collected_count) > 0
          THEN ROUND((SUM(payments_completed_count)::NUMERIC / SUM(emails_collected_count)::NUMERIC) * 100, 2)
          ELSE 0
        END as payment_conversion_rate,
        CASE
          WHEN SUM(first_messages_count) > 0
          THEN ROUND((SUM(payments_completed_count)::NUMERIC / SUM(first_messages_count)::NUMERIC) * 100, 2)
          ELSE 0
        END as total_conversion_rate
      FROM session_statistics
    `;

    return result.rows[0];

  } catch (error) {
    logger.error('Erreur getGlobalStatistics:', error);
    throw error;
  }
}
