/**
 * Utilitaires pour envoyer des exemples de templates au démarrage
 * (uniquement en mode développement avec mailhog/mailpit)
 */

const fs = require('fs');
const path = require('path');
// Imports dynamiques pour éviter les erreurs de chargement circulaire
let templateService;
let emailRelay;

function getTemplateService() {
  if (!templateService) {
    templateService = require('../services/templateService');
  }
  return templateService;
}

function getEmailRelay() {
  if (!emailRelay) {
    emailRelay = require('../services/emailRelay');
  }
  return emailRelay;
}

/**
 * Détecte si on est en mode développement (mailhog ou mailpit)
 */
function isDevelopmentMode() {
  const smtpHost = process.env.SMTP_HOST || '';
  const smtpPort = process.env.SMTP_PORT || '';
  
  // Vérifier si le host est mailhog ou mailpit
  const isDevHost = smtpHost.toLowerCase().includes('mailhog') || 
                    smtpHost.toLowerCase().includes('mailpit');
  
  // Vérifier si le port est 1025 (port standard de mailhog/mailpit)
  const isDevPort = smtpPort === '1025' || smtpPort === 1025;
  
  return isDevHost || isDevPort;
}

/**
 * Liste tous les templates disponibles dans un groupe
 */
function listTemplates(templateGroup) {
  const templatesDir = path.join(__dirname, '..', 'templates', templateGroup);
  
  if (!fs.existsSync(templatesDir)) {
    return [];
  }
  
  const files = fs.readdirSync(templatesDir);
  const templates = files
    .filter(file => file.endsWith('.html') && file !== 'base.html')
    .map(file => file.replace('.html', ''))
    .filter(name => {
      // Vérifier qu'il existe aussi un .txt (optionnel mais préférable)
      return true;
    });
  
  return templates;
}

/**
 * Génère des variables de démo pour un template
 */
function generateDemoVariables(templateName) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 jours
  
  const baseVars = {
    // Variables communes
    recipientEmail: 'developpeur@example.com',
    ownerEmail: 'proprietaire@example.com',
    formName: 'Exemple de partage de données',
    accessUrl: 'http://localhost/access/ExempleToken123',
    loginLink: 'http://localhost/login?email=developpeur@example.com&token=ExempleToken123',
    shareDetailUrl: 'http://localhost/shares/example-share-id',
    expiresAtFormatted: expiresAt.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    validatedDate: now.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    validatedBy: 'destinataire@example.com',
    fileName: 'exemple-fichier.xlsx',
    validityDays: '7',
    validityDaysPlural: 's',
    verificationCode: '123456',
    timeRemainingMessage: '<p style="margin: 5px 0; color: #ff9800; font-weight: bold; font-size: 16px;">⚠️ Il reste 3 jours avant l\'expiration</p>'
  };
  
  // Variables spécifiques par template
  const templateSpecificVars = {
    'access-created': {
      ...baseVars
    },
    'access-expiring': {
      ...baseVars
    },
    'access-validated': {
      ...baseVars
    },
    'login-link': {
      loginLink: baseVars.loginLink,
      expiresAtFormatted: baseVars.expiresAtFormatted
    },
    'verification-code': {
      verificationCode: baseVars.verificationCode,
      expiresAtFormatted: baseVars.expiresAtFormatted
    },
    'manage-shares': {
      loginLink: baseVars.loginLink,
      expiresAtFormatted: baseVars.expiresAtFormatted
    },
    'validation-notification': {
      ...baseVars
    }
  };
  
  return templateSpecificVars[templateName] || baseVars;
}

/**
 * Envoie un email exemple pour un template
 */
async function sendTemplateExample(templateGroup, templateName, testEmail) {
  try {
    const variables = generateDemoVariables(templateName);
    
    // Rendre le template
    const rendered = await getTemplateService().renderTemplate(
      templateGroup,
      templateName,
      variables,
      {
        subject: `[TEST] NovaPartage - Exemple: ${templateName}`,
        imageFormat: 'cid'
      }
    );
    
    // Préparer les données d'email au format Mailjet v3.1
    const emailData = {
      Messages: [
        {
          From: {
            Email: process.env.SMTP_FROM || 'no-reply@novapartage.fr',
            Name: 'NovaPartage (Test)'
          },
          To: [{ Email: testEmail }],
          Subject: rendered.subject,
          HTMLPart: rendered.html,
          TextPart: rendered.text || '',
          Attachments: rendered.inlineAttachments || []
        }
      ]
    };
    
    // Envoyer via le relais
    const result = await getEmailRelay().sendEmail(emailData, null);
    
    console.log(`  ✅ ${templateName} envoyé (messageId: ${result.messageId})`);
    return { success: true, templateName, messageId: result.messageId };
    
  } catch (error) {
    console.error(`  ❌ Erreur pour ${templateName}:`, error.message);
    return { success: false, templateName, error: error.message };
  }
}

/**
 * Envoie des exemples pour tous les templates disponibles
 */
async function sendAllTemplateExamples(templateGroup = 'novapartage', testEmail = null) {
  if (!isDevelopmentMode()) {
    console.log('[TEMPLATE-EXAMPLES] Mode développement non détecté, exemples non envoyés');
    return;
  }
  
  // Email de test par défaut
  const email = testEmail || process.env.TEST_EMAIL || 'test@example.com';
  
  console.log('[TEMPLATE-EXAMPLES] ========================================');
  console.log(`[TEMPLATE-EXAMPLES] Envoi d'exemples de templates à: ${email}`);
  console.log('[TEMPLATE-EXAMPLES] ========================================');
  
  const templates = listTemplates(templateGroup);
  
  if (templates.length === 0) {
    console.log('[TEMPLATE-EXAMPLES] Aucun template trouvé');
    return;
  }
  
  console.log(`[TEMPLATE-EXAMPLES] ${templates.length} template(s) trouvé(s): ${templates.join(', ')}`);
  console.log('[TEMPLATE-EXAMPLES] Envoi en cours...\n');
  
  const results = [];
  
  // Envoyer chaque template avec un petit délai pour éviter la surcharge
  for (const templateName of templates) {
    const result = await sendTemplateExample(templateGroup, templateName, email);
    results.push(result);
    
    // Petit délai entre les envois (500ms)
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log('\n[TEMPLATE-EXAMPLES] ========================================');
  console.log(`[TEMPLATE-EXAMPLES] Résumé: ${successCount} réussi(s), ${failCount} échec(s)`);
  console.log('[TEMPLATE-EXAMPLES] ========================================\n');
  
  return results;
}

module.exports = {
  isDevelopmentMode,
  listTemplates,
  generateDemoVariables,
  sendTemplateExample,
  sendAllTemplateExamples
};

