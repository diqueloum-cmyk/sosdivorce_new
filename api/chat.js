import { parseCookies, setCorsHeaders, handleCorsPreflight, createCookie } from '../lib/utils.js';
import { getCachedAnswer, saveCachedAnswer } from '../lib/db.js';
import {
  chatRateLimiter,
  chatRateLimiterRegistered,
  getClientIp,
  checkRateLimit,
  sendRateLimitError,
  addRateLimitHeaders
} from '../lib/ratelimit.js';
import logger from '../lib/logger.js';

export default async function handler(req, res) {
  // Configurer CORS avec liste blanche
  setCorsHeaders(res, req);

  // Gérer preflight CORS
  if (handleCorsPreflight(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Lire les cookies
    const cookies = parseCookies(req.headers.cookie || '');
    const qUsed = parseInt(cookies.q_used || '0');
    const registered = cookies.registered === '1';
    const userEmail = cookies.user_email;

    logger.debug('Cookies:', { qUsed, registered });

    // ====================================
    // RATE LIMITING
    // ====================================
    const clientIp = getClientIp(req);

    // Choisir le rate limiter approprié
    const limiter = registered ? chatRateLimiterRegistered : chatRateLimiter;
    const identifier = registered && userEmail ? userEmail : clientIp;

    const rateLimit = await checkRateLimit(limiter, identifier);

    if (!rateLimit.success) {
      logger.security(`Rate limit dépassé pour ${identifier} (registered: ${registered})`);
      return sendRateLimitError(res, rateLimit);
    }

    // Ajouter les headers de rate limit à la réponse
    addRateLimitHeaders(res, rateLimit);

    // Vérifier si l'utilisateur a dépassé la limite
    if (!registered && qUsed >= 2) {
      return res.status(200).json({
        success: false,
        needSignup: true,
        message: 'Vous avez utilisé vos 2 questions gratuites. Inscrivez-vous pour continuer.',
        qUsed,
        remaining: 0
      });
    }

    // Vérifier que la clé API est présente
    if (!process.env.OPENAI_API_KEY) {
      logger.error('OPENAI_API_KEY not found in environment variables');
      return res.status(500).json({
        error: 'Configuration manquante. Veuillez contacter l\'administrateur.'
      });
    }

    // Vérifier le cache d'abord
    const cachedResponse = await getCachedAnswer(message);
    let answer;
    let fromCache = false;

    if (cachedResponse) {
      // Réponse trouvée dans le cache
      answer = cachedResponse.answer;
      fromCache = true;
      logger.info('Réponse servie depuis le cache (hit count:', cachedResponse.hitCount, ')');
    } else {
      // Pas de cache, appeler l'API OpenAI
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Tu es un assistant juridique spécialisé en droit du divorce français. Réponds de manière claire, précise et professionnelle. Donne des conseils juridiques généraux mais recommande toujours de consulter un avocat pour des cas spécifiques.'
            },
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.2,
          max_tokens: 500
        })
      });

      if (!openaiResponse.ok) {
        logger.error('OpenAI API Error:', openaiResponse.status, openaiResponse.statusText);
        // Ne pas logger le contenu complet de l'erreur qui peut contenir des infos sensibles
        return res.status(500).json({
          error: 'Erreur lors de la génération de la réponse. Veuillez réessayer.'
        });
      }

      const openaiData = await openaiResponse.json();
      answer = openaiData.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';

      // Sauvegarder la réponse dans le cache
      await saveCachedAnswer(message, answer);
    }

    // Incrémenter le compteur de questions si non inscrit
    const newQUsed = registered ? qUsed : qUsed + 1;
    const remaining = registered ? 'illimité' : Math.max(0, 2 - newQUsed);

    // Définir les cookies
    if (!registered) {
      const cookie = createCookie('q_used', newQUsed.toString(), {
        maxAge: 24 * 60 * 60 // 24 heures
      });
      res.setHeader('Set-Cookie', cookie);
    }

    return res.status(200).json({
      success: true,
      response: answer,
      qUsed: newQUsed,
      remaining,
      cached: fromCache
    });

  } catch (error) {
    logger.error('Chat API Error:', error);
    return res.status(500).json({
      error: 'Erreur interne du serveur'
    });
  }
}

