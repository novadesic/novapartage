const nodemailer = require('nodemailer');

// Configuration SMTP
const emailConfig = {
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT) || 1025,
  secure: process.env.SMTP_SECURE === 'true',
  ignoreTLS: process.env.SMTP_IGNORE_TLS === 'true',
  requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
  tls: {
    rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true'
  },
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : null
};

const SMTP_FROM = process.env.SMTP_FROM || 'NovaPartage <no-reply@novapartage.fr>';
const EMAIL_TO = process.env.MONITORING_EMAIL_TO || 'contact@novadesic.com';

const transporter = nodemailer.createTransport(emailConfig);

/**
 * Envoie le rapport par email avec le CSV en pièce jointe
 * @param {string} htmlContent - Contenu HTML du rapport
 * @param {string} csvContent - Contenu CSV du rapport
 * @returns {Promise<void>}
 */
async function sendReport(htmlContent, csvContent) {
  const reportDate = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  const mailOptions = {
    from: SMTP_FROM,
    to: EMAIL_TO,
    subject: `Rapport de Monitoring DDShare - ${reportDate}`,
    html: htmlContent,
    attachments: [
      {
        filename: `monitoring_report_${timestamp}.csv`,
        content: csvContent,
        contentType: 'text/csv'
      }
    ]
  };
  
  try {
    console.log('[EMAIL] Envoi du rapport...');
    console.log(`[EMAIL] De: ${SMTP_FROM}`);
    console.log(`[EMAIL] À: ${EMAIL_TO}`);
    console.log(`[EMAIL] Sujet: ${mailOptions.subject}`);
    
    const info = await transporter.sendMail(mailOptions);
    console.log('[EMAIL] Email envoyé avec succès:', info.messageId);
  } catch (error) {
    console.error('[EMAIL] Erreur lors de l\'envoi de l\'email:', error);
    throw error;
  }
}

module.exports = {
  sendReport
};

