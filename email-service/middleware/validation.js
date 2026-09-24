/**
 * Valide la requête d'envoi d'email (format Mailjet v3.1)
 */
function validateEmailRequest(req, res, next) {
  const body = req.body;
  
  // Vérifier la structure de base
  if (!body.Messages && !body.From) {
    return res.status(400).json({
      ErrorMessage: 'Le format de la requête est invalide. Attendu: { Messages: [...] } ou format simplifié',
      ErrorIdentifier: 'INVALID_REQUEST_FORMAT',
      StatusCode: 400
    });
  }

  // Normaliser le format (supporter les deux formats)
  if (!body.Messages) {
    req.body = { Messages: [body] };
  }

  const messages = req.body.Messages;
  
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      ErrorMessage: 'Messages doit être un tableau non vide',
      ErrorIdentifier: 'INVALID_MESSAGES_ARRAY',
      StatusCode: 400
    });
  }

  // Valider chaque message
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    if (!msg.From || !msg.From.Email) {
      return res.status(400).json({
        ErrorMessage: `Message ${i}: From.Email est requis`,
        ErrorIdentifier: 'MISSING_FROM_EMAIL',
        StatusCode: 400
      });
    }

    if (!msg.To || !Array.isArray(msg.To) || msg.To.length === 0) {
      return res.status(400).json({
        ErrorMessage: `Message ${i}: To doit être un tableau non vide`,
        ErrorIdentifier: 'MISSING_TO_RECIPIENTS',
        StatusCode: 400
      });
    }

    // Valider les destinataires
    for (const to of msg.To) {
      if (!to.Email) {
        return res.status(400).json({
          ErrorMessage: `Message ${i}: Tous les destinataires doivent avoir un Email`,
          ErrorIdentifier: 'INVALID_RECIPIENT_EMAIL',
          StatusCode: 400
        });
      }
    }

    if (!msg.Subject && !msg.TextPart && !msg.HTMLPart) {
      return res.status(400).json({
        ErrorMessage: `Message ${i}: Au moins Subject, TextPart ou HTMLPart doit être fourni`,
        ErrorIdentifier: 'MISSING_MESSAGE_CONTENT',
        StatusCode: 400
      });
    }
  }

  next();
}

module.exports = {
  validateEmailRequest
};

