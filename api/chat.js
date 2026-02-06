import { setCorsHeaders, handleCorsPreflight } from '../lib/utils.js';
import {
  getPaidSession,
  addPaidMessage,
  updatePaidSessionEmail,
  getUnpaidSession,
  updateUnpaidSessionEmail,
  moveSessionToUnpaid,
  addUnpaidMessage
} from '../lib/db.js';
import {
  chatRateLimiter,
  getClientIp,
  checkRateLimit,
  sendRateLimitError,
  addRateLimitHeaders
} from '../lib/ratelimit.js';
import logger from '../lib/logger.js';

// ID de l'assistant OpenAI pour le questionnaire 7 étapes
const ASSISTANT_ID = process.env.ASSISTANT_ID || 'asst_fmjvR1dqr6mcbpdIyOp3WaZd';

// Instructions additionnelles pour l'assistant (questionnaire 7 étapes)
const QUESTIONNAIRE_INSTRUCTIONS = `IMPORTANT: Tu dois suivre le tunnel de 7 questions dans l'ordre strict:
1. Enfants (oui/non + âges si oui)
2. Type de divorce envisagé (amiable/contentieux/ne sait pas)
3. Urgence de la situation
4. Budget prévu
5. Attentes principales
6. Ressenti émotionnel actuel
7. Email pour recevoir l'analyse

Pose UNE SEULE question à la fois. Après avoir reçu l'email, fais un mini-diagnostic puis propose les deux formules:
- Analyse Express à 29€
- Analyse Premium validée avocat à 49€

Ne saute aucune étape.

Si le message est "[INIT]", c'est le début de la conversation. Présente-toi brièvement (1-2 phrases max) puis pose IMMÉDIATEMENT la première question sur les enfants. Ne demande pas à l'utilisateur comment tu peux l'aider, pose directement la question.

Si le message commence par "[CHOIX_OFFRE:", c'est que l'utilisateur a choisi une formule. Tu dois alors demander les COMMENTAIRES PERSONNELS avec ce message exact:

"Parfait, merci pour votre choix.

Pour que votre analyse soit vraiment personnalisée et précise, j'ai besoin de quelques éléments complémentaires.

Pouvez-vous décrire votre situation en quelques phrases en indiquant, si possible :
• quel est votre régime matrimonial ? (communauté réduite aux acquêts, séparation de biens, contrat spécifique si vous le connaissez)
• si vous avez un bien immobilier ou un crédit en commun
• si vous êtes d'accord sur tout, ou s'il reste des points de désaccord
• vos revenus et ceux de votre conjoint (même approximatifs)
• votre situation financière actuelle (ex. chômage, arrêt d'activité, dettes, congé parental…)
• si vous êtes d'accord sur la garde des enfants (alternée, résidence chez l'un, modalités)
• s'il est question d'une pension alimentaire
• vos échanges récents avec votre conjoint
• ce qui vous inquiète le plus aujourd'hui

Quelques lignes suffisent — cela rend votre analyse beaucoup plus précise et utile.

Que souhaitez-vous ajouter ?"

Après avoir reçu les commentaires personnels de l'utilisateur (ou s'il dit "non" ou "rien" ou similaire), réponds en confirmant que tu as bien noté ses informations et termine OBLIGATOIREMENT ton message par le tag [PAIEMENT_PRET] pour déclencher le bouton de paiement. Exemple: "Merci pour ces précisions, je les intègrerai à votre analyse. Vous pouvez maintenant finaliser votre commande. [PAIEMENT_PRET]"`;

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
    const { message, sessionId } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'SessionId is required' });
    }

    // ====================================
    // RATE LIMITING
    // ====================================
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(chatRateLimiter, clientIp);

    if (!rateLimit.success) {
      logger.security(`Rate limit dépassé pour ${clientIp}`);
      return sendRateLimitError(res, rateLimit);
    }

    addRateLimitHeaders(res, rateLimit);

    // ====================================
    // RÉCUPÉRER LA SESSION
    // ====================================
    const session = await getPaidSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée. Veuillez rafraîchir la page.' });
    }

    // Vérifier que la clé API et l'Assistant ID sont présents
    if (!process.env.OPENAI_API_KEY) {
      logger.error('OPENAI_API_KEY not found in environment variables');
      return res.status(500).json({
        error: 'Configuration manquante. Veuillez contacter l\'administrateur.'
      });
    }

    // Mesurer le temps de réponse
    const startTime = Date.now();

    // ====================================
    // DÉTECTER ET EXTRAIRE L'EMAIL SI PRÉSENT
    // ====================================
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = message.match(emailRegex);
    if (emailMatch && !session.email) {
      const extractedEmail = emailMatch[0];

      // Vérifier si la session existe déjà dans unpaid_sessions
      const unpaidSession = await getUnpaidSession(sessionId);

      if (unpaidSession) {
        // Mettre à jour l'email dans la table unpaid
        await updateUnpaidSessionEmail(sessionId, extractedEmail);
        logger.info('Email unpaid session mis à jour:', { sessionId, email: extractedEmail });
      } else {
        // Créer une entrée dans unpaid_sessions (avec copie des messages existants)
        await moveSessionToUnpaid(sessionId, extractedEmail);
        logger.info('Session déplacée vers unpaid_sessions:', { sessionId, email: extractedEmail });
      }
    }

    // ====================================
    // ENVOYER LE MESSAGE À L'ASSISTANT OPENAI
    // ====================================
    let answer;

    try {
      // Ajouter le message au thread existant
      const messageResponse = await fetch(`https://api.openai.com/v1/threads/${session.threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          role: 'user',
          content: message
        })
      });

      if (!messageResponse.ok) {
        const errorData = await messageResponse.text();
        logger.error('OpenAI Message Error:', messageResponse.status, errorData);
        throw new Error('Erreur lors de l\'ajout du message');
      }

      // Exécuter l'assistant avec les instructions du questionnaire
      const runResponse = await fetch(`https://api.openai.com/v1/threads/${session.threadId}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          assistant_id: ASSISTANT_ID,
          additional_instructions: QUESTIONNAIRE_INSTRUCTIONS
        })
      });

      if (!runResponse.ok) {
        const errorData = await runResponse.text();
        logger.error('OpenAI Run Error:', runResponse.status, errorData);
        throw new Error('Erreur lors de l\'exécution de l\'assistant');
      }

      const runData = await runResponse.json();
      const runId = runData.id;

      // Attendre que l'exécution soit terminée (polling)
      let runStatus = 'queued';
      let attempts = 0;
      const maxAttempts = 60; // 60 secondes maximum

      while (runStatus !== 'completed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde

        const statusResponse = await fetch(`https://api.openai.com/v1/threads/${session.threadId}/runs/${runId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });

        if (!statusResponse.ok) {
          logger.error('OpenAI Status Check Error:', statusResponse.status);
          throw new Error('Erreur lors de la vérification du statut');
        }

        const statusData = await statusResponse.json();
        runStatus = statusData.status;

        logger.debug(`Assistant run status (attempt ${attempts}):`, runStatus);

        if (runStatus === 'failed' || runStatus === 'cancelled' || runStatus === 'expired') {
          logger.error('Assistant run failed with status:', runStatus, 'Details:', statusData);
          throw new Error('L\'assistant n\'a pas pu traiter la demande');
        }

        attempts++;
      }

      if (runStatus !== 'completed') {
        logger.error('Assistant timeout after', attempts, 'attempts. Last status:', runStatus);
        throw new Error('Timeout: L\'assistant met trop de temps à répondre');
      }

      // Récupérer les messages du thread
      const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${session.threadId}/messages`, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!messagesResponse.ok) {
        logger.error('OpenAI Messages Retrieval Error:', messagesResponse.status);
        throw new Error('Erreur lors de la récupération des messages');
      }

      const messagesData = await messagesResponse.json();

      // Récupérer le dernier message de l'assistant
      const assistantMessage = messagesData.data.find(msg => msg.role === 'assistant');

      if (!assistantMessage || !assistantMessage.content || assistantMessage.content.length === 0) {
        throw new Error('Aucune réponse de l\'assistant');
      }

      answer = assistantMessage.content[0].text.value;

    } catch (error) {
      logger.error('OpenAI Assistant API Error:', error);
      return res.status(500).json({
        error: 'Erreur lors de la génération de la réponse. Veuillez réessayer.'
      });
    }

    // Calculer le temps de réponse
    const responseTimeMs = Date.now() - startTime;

    // ====================================
    // SAUVEGARDER LES MESSAGES EN BASE
    // ====================================
    try {
      // Vérifier si la session est dans unpaid_sessions
      const unpaidSession = await getUnpaidSession(sessionId);

      if (unpaidSession) {
        // Sauvegarder dans unpaid_messages
        await addUnpaidMessage(unpaidSession.id, 'user', message);
        await addUnpaidMessage(unpaidSession.id, 'assistant', answer);
        logger.info('Messages sauvegardés dans unpaid_messages:', {
          sessionId,
          unpaidSessionId: unpaidSession.id,
          responseTimeMs
        });
      } else {
        // Sauvegarder dans paid_messages (comportement par défaut)
        await addPaidMessage(session.id, 'user', message);
        await addPaidMessage(session.id, 'assistant', answer);
        logger.info('Messages sauvegardés dans paid_messages:', {
          sessionId,
          responseTimeMs
        });
      }

    } catch (error) {
      // Ne pas bloquer la réponse si la sauvegarde échoue
      logger.error('Erreur sauvegarde messages:', error);
    }

    return res.status(200).json({
      success: true,
      response: answer,
      sessionId: sessionId
    });

  } catch (error) {
    logger.error('Chat API Error:', error);
    return res.status(500).json({
      error: 'Erreur interne du serveur'
    });
  }
}
