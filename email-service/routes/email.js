const express = require('express');
const router = express.Router();
const emailRelay = require('../services/emailRelay');
const { validateEmailRequest } = require('../middleware/validation');

/**
 * POST /v3.1/send
 * Envoie un email (format Mailjet v3.1)
 * 
 * Body:
 * {
 *   "Messages": [
 *     {
 *       "From": { "Email": "sender@example.com", "Name": "Sender Name" },
 *       "To": [{ "Email": "recipient@example.com", "Name": "Recipient Name" }],
 *       "Subject": "Subject",
 *       "TextPart": "Text content",
 *       "HTMLPart": "<h1>HTML content</h1>",
 *       "Attachments": [...]
 *     }
 *   ]
 * }
 * 
 * Query params:
 * - relay: nom du relais à utiliser (optionnel)
 */
router.post('/send', validateEmailRequest, async (req, res) => {
  try {
    const relayName = req.query.relay || null;
    const emailData = req.body;
    
    console.log('[EMAIL-API] Requête d\'envoi reçue');
    console.log(`[EMAIL-API] Relais demandé: ${relayName || 'défaut'}`);
    
    const result = await emailRelay.sendEmail(emailData, relayName);
    
    // Format de réponse compatible Mailjet v3.1
    res.status(200).json({
      Messages: [
        {
          Status: 'success',
          CustomID: emailData.Messages?.[0]?.CustomID || '',
          To: emailData.Messages?.[0]?.To?.map(t => ({
            Email: t.Email,
            MessageUUID: result.messageId,
            MessageID: result.messageId,
            MessageHref: `https://api.mailjet.com/v3/REST/message/${result.messageId}`
          })) || [],
          Cc: emailData.Messages?.[0]?.Cc?.map(c => ({
            Email: c.Email,
            MessageUUID: result.messageId,
            MessageID: result.messageId
          })) || [],
          Bcc: emailData.Messages?.[0]?.Bcc?.map(b => ({
            Email: b.Email,
            MessageUUID: result.messageId,
            MessageID: result.messageId
          })) || []
        }
      ],
      _metadata: {
        relay: result.relay,
        relayType: result.relayType,
        fallback: result.fallback || false
      }
    });
  } catch (error) {
    console.error('[EMAIL-API] Erreur lors de l\'envoi:', error);
    
    res.status(500).json({
      ErrorMessage: error.message || 'Erreur lors de l\'envoi de l\'email',
      ErrorIdentifier: error.code || 'EMAIL_SEND_ERROR',
      StatusCode: 500
    });
  }
});

/**
 * GET /v3.1/relays
 * Liste les relais disponibles
 */
router.get('/relays', (req, res) => {
  const { getAllRelays } = require('../config/emailRelays');
  const relays = getAllRelays();
  
  res.json({
    relays: relays.map(r => ({
      name: r.name,
      type: r.type,
      priority: r.priority,
      enabled: true
    }))
  });
});

module.exports = router;

