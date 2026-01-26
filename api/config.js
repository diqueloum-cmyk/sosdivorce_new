import { setCorsHeaders, handleCorsPreflight } from '../lib/utils.js';

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

  // Retourner uniquement la clé publique (safe à exposer)
  return res.status(200).json({
    success: true,
    stripePublicKey: process.env.STRIPE_PUBLIC_KEY
  });
}
