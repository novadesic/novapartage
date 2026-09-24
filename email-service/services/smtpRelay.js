const nodemailer = require('nodemailer');
const { parseSmtpFrom } = require('../utils/parseFrom');

/**
 * Envoie un email via SMTP
 * @param {Object} emailData - Données de l'email (format Mailjet v3.1)
 * @param {Object} config - Configuration SMTP
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function send(emailData, config) {
  // Convertir le format Mailjet v3.1 vers le format nodemailer
  const messages = emailData.Messages || [emailData];
  const message = messages[0];
  
  // Parser config.from si format "Name <email>" pour éviter en-tête From malformé (échec DKIM/DMARC)
  const defaultFrom = parseSmtpFrom(config.from);
  const msgFrom = message.From || { Email: config.from, Name: config.fromName || '' };
  const fromEmail = msgFrom.Email && msgFrom.Email.includes('@') && !msgFrom.Email.includes('<')
    ? msgFrom.Email
    : parseSmtpFrom(msgFrom.Email || config.from).email;
  const fromName = msgFrom.Name || defaultFrom.name;

  const to = message.To || [];
  const cc = message.Cc || [];
  const bcc = message.Bcc || [];
  const subject = message.Subject || '';
  const htmlPart = message.HTMLPart || '';
  const textPart = message.TextPart || '';
  const attachments = message.Attachments || [];

  // Créer le transporteur SMTP
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ignoreTLS: config.ignoreTLS,
    requireTLS: config.requireTLS,
    tls: config.tls,
    auth: config.auth,
    // Options d'encodage
    defaultEncoding: 'utf8'
  });

  // Préparer les options d'envoi - From doit être "Name" <email> pour DKIM/DMARC
  const mailOptions = {
    from: fromName ? `"${fromName.replace(/"/g, '')}" <${fromEmail}>` : fromEmail,
    to: to.map(t => t.Email).join(', '),
    subject: subject,
    text: textPart || undefined,
    html: htmlPart || undefined
  };

  // Ajouter CC si présent
  if (cc.length > 0) {
    mailOptions.cc = cc.map(c => c.Email).join(', ');
  }

  // Ajouter BCC si présent
  if (bcc.length > 0) {
    mailOptions.bcc = bcc.map(b => b.Email).join(', ');
  }

  // Ajouter les pièces jointes
  if (attachments.length > 0) {
    mailOptions.attachments = attachments.map(att => {
      const attachment = {
      filename: att.Filename,
      content: att.Base64Content ? Buffer.from(att.Base64Content, 'base64') : att.Content,
      contentType: att.ContentType || undefined
      };
      
      // Gérer les pièces jointes inline (CID)
      if (att.ContentID) {
        attachment.cid = att.ContentID.replace(/[<>]/g, ''); // Enlever les < > du CID
      }
      
      // Gérer la disposition (inline ou attachment)
      if (att.Disposition === 'inline') {
        attachment.contentDisposition = 'inline';
      }
      
      return attachment;
    });
  }

  // Envoyer l'email avec nodemailer standard
  // Cela devrait utiliser quoted-printable comme l'ancien système
  const info = await transporter.sendMail(mailOptions);
  
  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected
  };
}

module.exports = {
  send
};

