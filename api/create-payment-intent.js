import { setCorsHeaders, handleCorsPreflight } from '../lib/utils.js';
import { getPaidSession, updatePaidSessionPayment } from '../lib/db.js';
import logger from '../lib/logger.js';
import Stripe from 'stripe';

// Configuration des expertises et tarifs
const EXPERTISE_CONFIG = {
  classique: {
    price: 2900, // en centimes (29€)
    name: 'Analyse Express'
  },
  premium: {
    price: 4900, // en centimes (49€)
    name: 'Analyse Premium validée avocat'
  }
};

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
        error: 'Configuration paiement manquante. Veuillez contacter l\'administrateur.'
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const { sessionId, expertise, amount } = req.body;

    // Validation des paramètres
    if (!sessionId || !expertise || !amount) {
      return res.status(400).json({
        error: 'Paramètres manquants (sessionId, expertise, amount requis)'
      });
    }

    // Vérifier que l'expertise est valide
    if (!EXPERTISE_CONFIG[expertise]) {
      return res.status(400).json({
        error: 'Expertise invalide. Valeurs acceptées: classique, premium'
      });
    }

    // Vérifier que le montant correspond au tarif
    if (EXPERTISE_CONFIG[expertise].price !== amount) {
      return res.status(400).json({
        error: 'Montant invalide pour cette expertise'
      });
    }

    // Récupérer la session
    const session = await getPaidSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    // Vérifier que la session n'est pas déjà payée
    if (session.paid) {
      return res.status(400).json({ error: 'Cette session est déjà payée' });
    }

    // Créer l'intention de paiement Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'eur',
      metadata: {
        expertise: expertise,
        sessionId: sessionId,
        sessionEmail: session.email || 'non_collecte'
      },
      description: `${EXPERTISE_CONFIG[expertise].name} - Consultation SOS Divorce`
    });

    // Mettre à jour la session avec les infos de paiement
    await updatePaidSessionPayment(sessionId, expertise, amount, paymentIntent.id);

    logger.info('PaymentIntent créé:', {
      sessionId,
      expertise,
      amount,
      paymentIntentId: paymentIntent.id
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret
    });

  } catch (error) {
    logger.error('Create Payment Intent API Error:', error);
    return res.status(500).json({
      error: 'Erreur lors de la création de l\'intention de paiement.'
    });
  }
}
