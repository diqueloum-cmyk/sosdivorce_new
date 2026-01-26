import { setCorsHeaders, handleCorsPreflight } from '../lib/utils.js';
import { getPaidSession, markPaidSessionCompleted, getPaidSessionMessages, markEmailSent } from '../lib/db.js';
import { sendAnalysisEmail } from '../lib/email.js';
import logger from '../lib/logger.js';
import Stripe from 'stripe';

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
    // Vérifier que la clé Stripe est présente
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.error('STRIPE_SECRET_KEY not found in environment variables');
      return res.status(500).json({
        error: 'Configuration paiement manquante.'
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const { sessionId, paymentIntentId } = req.body;

    // Validation des paramètres
    if (!sessionId || !paymentIntentId) {
      return res.status(400).json({
        error: 'Paramètres manquants (sessionId, paymentIntentId requis)'
      });
    }

    // Récupérer la session
    const session = await getPaidSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    // Vérifier que le paymentIntentId correspond
    if (session.paymentIntentId !== paymentIntentId) {
      logger.security('PaymentIntent mismatch:', {
        sessionId,
        expected: session.paymentIntentId,
        received: paymentIntentId
      });
      return res.status(400).json({ error: 'PaymentIntent invalide' });
    }

    // Vérifier que la session n'est pas déjà payée
    if (session.paid) {
      return res.status(200).json({
        success: true,
        alreadyPaid: true,
        expertise: session.expertise,
        message: 'Cette session est déjà confirmée comme payée.'
      });
    }

    // Récupérer l'intention de paiement depuis Stripe pour vérification
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Vérifier que le paiement a réussi
    if (paymentIntent.status === 'succeeded') {
      // Marquer la session comme payée
      await markPaidSessionCompleted(sessionId, session.email);

      logger.info('Paiement vérifié et confirmé:', {
        sessionId,
        paymentIntentId,
        expertise: session.expertise,
        amount: session.amount,
        email: session.email
      });

      // Envoyer l'email d'analyse si l'email est disponible
      let emailSent = false;
      if (session.email) {
        try {
          // Récupérer les messages de la conversation
          const messages = await getPaidSessionMessages(session.id);

          // Envoyer l'email d'analyse
          await sendAnalysisEmail({
            to: session.email,
            expertise: session.expertise,
            messages: messages,
            amount: session.amount,
            paymentIntentId: paymentIntentId
          });

          // Marquer l'email comme envoyé
          await markEmailSent(sessionId);
          emailSent = true;

          logger.info('Email d\'analyse envoyé:', {
            sessionId,
            email: session.email,
            expertise: session.expertise
          });

        } catch (emailError) {
          // Ne pas bloquer la réponse si l'email échoue
          logger.error('Erreur envoi email (paiement validé quand même):', emailError);
        }
      }

      return res.status(200).json({
        success: true,
        expertise: session.expertise,
        emailSent: emailSent,
        message: emailSent
          ? 'Paiement confirmé. Votre analyse a été envoyée par email.'
          : 'Paiement confirmé avec succès.'
      });
    } else {
      logger.warn('Paiement non confirmé:', {
        sessionId,
        paymentIntentId,
        status: paymentIntent.status
      });

      return res.status(400).json({
        success: false,
        status: paymentIntent.status,
        error: 'Le paiement n\'a pas été confirmé. Statut: ' + paymentIntent.status
      });
    }

  } catch (error) {
    logger.error('Verify Payment API Error:', error);
    return res.status(500).json({
      error: 'Erreur lors de la vérification du paiement.'
    });
  }
}
