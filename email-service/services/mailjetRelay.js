const mailjet = require('node-mailjet');

/**
 * Envoie un email via Mailjet
 * @param {Object} emailData - Données de l'email (format Mailjet v3.1)
 * @param {Object} config - Configuration Mailjet
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function send(emailData, config) {
  const client = mailjet.apiConnect(config.apiKey, config.apiSecret);
  
  // Utiliser directement le format Mailjet v3.1
  const request = {
    Messages: emailData.Messages || [emailData]
  };

  // Si un expéditeur par défaut est configuré et non spécifié dans le message
  if (config.fromEmail) {
    if (!request.Messages[0].From) {
      request.Messages[0].From = {};
    }
    if (!request.Messages[0].From.Email) {
      request.Messages[0].From.Email = config.fromEmail;
    }
    if (config.fromName && !request.Messages[0].From.Name) {
      request.Messages[0].From.Name = config.fromName;
    }
  }

  const result = await client.post('send', { version: 'v3.1' }).request(request);
  
  // Extraire le messageId (peut être dans To[0].MessageID ou Messages[0].To[0].MessageID)
  let messageId = null;
  if (result.body && result.body.Messages && result.body.Messages[0]) {
    const firstMessage = result.body.Messages[0];
    if (firstMessage.To && firstMessage.To[0] && firstMessage.To[0].MessageID) {
      messageId = firstMessage.To[0].MessageID;
    } else if (firstMessage.MessageID) {
      messageId = firstMessage.MessageID;
    }
  }
  
  // Générer un ID si aucun n'est disponible
  if (!messageId) {
    messageId = `mj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  return {
    messageId: messageId,
    messages: result.body.Messages
  };
}

module.exports = {
  send
};

