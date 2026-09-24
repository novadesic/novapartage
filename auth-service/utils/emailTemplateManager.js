const fs = require('fs');
const path = require('path');

/**
 * Gestionnaire de templates d'email pour auth-service
 */
class EmailTemplateManager {
  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'templates');
  }

  /**
   * Charge un template HTML depuis le fichier
   * @param {string} templateFile Nom du fichier de template
   * @param {Object} variables Variables à remplacer dans le template
   * @returns {string} HTML généré
   */
  loadTemplate(templateFile, variables = {}) {
    try {
      const templatePath = path.join(this.templatesDir, templateFile);
      let template = fs.readFileSync(templatePath, 'utf8');
      
      // Remplacer les variables {{variable}}
      for (const [key, value] of Object.entries(variables)) {
        template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
      
      return template;
    } catch (error) {
      console.error(`❌ Erreur lors du chargement du template: ${templateFile}`, error);
      throw new Error(`Template non trouvé ou invalide: ${templateFile}`);
    }
  }

  /**
   * Génère un email complet à partir du template de base avec un contenu spécifique
   * @param {string} contentTemplateFile Nom du fichier de contenu (dans templates/)
   * @param {string} title Titre de l'email
   * @param {string} headerGradient Dégradé du header (ex: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)")
   * @param {string} headerSubtitle Sous-titre du header
   * @param {Object} contentVariables Variables pour le contenu
   * @returns {string} HTML complet
   */
  generateEmail(contentTemplateFile, title, headerGradient, headerSubtitle, contentVariables = {}) {
    try {
      // Charger le contenu
      const bodyContent = this.loadTemplate(contentTemplateFile, contentVariables);
      
      // Charger le template de base et y insérer le contenu
      const fullHTML = this.loadTemplate('base.html', {
        title,
        headerGradient,
        headerSubtitle,
        bodyContent
      });
      
      return fullHTML;
    } catch (error) {
      console.error(`❌ Erreur lors de la génération de l'email: ${contentTemplateFile}`, error);
      throw error;
    }
  }

  /**
   * Génère l'email de lien de connexion
   * @param {string} loginLink Lien de connexion
   * @returns {string} HTML de l'email
   */
  generateLoginLinkEmail(loginLink) {
    return this.generateEmail(
      'login-link.html',
      'Lien de connexion - NovaPartage',
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'Connexion sécurisée',
      { loginLink }
    );
  }

  /**
   * Génère l'email de code de vérification
   * @param {string} verificationCode Code de vérification
   * @returns {string} HTML de l'email
   */
  generateVerificationCodeEmail(verificationCode) {
    return this.generateEmail(
      'verification-code.html',
      'Code de vérification - NovaPartage',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'Vérification de votre email',
      { verificationCode }
    );
  }

  /**
   * Génère l'email de gestion des partages
   * @param {string} loginLink Lien de connexion
   * @returns {string} HTML de l'email
   */
  generateManageSharesEmail(loginLink) {
    return this.generateEmail(
      'manage-shares.html',
      'Gérer vos partages - NovaPartage',
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'Gestion de vos partages',
      { loginLink }
    );
  }
}

module.exports = new EmailTemplateManager();

