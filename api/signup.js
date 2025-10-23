// Importation depuis la nouvelle base de données Postgres
import { addUser, findUserByEmail, getAllUsers, getStats, verifyUserPassword } from '../lib/db.js';
import { setCorsHeaders, handleCorsPreflight, createMultipleCookies, isValidEmail, parseCookies } from '../lib/utils.js';
import {
  signupRateLimiter,
  loginRateLimiter,
  adminRateLimiter,
  getClientIp,
  checkRateLimit,
  sendRateLimitError,
  addRateLimitHeaders
} from '../lib/ratelimit.js';
import logger from '../lib/logger.js';

/**
 * Vérifier si la requête provient d'un admin autorisé
 * @param {Request} req - Requête
 * @returns {boolean} True si admin autorisé
 */
function isAdmin(req) {
  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
  const expectedKey = process.env.ADMIN_KEY;

  // Si pas de clé admin configurée, refuser l'accès
  if (!expectedKey) {
    logger.error('ADMIN_KEY non configurée dans les variables d\'environnement');
    return false;
  }

  return adminKey === expectedKey;
}

export default async function handler(req, res) {
  // Configurer CORS avec liste blanche
  setCorsHeaders(res, req);

  // Gérer preflight CORS
  if (handleCorsPreflight(req, res)) {
    return;
  }

  if (req.method === 'GET') {
    // Retourner les statistiques
    try {
      const stats = await getStats();
      return res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des stats' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, firstName, lastName, email, password } = req.body;

    // Gérer différentes actions
    if (action === 'register') {
      return await handleRegister(firstName, lastName, email, password, req, res);
    } else if (action === 'login') {
      return await handleLogin(email, password, req, res);
    } else if (action === 'logout') {
      return await handleLogout(req, res);
    } else if (action === 'check') {
      return await handleCheckUser(req, res);
    } else if (action === 'list') {
      return await handleListUsers(req, res);
    } else if (action === 'stats') {
      return await handleStats(req, res);
    } else {
      // Inscription par défaut (pour compatibilité - ATTENTION: nécessite un mot de passe maintenant)
      return await handleRegister(firstName, lastName, email, password, req, res);
    }

  } catch (error) {
    logger.error('Signup API Error:', error);
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      ok: false
    });
  }
}

async function handleRegister(firstName, lastName, email, password, req, res) {
  // Rate limiting pour les inscriptions
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(signupRateLimiter, clientIp);

  if (!rateLimit.success) {
    logger.security(`Rate limit inscription dépassé pour ${clientIp}`);
    return sendRateLimitError(res, rateLimit);
  }

  addRateLimitHeaders(res, rateLimit);

  // Validation des données
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({
      error: 'Tous les champs sont obligatoires (nom, prénom, email, mot de passe)',
      ok: false
    });
  }

  // Validation basique de l'email
  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: 'Format d\'email invalide',
      ok: false
    });
  }

  // Validation du mot de passe
  if (password.length < 6) {
    return res.status(400).json({
      error: 'Le mot de passe doit contenir au moins 6 caractères',
      ok: false
    });
  }

  // Vérifier si l'utilisateur existe déjà
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      error: 'Cet email est déjà utilisé',
      ok: false
    });
  }

  // Sauvegarder en base de données Postgres avec mot de passe
  const user = await addUser({ firstName, lastName, email, password });

  // Envoyer vers Google Sheets via webhook
  try {
    const SHEET_ID = '1cfJApHpVD1bIbb9IWrePIIO1j0YhjNjBmOLB7S8Mhzk';
    const webhookUrl = process.env.GOOGLE_WEBHOOK_URL;

    if (webhookUrl) {
      const registeredAt = new Date().toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Envoyer via webhook (Make.com ou Zapier)
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: lastName,
          prenom: firstName,
          email: email,
          date: registeredAt
        })
      }).catch(err => logger.error('Erreur Google Sheets:', err));
    }
  } catch (error) {
    logger.error('Erreur envoi Google Sheets:', error);
    // Ne pas bloquer l'inscription si Google Sheets échoue
  }

  // Définir les cookies d'inscription
  const oneYear = 365 * 24 * 60 * 60; // 1 an en secondes
  const cookies = createMultipleCookies([
    { name: 'registered', value: '1', options: { maxAge: oneYear } },
    { name: 'q_used', value: '0', options: { maxAge: oneYear } },
    { name: 'user_name', value: firstName, options: { maxAge: oneYear } },
    { name: 'user_email', value: email, options: { maxAge: oneYear } }
  ]);
  res.setHeader('Set-Cookie', cookies);

  logger.logSensitive('Nouvelle inscription', { firstName, lastName, email, timestamp: new Date().toISOString() });

  return res.status(200).json({
    success: true,
    message: 'Inscription réussie ! Vous pouvez maintenant poser des questions illimitées.',
    user: {
      id: user.id,
      firstName,
      lastName,
      email
    }
  });
}

async function handleLogin(email, password, req, res) {
  // Rate limiting pour le login (protection brute force)
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(loginRateLimiter, clientIp);

  if (!rateLimit.success) {
    logger.security(`Rate limit login dépassé pour ${clientIp}`);
    return sendRateLimitError(res, rateLimit);
  }

  addRateLimitHeaders(res, rateLimit);

  // Validation des données
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email et mot de passe requis',
      success: false
    });
  }

  // Vérifier le mot de passe avec la nouvelle fonction sécurisée
  const user = await verifyUserPassword(email, password);
  if (!user) {
    return res.status(401).json({
      error: 'Email ou mot de passe incorrect',
      success: false
    });
  }

  // Définir les cookies de connexion
  const oneYear = 365 * 24 * 60 * 60; // 1 an en secondes
  const cookies = createMultipleCookies([
    { name: 'registered', value: '1', options: { maxAge: oneYear } },
    { name: 'q_used', value: '0', options: { maxAge: oneYear } },
    { name: 'user_name', value: user.firstName, options: { maxAge: oneYear } },
    { name: 'user_email', value: email, options: { maxAge: oneYear } }
  ]);
  res.setHeader('Set-Cookie', cookies);

  return res.status(200).json({
    success: true,
    message: 'Connexion réussie',
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    }
  });
}

async function handleLogout(req, res) {
  // Créer des cookies expirés pour supprimer la session
  const expiredCookies = [
    'registered=; Max-Age=0; Path=/; SameSite=Lax',
    'q_used=; Max-Age=0; Path=/; SameSite=Lax',
    'user_name=; Max-Age=0; Path=/; SameSite=Lax',
    'user_email=; Max-Age=0; Path=/; SameSite=Lax'
  ];

  res.setHeader('Set-Cookie', expiredCookies);

  return res.status(200).json({
    success: true,
    message: 'Déconnexion réussie'
  });
}

async function handleCheckUser(req, res) {
  // Lire les cookies pour vérifier l'utilisateur
  const cookies = parseCookies(req.headers.cookie || '');
  const userEmail = cookies.user_email;

  if (!userEmail) {
    return res.status(200).json({ success: false });
  }

  const user = await findUserByEmail(userEmail); // Déjà décodé par parseCookies
  if (!user) {
    return res.status(200).json({ success: false });
  }

  return res.status(200).json({
    success: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    }
  });
}

async function handleListUsers(req, res) {
  // Rate limiting pour les endpoints admin
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(adminRateLimiter, clientIp);

  if (!rateLimit.success) {
    logger.security(`Rate limit admin dépassé pour ${clientIp}`);
    return sendRateLimitError(res, rateLimit);
  }

  // Vérifier l'authentification admin
  if (!isAdmin(req)) {
    logger.security('Tentative d\'accès non autorisée à la liste des utilisateurs');
    return res.status(403).json({
      error: 'Accès refusé. Authentification admin requise.',
      success: false
    });
  }

  addRateLimitHeaders(res, rateLimit);

  const users = await getAllUsers(100, 0); // Limit 100 utilisateurs, offset 0
  return res.status(200).json({
    success: true,
    users,
    count: users.length
  });
}

async function handleStats(req, res) {
  // Rate limiting pour les endpoints admin
  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit(adminRateLimiter, clientIp);

  if (!rateLimit.success) {
    logger.security(`Rate limit admin dépassé pour ${clientIp}`);
    return sendRateLimitError(res, rateLimit);
  }

  // Vérifier l'authentification admin
  if (!isAdmin(req)) {
    logger.security('Tentative d\'accès non autorisée aux statistiques');
    return res.status(403).json({
      error: 'Accès refusé. Authentification admin requise.',
      success: false
    });
  }

  addRateLimitHeaders(res, rateLimit);

  const stats = await getStats();
  return res.status(200).json({
    success: true,
    stats
  });
}

