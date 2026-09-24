/**
 * Client pour envoyer des emails templatés via email-service
 */

const http = require('http');

/**
 * Configuration du service email
 */
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://email-service:3002';
const EMAIL_SERVICE_TIMEOUT = parseInt(process.env.EMAIL_SERVICE_TIMEOUT || '10000');

/**
 * Envoie un email templaté via le service email
 * @param {Object} options - Options de l'email
 * @param {string} options.template - Nom du template (ex: "login-link")
 * @param {string|string[]} options.to - Adresse(s) destinataire(s)
 * @param {string} [options.subject] - Sujet de l'email (optionnel, généré automatiquement si non fourni)
 * @param {Object} options.variables - Variables pour le template
 * @param {Object} [options.emailOptions] - Options supplémentaires (embedImages, textVersion, etc.)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendTemplatedEmail(options) {
  const { template, to, subject, variables = {}, emailOptions = {} } = options;

  if (!template) {
    throw new Error('Template name is required');
  }

  if (!to) {
    throw new Error('Recipient email is required');
  }

  const requestData = {
    template: template,
    to: to,
    subject: subject,
    variables: variables,
    options: emailOptions
  };

  return new Promise((resolve, reject) => {
    const url = new URL(`${EMAIL_SERVICE_URL}/v3.1/templates/novapartage/send`);
    const postData = JSON.stringify(requestData);

    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: EMAIL_SERVICE_TIMEOUT
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              messageId: response.messageId,
              template: response.template,
              response: response
            });
          } else {
            reject(new Error(response.error || `Email service returned status ${res.statusCode}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse email service response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Email service request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Email service request timeout after ${EMAIL_SERVICE_TIMEOUT}ms`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Envoie un email de lien de connexion
 * @param {string} to - Email du destinataire
 * @param {string} loginLink - Lien de connexion
 * @param {number} expiresAt - Timestamp d'expiration (milliseconds)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendLoginLinkEmail(to, loginLink, expiresAt) {
  // Formater la date d'expiration
  const expiresAtDate = new Date(expiresAt);
  const expiresAtFormatted = expiresAtDate.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return sendTemplatedEmail({
    template: 'login-link',
    to: to,
    variables: {
      loginLink: loginLink,
      expiresAtFormatted: expiresAtFormatted
    }
  });
}

/**
 * Envoie un email de code de vérification
 * @param {string} to - Email du destinataire
 * @param {string} verificationCode - Code de vérification
 * @param {number} expiresAt - Timestamp d'expiration (milliseconds)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendVerificationCodeEmail(to, verificationCode, expiresAt) {
  // Formater la date d'expiration
  const expiresAtDate = new Date(expiresAt);
  const expiresAtFormatted = expiresAtDate.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return sendTemplatedEmail({
    template: 'verification-code',
    to: to,
    variables: {
      verificationCode: verificationCode,
      expiresAtFormatted: expiresAtFormatted
    }
  });
}

/**
 * Envoie un email de gestion des partages
 * @param {string} to - Email du destinataire
 * @param {string} loginLink - Lien de connexion pour gérer les partages
 * @param {number} expiresAt - Timestamp d'expiration (milliseconds)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendManageSharesEmail(to, loginLink, expiresAt) {
  // Formater la date d'expiration
  const expiresAtDate = new Date(expiresAt);
  const expiresAtFormatted = expiresAtDate.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return sendTemplatedEmail({
    template: 'manage-shares',
    to: to,
    variables: {
      loginLink: loginLink,
      expiresAtFormatted: expiresAtFormatted
    }
  });
}

module.exports = {
  sendTemplatedEmail,
  sendLoginLinkEmail,
  sendVerificationCodeEmail,
  sendManageSharesEmail
};

