/**
 * Client pour le service email (email-service)
 * Remplace l'utilisation directe de nodemailer
 */

const http = require('http');

/**
 * Configuration du service email
 */
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://email-service:3002';
const EMAIL_SERVICE_TIMEOUT = parseInt(process.env.EMAIL_SERVICE_TIMEOUT || '10000');

/**
 * Envoie un email via le service email
 * @param {Object} options - Options de l'email
 * @param {string} options.from - Adresse expéditeur
 * @param {string|string[]} options.to - Adresse(s) destinataire(s)
 * @param {string} options.subject - Sujet de l'email
 * @param {string} options.html - Contenu HTML de l'email
 * @param {string} [options.text] - Contenu texte de l'email (optionnel)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendEmail(options) {
  const { from, to, subject, html, text } = options;

  // Normaliser les destinataires en tableau
  const toArray = Array.isArray(to) ? to : [to];
  
  // Parser SMTP_FROM si format "Name <email>" pour éviter en-tête From malformé (DKIM/DMARC)
  const smtpFrom = from || process.env.SMTP_FROM || 'no-reply@novapartage.fr';
  const match = smtpFrom.match(/^(.+?)\s+<([^>]+)>$/);
  const fromEmail = match ? match[2].trim() : (smtpFrom.includes('@') ? smtpFrom : 'no-reply@novapartage.fr');
  const fromName = match ? match[1].trim().replace(/^["']|["']$/g, '') : (process.env.SMTP_FROM_NAME || 'NovaPartage');
  
  // Format Mailjet v3.1 compatible avec email-service
  const emailData = {
    Messages: [
      {
        From: {
          Email: fromEmail,
          Name: fromName
        },
        To: toArray.map(email => ({
          Email: email,
          Name: email.split('@')[0]
        })),
        Subject: subject,
        HTMLPart: html,
        TextPart: text || html.replace(/<[^>]*>/g, '') // Extraire le texte si non fourni
      }
    ]
  };

  return new Promise((resolve, reject) => {
    const url = new URL(`${EMAIL_SERVICE_URL}/v3.1/send`);
    const postData = JSON.stringify(emailData);

    const options = {
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

    const req = http.request(options, (res) => {
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
              messageId: response.Messages?.[0]?.To?.[0]?.MessageID || 'unknown',
              response: response
            });
          } else {
            reject(new Error(response.ErrorMessage || `Email service returned status ${res.statusCode}`));
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

module.exports = {
  sendEmail
};

