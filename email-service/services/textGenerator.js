const fs = require('fs');
const path = require('path');
const { convert } = require('html-to-text');

/**
 * Service de génération de versions texte depuis HTML ou templates texte
 */
class TextGenerator {
  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'templates');
  }

  /**
   * Génère une version texte d'un email
   * @param {string} templateGroup - Groupe de templates (ex: "novapartage")
   * @param {string} templateName - Nom du template (ex: "login-link")
   * @param {Object} variables - Variables à remplacer
   * @param {string} htmlContent - Contenu HTML (pour fallback)
   * @param {string} mode - Mode de génération: "auto", "template", "html-to-text", "none"
   * @returns {Promise<string>} Version texte générée
   */
  async generateText(templateGroup, templateName, variables, htmlContent, mode = 'auto') {
    if (mode === 'none') {
      return '';
    }

    // Mode 1: Utiliser un template texte dédié
    if (mode === 'template' || mode === 'auto') {
      try {
        const textTemplate = await this.loadTextTemplate(templateGroup, templateName);
        return this.replaceVariables(textTemplate, variables);
      } catch (error) {
        // Si template texte n'existe pas et mode auto, fallback sur html-to-text
        if (mode === 'auto') {
          return this.generateFromHtml(htmlContent);
        }
        throw error;
      }
    }

    // Mode 2: Générer depuis HTML
    if (mode === 'html-to-text') {
      return this.generateFromHtml(htmlContent);
    }

    return '';
  }

  /**
   * Charge un template texte
   * @param {string} templateGroup - Groupe de templates
   * @param {string} templateName - Nom du template
   * @returns {Promise<string>} Contenu du template
   */
  async loadTextTemplate(templateGroup, templateName) {
    const templatePath = path.join(
      this.templatesDir,
      templateGroup,
      `${templateName}.txt`
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template texte non trouvé: ${templatePath}`);
    }

    return fs.promises.readFile(templatePath, 'utf8');
  }

  /**
   * Génère une version texte depuis du HTML
   * @param {string} html - Contenu HTML
   * @returns {string} Version texte
   */
  generateFromHtml(html) {
    return convert(html, {
      wordwrap: 80,
      preserveNewlines: true,
      selectors: [
        { selector: 'a', options: { ignoreHref: false } },
        { selector: 'img', format: 'skip' }
      ],
      format: {
        link: (elem, fn, options) => {
          const text = fn(elem.children, options);
          const href = elem.attribs?.href || '';
          if (href && href !== text) {
            return `${text} (${href})`;
          }
          return text;
        }
      }
    });
  }

  /**
   * Remplace les variables dans un template
   * @param {string} template - Template avec variables {{variable}}
   * @param {Object} variables - Variables à remplacer
   * @returns {string} Template avec variables remplacées
   */
  replaceVariables(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value || ''));
    }
    return result;
  }
}

module.exports = new TextGenerator();

