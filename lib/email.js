// Module d'envoi d'emails avec Resend
// Utilisé pour envoyer les analyses après paiement

import { Resend } from 'resend';
import logger from './logger.js';

// Initialiser Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const FROM_NAME = 'SOS Divorce';
// Email de destination pour vérification humaine (toujours envoyer ici)
const ADMIN_EMAIL = 'info.sosdivorce@gmail.com';

/**
 * Envoyer l'email d'analyse après paiement
 * @param {Object} params - Paramètres de l'email
 * @param {string} params.to - Email du destinataire
 * @param {string} params.expertise - Type d'expertise (classique ou premium)
 * @param {Array} params.messages - Messages de la conversation
 * @param {number} params.amount - Montant payé en centimes
 * @param {string} params.paymentIntentId - ID du paiement Stripe
 * @returns {Promise<Object>} - Résultat de l'envoi
 */
export async function sendAnalysisEmail({ to, expertise, messages, amount, paymentIntentId }) {
  // L'email client est requis pour être inclus dans l'email admin
  const clientEmail = to || 'Non renseigné';
  const stripePaymentId = paymentIntentId || 'Non disponible';

  const expertiseLabels = {
    classique: 'Analyse Express',
    premium: 'Analyse Premium validée avocat'
  };

  const expertiseName = expertiseLabels[expertise] || 'Analyse';
  const amountEuros = (amount / 100).toFixed(2);

  // Extraire les informations du questionnaire
  const questionnaireData = extractQuestionnaireData(messages);

  // Générer le HTML de l'email (inclut l'email client pour la vérification)
  const htmlContent = generateAnalysisEmailHTML({
    expertiseName,
    amountEuros,
    questionnaireData,
    messages,
    isPremium: expertise === 'premium',
    clientEmail: clientEmail,
    paymentIntentId: stripePaymentId
  });

  // Générer le texte brut
  const textContent = generateAnalysisEmailText({
    expertiseName,
    amountEuros,
    questionnaireData,
    messages,
    clientEmail: clientEmail,
    paymentIntentId: stripePaymentId
  });

  try {
    // Toujours envoyer à l'email admin pour vérification humaine
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [ADMIN_EMAIL],
      subject: `[À VÉRIFIER] ${expertiseName} - Client: ${clientEmail}`,
      html: htmlContent,
      text: textContent
    });

    logger.info(`Email envoyé à ${ADMIN_EMAIL} pour vérification (client: ${clientEmail}, payment: ${stripePaymentId})`, { emailId: result.id });

    return {
      success: true,
      emailId: result.id
    };

  } catch (error) {
    logger.error('Erreur envoi email:', error);
    throw error;
  }
}

/**
 * Extraire les données du questionnaire depuis les messages
 * Analyse les questions de l'assistant pour associer les réponses aux bonnes catégories
 */
function extractQuestionnaireData(messages) {
  const data = {
    enfants: null,
    typeDivorce: null,
    urgence: null,
    budget: null,
    attentes: null,
    ressenti: null,
    commentaires: null
  };

  // Parcourir les messages en paires (assistant pose question, user répond)
  for (let i = 0; i < messages.length - 1; i++) {
    const currentMsg = messages[i];
    const nextMsg = messages[i + 1];

    // Si l'assistant pose une question et l'utilisateur répond
    if (currentMsg.role === 'assistant' && nextMsg.role === 'user') {
      const question = currentMsg.content.toLowerCase();
      const answer = nextMsg.content;

      // Ignorer les réponses système
      if (answer.startsWith('[')) continue;

      // Détecter la question posée par des mots-clés
      if (question.includes('enfant') && !data.enfants) {
        data.enfants = answer;
      } else if ((question.includes('type de divorce') || question.includes('amiable') || question.includes('contentieux')) && !data.typeDivorce) {
        data.typeDivorce = answer;
      } else if ((question.includes('urgence') || question.includes('urgent') || question.includes('délai') || question.includes('rapidement')) && !data.urgence) {
        data.urgence = answer;
      } else if ((question.includes('budget') || question.includes('financ') || question.includes('moyens') || question.includes('coût')) && !data.budget) {
        data.budget = answer;
      } else if ((question.includes('attent') || question.includes('objectif') || question.includes('souhait') || question.includes('priorité')) && !data.attentes) {
        data.attentes = answer;
      } else if ((question.includes('ressent') || question.includes('émotion') || question.includes('moral') || question.includes('état')) && !data.ressenti) {
        data.ressenti = answer;
      }
    }
  }

  // Chercher les commentaires personnels (après le choix d'offre)
  const userMessages = messages.filter(m => m.role === 'user');
  const choixOffreIndex = userMessages.findIndex(m => m.content.includes('[CHOIX_OFFRE:'));
  if (choixOffreIndex !== -1 && choixOffreIndex + 1 < userMessages.length) {
    const nextMessage = userMessages[choixOffreIndex + 1];
    if (!nextMessage.content.startsWith('[')) {
      data.commentaires = nextMessage.content;
    }
  }

  return data;
}

/**
 * Générer le HTML de l'email d'analyse
 */
function generateAnalysisEmailHTML({ expertiseName, amountEuros, questionnaireData, messages, isPremium, clientEmail, paymentIntentId }) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${expertiseName} - SOS Divorce</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- BANDEAU ADMIN - À ENVOYER AU CLIENT -->
          <tr>
            <td style="background-color: #dc2626; padding: 15px 30px; text-align: center;">
              <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: bold;">
                À VÉRIFIER ET ENVOYER AU CLIENT
              </p>
              <p style="color: #fecaca; margin: 5px 0 0 0; font-size: 14px;">
                Email client : <strong style="color: #ffffff;">${escapeHtml(clientEmail)}</strong>
              </p>
              <p style="color: #fecaca; margin: 5px 0 0 0; font-size: 12px;">
                ID Paiement Stripe : <strong style="color: #ffffff;">${escapeHtml(paymentIntentId)}</strong>
              </p>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a8a; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">
                <span style="font-weight: bold;">SOS</span><span style="font-weight: normal; font-size: 20px;">DIVORCE.FR</span>
              </h1>
              <p style="color: #93c5fd; margin: 10px 0 0 0; font-size: 14px;">Votre partenaire juridique en ligne</p>
            </td>
          </tr>

          <!-- Badge Expertise -->
          <tr>
            <td style="padding: 30px 30px 0 30px; text-align: center;">
              <span style="display: inline-block; background-color: ${isPremium ? '#f97316' : '#8b5cf6'}; color: white; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                ${expertiseName}
              </span>
            </td>
          </tr>

          <!-- Titre -->
          <tr>
            <td style="padding: 20px 30px; text-align: center;">
              <h2 style="color: #1e3a8a; margin: 0; font-size: 24px;">Analyse personnalisée</h2>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Récapitulatif de la consultation du client.</p>
            </td>
          </tr>

          <!-- Récapitulatif situation -->
          <tr>
            <td style="padding: 0 30px;">
              <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="color: #1e3a8a; margin: 0 0 15px 0; font-size: 18px;">Récapitulatif de la situation</h3>

                ${questionnaireData.enfants ? `
                <div style="margin-bottom: 10px;">
                  <strong style="color: #374151;">Enfants :</strong>
                  <span style="color: #6b7280;">${escapeHtml(questionnaireData.enfants)}</span>
                </div>
                ` : ''}

                ${questionnaireData.typeDivorce ? `
                <div style="margin-bottom: 10px;">
                  <strong style="color: #374151;">Type de divorce :</strong>
                  <span style="color: #6b7280;">${escapeHtml(questionnaireData.typeDivorce)}</span>
                </div>
                ` : ''}

                ${questionnaireData.urgence ? `
                <div style="margin-bottom: 10px;">
                  <strong style="color: #374151;">Urgence :</strong>
                  <span style="color: #6b7280;">${escapeHtml(questionnaireData.urgence)}</span>
                </div>
                ` : ''}

                ${questionnaireData.budget ? `
                <div style="margin-bottom: 10px;">
                  <strong style="color: #374151;">Budget :</strong>
                  <span style="color: #6b7280;">${escapeHtml(questionnaireData.budget)}</span>
                </div>
                ` : ''}

                ${questionnaireData.attentes ? `
                <div style="margin-bottom: 10px;">
                  <strong style="color: #374151;">Attentes :</strong>
                  <span style="color: #6b7280;">${escapeHtml(questionnaireData.attentes)}</span>
                </div>
                ` : ''}

                ${questionnaireData.commentaires ? `
                <div style="margin-bottom: 0;">
                  <strong style="color: #374151;">Commentaires personnels :</strong>
                  <p style="color: #6b7280; margin: 5px 0 0 0; font-style: italic;">"${escapeHtml(questionnaireData.commentaires)}"</p>
                </div>
                ` : ''}
              </div>
            </td>
          </tr>

          ${isPremium ? `
          <!-- Badge Premium -->
          <tr>
            <td style="padding: 0 30px;">
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
                <p style="color: #92400e; margin: 0; font-weight: 600;">
                  Votre analyse Premium sera validée par un avocat spécialisé sous 48h.
                </p>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Conversation complète -->
          <tr>
            <td style="padding: 0 30px;">
              <details style="margin-bottom: 20px;">
                <summary style="cursor: pointer; color: #1e3a8a; font-weight: 600; padding: 10px 0;">
                  Voir la conversation complète
                </summary>
                <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; margin-top: 10px; max-height: 400px; overflow-y: auto;">
                  ${messages.filter(m => !m.content.startsWith('[INIT]') && !m.content.includes('[PAIEMENT_PRET]')).map(m => `
                    <div style="margin-bottom: 15px; ${m.role === 'user' ? 'text-align: right;' : ''}">
                      <span style="display: inline-block; background-color: ${m.role === 'user' ? '#2563eb' : '#e5e7eb'}; color: ${m.role === 'user' ? 'white' : '#374151'}; padding: 10px 15px; border-radius: 12px; max-width: 80%; text-align: left;">
                        ${escapeHtml(m.content.replace(/\[CHOIX_OFFRE:[^\]]+\]/g, '').trim())}
                      </span>
                    </div>
                  `).join('')}
                </div>
              </details>
            </td>
          </tr>

          <!-- Paiement -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 15px; text-align: center;">
                <p style="color: #6b7280; margin: 0; font-size: 14px;">
                  Montant payé : <strong style="color: #1e3a8a;">${amountEuros} EUR</strong>
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 30px 30px 30px; text-align: center;">
              <p style="color: #6b7280; margin: 0 0 15px 0; font-size: 14px;">
                Des questions ? Besoin d'aide supplémentaire ?
              </p>
              <a href="https://sosdivorce.fr" style="display: inline-block; background-color: #1e3a8a; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Retourner sur sosdivorce.fr
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #1e3a8a; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="color: #93c5fd; margin: 0; font-size: 12px;">
                SOS Divorce - Conseil juridique en ligne<br>
                Cet email a été envoyé suite à votre consultation sur sosdivorce.fr
              </p>
              <p style="color: #60a5fa; margin: 10px 0 0 0; font-size: 11px;">
                <a href="https://sosdivorce.fr/mentions-legales.html" style="color: #60a5fa;">Mentions légales</a> |
                <a href="https://sosdivorce.fr/politique-confidentialite.html" style="color: #60a5fa;">Confidentialité</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Générer la version texte de l'email
 */
function generateAnalysisEmailText({ expertiseName, amountEuros, questionnaireData, clientEmail, paymentIntentId }) {
  return `
****************************************
* À VÉRIFIER ET ENVOYER AU CLIENT
* Email client : ${clientEmail}
* ID Paiement Stripe : ${paymentIntentId}
****************************************

SOS DIVORCE - ${expertiseName}
================================

Récapitulatif de la consultation du client.

RÉCAPITULATIF DE LA SITUATION
--------------------------------
${questionnaireData.enfants ? `Enfants : ${questionnaireData.enfants}` : ''}
${questionnaireData.typeDivorce ? `Type de divorce : ${questionnaireData.typeDivorce}` : ''}
${questionnaireData.urgence ? `Urgence : ${questionnaireData.urgence}` : ''}
${questionnaireData.budget ? `Budget : ${questionnaireData.budget}` : ''}
${questionnaireData.attentes ? `Attentes : ${questionnaireData.attentes}` : ''}
${questionnaireData.commentaires ? `Commentaires : "${questionnaireData.commentaires}"` : ''}

--------------------------------
Montant payé : ${amountEuros} EUR

--
SOS Divorce - Conseil juridique en ligne
  `.trim();
}

/**
 * Échapper les caractères HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Envoyer un email de confirmation de paiement simple
 */
export async function sendPaymentConfirmationEmail({ to, expertise, amount }) {
  const expertiseLabels = {
    classique: 'Analyse Express',
    premium: 'Analyse Premium validée avocat'
  };

  const expertiseName = expertiseLabels[expertise] || 'Analyse';
  const amountEuros = (amount / 100).toFixed(2);

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px;">
    <h1 style="color: #1e3a8a; text-align: center;">Paiement confirmé</h1>
    <p style="color: #374151; text-align: center;">
      Merci pour votre achat de <strong>${expertiseName}</strong> (${amountEuros} EUR).
    </p>
    <p style="color: #6b7280; text-align: center;">
      Votre analyse complète vous sera envoyée dans quelques instants.
    </p>
    <p style="text-align: center; margin-top: 30px;">
      <a href="https://sosdivorce.fr" style="background-color: #1e3a8a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
        Retour au site
      </a>
    </p>
  </div>
</body>
</html>
  `;

  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `Confirmation de paiement - ${expertiseName}`,
      html: htmlContent
    });

    return { success: true, emailId: result.id };
  } catch (error) {
    logger.error('Erreur envoi email confirmation:', error);
    throw error;
  }
}

export default {
  sendAnalysisEmail,
  sendPaymentConfirmationEmail
};
