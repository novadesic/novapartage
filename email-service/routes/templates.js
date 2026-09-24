const express = require('express');
const router = express.Router();
const templateService = require('../services/templateService');
const emailRelay = require('../services/emailRelay');
const { parseSmtpFrom } = require('../utils/parseFrom');

/**
 * POST /v3.1/templates/:templateGroup/send
 * Envoie un email templaté
 */
router.post('/:templateGroup/send', async (req, res) => {
  try {
    const { templateGroup } = req.params;
    const { template, to, subject, variables = {}, options = {} } = req.body;

    // Validation
    if (!template) {
      return res.status(400).json({
        error: 'Template name is required',
        errorCode: 'MISSING_TEMPLATE_NAME',
        statusCode: 400
      });
    }

    if (!to) {
      return res.status(400).json({
        error: 'Recipient email is required',
        errorCode: 'MISSING_RECIPIENT',
        statusCode: 400
      });
    }

    // Rendre le template
    // CID pour les images (compatible Outlook, Gmail, etc.) - même format en dev et prod
    const renderOptions = {
      ...options,
      subject: subject || options.subject,
      imageFormat: options.imageFormat || 'cid'
    };
    
    const rendered = await templateService.renderTemplate(
      templateGroup,
      template,
      variables,
      renderOptions
    );

    // Préparer les données d'email au format Mailjet v3.1 - parser SMTP_FROM pour éviter From malformé
    const defaultFrom = parseSmtpFrom(process.env.SMTP_FROM || 'no-reply@novapartage.fr');
    const emailData = {
      Messages: [
        {
          From: options.from || {
            Email: defaultFrom.email,
            Name: defaultFrom.name
          },
          To: Array.isArray(to) 
            ? to.map(email => ({ Email: email }))
            : [{ Email: to }],
          Subject: rendered.subject,
          HTMLPart: rendered.html,
          TextPart: rendered.text || '',
          Attachments: rendered.inlineAttachments || []
        }
      ]
    };

    // Envoyer via le relais
    const relayName = req.query.relay || null;
    const result = await emailRelay.sendEmail(emailData, relayName);

    // Format de réponse
    res.status(200).json({
      status: 'success',
      messageId: result.messageId,
      template: template,
      templateGroup: templateGroup,
      processing: {
        imagesEmbedded: rendered.inlineAttachments?.length || 0,
        textVersion: rendered.text ? 'generated' : 'none',
        htmlSize: rendered.html.length,
        textSize: rendered.text?.length || 0
      },
      _metadata: {
        relay: result.relay,
        relayType: result.relayType,
        fallback: result.fallback || false
      }
    });

  } catch (error) {
    console.error('[TEMPLATES-API] Erreur:', error);

    // Gérer les erreurs spécifiques
    if (error.message.includes('Template non trouvé')) {
      return res.status(404).json({
        error: error.message,
        errorCode: 'TEMPLATE_NOT_FOUND',
        statusCode: 404
      });
    }

    if (error.message.includes('Variable')) {
      return res.status(400).json({
        error: error.message,
        errorCode: 'MISSING_REQUIRED_VARIABLE',
        statusCode: 400
      });
    }

    res.status(500).json({
      error: error.message || 'Erreur lors du rendu du template',
      errorCode: 'TEMPLATE_RENDER_ERROR',
      statusCode: 500
    });
  }
});

/**
 * GET /v3.1/templates/:templateGroup/list
 * Liste tous les templates disponibles dans un groupe
 */
router.get('/:templateGroup/list', async (req, res) => {
  try {
    const { templateGroup } = req.params;
    const templates = await templateService.listTemplates(templateGroup);

    res.json({
      templateGroup: templateGroup,
      templates: templates
    });
  } catch (error) {
    console.error('[TEMPLATES-API] Erreur lors de la liste:', error);
    res.status(500).json({
      error: error.message || 'Erreur lors de la récupération de la liste',
      errorCode: 'TEMPLATE_LIST_ERROR',
      statusCode: 500
    });
  }
});

/**
 * GET /v3.1/templates/:templateGroup/:templateName/preview
 * Prévisualise un template avec des données d'exemple
 */
router.get('/:templateGroup/:templateName/preview', async (req, res) => {
  try {
    const { templateGroup, templateName } = req.params;
    
    // Récupérer les variables d'exemple depuis query params (base64 JSON)
    let exampleVariables = {};
    if (req.query.variables) {
      try {
        exampleVariables = JSON.parse(Buffer.from(req.query.variables, 'base64').toString('utf8'));
      } catch (e) {
        // Ignorer si le parsing échoue
      }
    }

    // Générer des variables d'exemple si aucune fournie
    if (Object.keys(exampleVariables).length === 0) {
      exampleVariables = generateExampleVariables(templateName);
    }

    // Rendre le template
    const rendered = await templateService.renderTemplate(
      templateGroup,
      templateName,
      exampleVariables,
      {
        embedImages: false, // Pas besoin d'embed pour la prévisualisation
        textVersion: 'auto'
      }
    );

    res.json({
      template: templateName,
      templateGroup: templateGroup,
      variables: exampleVariables,
      html: rendered.html,
      text: rendered.text
    });

  } catch (error) {
    console.error('[TEMPLATES-API] Erreur lors de la prévisualisation:', error);
    
    if (error.message.includes('Template non trouvé')) {
      return res.status(404).json({
        error: error.message,
        errorCode: 'TEMPLATE_NOT_FOUND',
        statusCode: 404
      });
    }

    res.status(500).json({
      error: error.message || 'Erreur lors de la prévisualisation',
      errorCode: 'TEMPLATE_PREVIEW_ERROR',
      statusCode: 500
    });
  }
});

/**
 * Génère des variables d'exemple pour un template
 */
function generateExampleVariables(templateName) {
  const examples = {
    'login-link': {
      loginLink: 'https://novapartage.com/login?email=user@example.com&token=example-token'
    },
    'verification-code': {
      verificationCode: '123456'
    },
    'manage-shares': {
      loginLink: 'https://novapartage.com/login?token=example-token&email=user@example.com'
    },
    'access-created': {
      recipientEmail: 'recipient@example.com',
      accessUrl: 'https://novapartage.com/access/example-id',
      formName: 'Formulaire d\'exemple',
      ownerEmail: 'owner@example.com',
      validityDays: '7',
      validityDaysPlural: 's'
    },
    'access-validated': {
      formName: 'Formulaire d\'exemple',
      fileName: 'exemple.xlsx',
      recipientEmail: 'recipient@example.com',
      validatedBy: 'recipient@example.com',
      validatedDate: '01/01/2024 à 12:00',
      shareDetailUrl: 'https://novapartage.com/shares/example-id'
    },
    'validation-notification': {
      formName: 'Formulaire d\'exemple',
      fileName: 'exemple.xlsx',
      recipientEmail: 'recipient@example.com',
      validatedBy: 'recipient@example.com',
      validatedDate: '01/01/2024 à 12:00',
      shareDetailUrl: 'https://novapartage.com/shares/example-id'
    },
    'access-expiring': {
      recipientEmail: 'recipient@example.com',
      accessUrl: 'https://novapartage.com/access/example-id',
      formName: 'Formulaire d\'exemple',
      ownerEmail: 'owner@example.com',
      expiresAtFormatted: '01/01/2024 à 12:00',
      timeRemainingMessage: '<p style="margin: 5px 0; color: #ff9800; font-weight: bold; font-size: 16px;">⚠️ Il reste 2 jours avant l\'expiration</p>'
    }
  };

  return examples[templateName] || {};
}

module.exports = router;

