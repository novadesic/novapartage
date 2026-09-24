const fs = require('fs');
const path = require('path');
const imageEmbedder = require('./imageEmbedder');
const textGenerator = require('./textGenerator');

/**
 * Service de gestion des templates d'emails
 */
class TemplateService {
  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'templates');
  }

  /**
   * Rend un template avec les variables fournies
   * @param {string} templateGroup - Groupe de templates (ex: "novapartage")
   * @param {string} templateName - Nom du template (ex: "login-link")
   * @param {Object} variables - Variables à remplacer
   * @param {Object} options - Options de rendu
   * @returns {Promise<Object>} { html, text, inlineAttachments, subject }
   */
  async renderTemplate(templateGroup, templateName, variables, options = {}) {
    // Charger le sous-template (contenu)
    const contentTemplate = await this.loadTemplate(templateGroup, templateName, 'html');
    const bodyContent = this.replaceVariables(contentTemplate, variables);

    // Charger le template de base et y injecter le contenu
    const baseTemplate = await this.loadTemplate(templateGroup, 'base', 'html');
    
    // Préparer les variables pour le base template
    const baseVariables = {
      title: options.title || this.generateTitle(templateName),
      headerGradient: options.headerGradient || this.getHeaderGradient(templateName),
      headerSubtitle: options.headerSubtitle || this.getHeaderSubtitle(templateName),
      bodyContent: bodyContent
    };

    let html = this.replaceVariables(baseTemplate, baseVariables);

    // Embed les images
    let inlineAttachments = [];
    const embedImages = options.embedImages !== false;
    const imageFormat = options.imageFormat || 'cid';

    if (embedImages && imageEmbedder.hasCidImages(html)) {
      const imageResult = await imageEmbedder.embedImages(html, templateGroup, imageFormat);
      html = imageResult.html;
      inlineAttachments = imageResult.attachments;
    }

    // Générer la version texte
    const textMode = options.textVersion || process.env.EMAIL_TEXT_VERSION || 'auto';
    const text = await textGenerator.generateText(
      templateGroup,
      templateName,
      variables,
      html,
      textMode
    );

    // Générer le sujet si non fourni
    const subject = options.subject || this.generateSubject(templateName, variables);

    return {
      html,
      text,
      inlineAttachments,
      subject
    };
  }

  /**
   * Charge un template depuis le système de fichiers
   * @param {string} templateGroup - Groupe de templates
   * @param {string} templateName - Nom du template
   * @param {string} extension - Extension du fichier ("html" ou "txt")
   * @returns {Promise<string>} Contenu du template
   */
  async loadTemplate(templateGroup, templateName, extension = 'html') {
    const templatePath = path.join(
      this.templatesDir,
      templateGroup,
      `${templateName}.${extension}`
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template non trouvé: ${templatePath}`);
    }

    return fs.promises.readFile(templatePath, 'utf8');
  }

  /**
   * Remplace les variables dans un template
   * @param {string} template - Template avec variables {{variable}}
   * @param {Object} variables - Variables à remplacer
   * @param {boolean} escapeHtml - Si true, échappe les valeurs HTML (défaut: true)
   * @returns {string} Template avec variables remplacées
   */
  replaceVariables(template, variables, escapeHtml = true) {
    let result = template;
    // Variables qui contiennent du HTML et ne doivent pas être échappées
    const htmlVariables = ['bodyContent', 'timeRemainingMessage'];
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      // Ne pas échapper les variables qui contiennent déjà du HTML
      const finalValue = (escapeHtml && !htmlVariables.includes(key)) 
        ? this.escapeHtml(String(value || ''))
        : String(value || '');
      result = result.replace(regex, finalValue);
    }
    return result;
  }

  /**
   * Échappe les caractères HTML pour éviter l'injection
   * @param {string} text - Texte à échapper
   * @returns {string} Texte échappé
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Génère un titre par défaut pour un template
   * @param {string} templateName - Nom du template
   * @returns {string} Titre généré
   */
  generateTitle(templateName) {
    const titles = {
      'login-link': 'Lien de connexion - NovaPartage',
      'verification-code': 'Code de vérification - NovaPartage',
      'manage-shares': 'Gérer vos partages - NovaPartage',
      'access-created': 'Accès à un partage NovaPartage',
      'access-validated': 'Partage validé - NovaPartage',
      'validation-notification': 'Partage validé - NovaPartage',
      'access-expiring': 'Expiration prochaine - NovaPartage'
    };

    return titles[templateName] || 'NovaPartage';
  }

  /**
   * Obtient le dégradé de header pour un template
   * @param {string} templateName - Nom du template
   * @returns {string} Dégradé CSS
   */
  getHeaderGradient(templateName) {
    const gradients = {
      'login-link': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'verification-code': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'manage-shares': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'access-created': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'access-validated': 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
      'validation-notification': 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
      'access-expiring': 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
    };

    return gradients[templateName] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }

  /**
   * Obtient le sous-titre de header pour un template
   * @param {string} templateName - Nom du template
   * @returns {string} Sous-titre
   */
  getHeaderSubtitle(templateName) {
    const subtitles = {
      'login-link': 'Connexion sécurisée',
      'verification-code': 'Vérification de votre email',
      'manage-shares': 'Gestion de vos partages',
      'access-created': 'Accès à un partage de données',
      'access-validated': '✅ Partage validé',
      'validation-notification': '✅ Partage validé',
      'access-expiring': '⏰ Expiration prochaine'
    };

    return subtitles[templateName] || 'NovaPartage';
  }

  /**
   * Génère un sujet par défaut pour un template
   * @param {string} templateName - Nom du template
   * @param {Object} variables - Variables disponibles
   * @returns {string} Sujet généré
   */
  generateSubject(templateName, variables) {
    const subjects = {
      'login-link': 'Lien de connexion NovaPartage',
      'verification-code': 'Code de vérification NovaPartage',
      'manage-shares': 'Connexion à NovaPartage - Gérer vos partages',
      'access-created': 'NovaPartage - Accès à un partage de données',
      'access-validated': 'NovaPartage - Validation confirmée',
      'validation-notification': 'NovaPartage - Partage validé',
      'access-expiring': 'NovaPartage - Accès à un partage de données - Expiration prochaine'
    };

    return subjects[templateName] || 'NovaPartage';
  }

  /**
   * Liste tous les templates disponibles dans un groupe
   * @param {string} templateGroup - Groupe de templates
   * @returns {Promise<Array>} Liste des templates
   */
  async listTemplates(templateGroup) {
    const groupDir = path.join(this.templatesDir, templateGroup);
    
    if (!fs.existsSync(groupDir)) {
      return [];
    }

    const files = await fs.promises.readdir(groupDir);
    const templates = new Set();

    for (const file of files) {
      if (file.endsWith('.html') && file !== 'base.html') {
        const templateName = file.replace('.html', '');
        templates.add(templateName);
      }
    }

    return Array.from(templates).map(name => ({
      name,
      description: this.getTemplateDescription(name),
      requiredVariables: this.getRequiredVariables(name),
      optionalVariables: this.getOptionalVariables(name)
    }));
  }

  /**
   * Obtient la description d'un template
   * @param {string} templateName - Nom du template
   * @returns {string} Description
   */
  getTemplateDescription(templateName) {
    const descriptions = {
      'login-link': 'Email de lien de connexion pour l\'authentification passwordless',
      'verification-code': 'Email contenant un code de vérification',
      'manage-shares': 'Email pour accéder à la gestion des partages',
      'access-created': 'Notification de création d\'accès à un partage',
      'access-validated': 'Confirmation de validation d\'accès au destinataire',
      'validation-notification': 'Notification au propriétaire après validation',
      'access-expiring': 'Notification d\'expiration prochaine d\'un accès'
    };
    return descriptions[templateName] || 'Template d\'email NovaPartage';
  }

  /**
   * Obtient les variables requises d'un template
   * @param {string} templateName - Nom du template
   * @returns {Array<string>} Variables requises
   */
  getRequiredVariables(templateName) {
    const variables = {
      'login-link': ['loginLink'],
      'verification-code': ['verificationCode'],
      'manage-shares': ['loginLink'],
      'access-created': ['recipientEmail', 'accessUrl', 'formName', 'ownerEmail', 'validityDays'],
      'access-validated': ['formName', 'fileName', 'recipientEmail', 'validatedBy', 'validatedDate', 'shareDetailUrl'],
      'validation-notification': ['formName', 'fileName', 'recipientEmail', 'validatedBy', 'validatedDate', 'shareDetailUrl'],
      'access-expiring': ['recipientEmail', 'accessUrl', 'formName', 'ownerEmail', 'expiresAtFormatted', 'timeRemainingMessage']
    };
    return variables[templateName] || [];
  }

  /**
   * Obtient les variables optionnelles d'un template
   * @param {string} templateName - Nom du template
   * @returns {Array<string>} Variables optionnelles
   */
  getOptionalVariables(templateName) {
    const variables = {
      'login-link': ['expirationTime'],
      'verification-code': ['expirationTime'],
      'manage-shares': ['expirationTime'],
      'access-created': ['validityDaysPlural'],
      'access-validated': [],
      'validation-notification': [],
      'access-expiring': []
    };
    return variables[templateName] || [];
  }
}

module.exports = new TemplateService();

