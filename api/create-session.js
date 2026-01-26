import { setCorsHeaders, handleCorsPreflight } from '../lib/utils.js';
import { createPaidSession } from '../lib/db.js';
import logger from '../lib/logger.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  // Configurer CORS
  setCorsHeaders(res, req);

  // Gérer preflight CORS
  if (handleCorsPreflight(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vérifier que la clé API OpenAI est présente
    if (!process.env.OPENAI_API_KEY) {
      logger.error('OPENAI_API_KEY not found in environment variables');
      return res.status(500).json({
        error: 'Configuration manquante. Veuillez contacter l\'administrateur.'
      });
    }

    // Générer un UUID unique pour la session
    const sessionUuid = crypto.randomUUID();

    // Créer un thread OpenAI
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({})
    });

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      logger.error('OpenAI Thread Creation Error:', threadResponse.status, errorText);
      return res.status(500).json({
        error: 'Erreur lors de la création de la session de chat.'
      });
    }

    const threadData = await threadResponse.json();
    const threadId = threadData.id;

    // Sauvegarder la session en base de données
    await createPaidSession(sessionUuid, threadId);

    logger.info('Nouvelle session payante créée:', { sessionUuid, threadId });

    return res.status(200).json({
      success: true,
      sessionId: sessionUuid
    });

  } catch (error) {
    logger.error('Create Session API Error:', error);
    return res.status(500).json({
      error: 'Erreur lors de la création de la session.'
    });
  }
}
