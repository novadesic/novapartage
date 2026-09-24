const smtpRelay = require('./smtpRelay');
const mailjetRelay = require('./mailjetRelay');
const { getDefaultRelay, getRelayByName } = require('../config/emailRelays');

/**
 * Envoie un email via le relais approprié
 * @param {Object} emailData - Données de l'email (format Mailjet v3.1)
 * @param {string} relayName - Nom du relais à utiliser (optionnel)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendEmail(emailData, relayName = null) {
  const relay = relayName ? getRelayByName(relayName) : getDefaultRelay();
  
  if (!relay) {
    throw new Error('Aucun relais d\'envoi configuré');
  }

  console.log(`[EMAIL-RELAY] Utilisation du relais: ${relay.name} (${relay.type})`);

  try {
    let result;
    
    switch (relay.type) {
      case 'smtp':
        result = await smtpRelay.send(emailData, relay.config);
        break;
      case 'mailjet':
        result = await mailjetRelay.send(emailData, relay.config);
        break;
      default:
        throw new Error(`Type de relais non supporté: ${relay.type}`);
    }

    return {
      success: true,
      relay: relay.name,
      relayType: relay.type,
      messageId: result.messageId,
      data: result
    };
  } catch (error) {
    console.error(`[EMAIL-RELAY] Erreur avec le relais ${relay.name}:`, error);
    
    // Si le relais par défaut échoue, essayer les autres relais en fallback
    if (!relayName) {
      const allRelays = require('../config/emailRelays').getAllRelays();
      const otherRelays = allRelays.filter(r => r.name !== relay.name);
      
      for (const fallbackRelay of otherRelays) {
        try {
          console.log(`[EMAIL-RELAY] Tentative avec relais de secours: ${fallbackRelay.name}`);
          let fallbackResult;
          
          switch (fallbackRelay.type) {
            case 'smtp':
              fallbackResult = await smtpRelay.send(emailData, fallbackRelay.config);
              break;
            case 'mailjet':
              fallbackResult = await mailjetRelay.send(emailData, fallbackRelay.config);
              break;
          }
          
          return {
            success: true,
            relay: fallbackRelay.name,
            relayType: fallbackRelay.type,
            messageId: fallbackResult.messageId,
            data: fallbackResult,
            fallback: true,
            originalError: error.message
          };
        } catch (fallbackError) {
          console.error(`[EMAIL-RELAY] Échec du relais de secours ${fallbackRelay.name}:`, fallbackError);
        }
      }
    }
    
    throw error;
  }
}

module.exports = {
  sendEmail
};

