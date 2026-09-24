const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

/**
 * Service d'embedding d'images dans les emails
 */
class ImageEmbedder {
  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'templates');
  }

  /**
   * Embed les images référencées via CID dans le HTML
   * @param {string} html - Contenu HTML
   * @param {string} templateGroup - Groupe de templates (ex: "novapartage")
   * @param {string} format - Format d'embedding: "cid" ou "base64"
   * @returns {Promise<Object>} { html, attachments }
   */
  async embedImages(html, templateGroup, format = 'cid') {
    const assetsDir = path.join(this.templatesDir, templateGroup, 'assets');
    const cidRegex = /src=["']cid:([^"']+)["']/g;
    const attachments = [];
    let processedHtml = html;
    let match;
    const processedCids = new Set();

    while ((match = cidRegex.exec(html)) !== null) {
      const cid = match[1]; // ex: "logo@novapartage"
      const imageName = cid.split('@')[0]; // ex: "logo"
      
      // Éviter de traiter le même CID plusieurs fois
      if (processedCids.has(cid)) {
        continue;
      }
      processedCids.add(cid);

      // Chercher l'image avec différentes extensions
      // Pour logo@novapartage, prioriser .png (Outlook ne supporte pas SVG)
      // Pour background@novapartage, prioriser .jpg
      const extensions = (cid === 'logo@novapartage') 
        ? ['.png', '.jpg', '.jpeg', '.gif', '.svg']
        : (cid === 'background@novapartage')
        ? ['.jpg', '.jpeg', '.png', '.gif']
        : ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
      let imagePath = null;
      let imageBuffer = null;
      let contentType = null;

      // Liste des noms possibles à essayer
      // Pour logo@novapartage, chercher logo.png ou NovaPartage.png en priorité
      // Pour background@novapartage, chercher background.jpg
      const possibleNames = cid === 'logo@novapartage' 
        ? [imageName, 'NovaPartage', imageName.charAt(0).toUpperCase() + imageName.slice(1), imageName.toUpperCase()]
        : cid === 'background@novapartage'
        ? ['background', imageName, imageName.charAt(0).toUpperCase() + imageName.slice(1)]
        : [imageName, imageName.charAt(0).toUpperCase() + imageName.slice(1), imageName.toUpperCase(), 'NovaPartage'];

      for (const name of possibleNames) {
        for (const ext of extensions) {
          const candidatePath = path.join(assetsDir, name + ext);
          if (fs.existsSync(candidatePath)) {
            imagePath = candidatePath;
            imageBuffer = fs.readFileSync(candidatePath);
            contentType = mime.lookup(candidatePath) || (ext === '.svg' ? 'image/svg+xml' : 'image/png');
            break;
          }
        }
        if (imagePath) break;
      }

      if (!imagePath || !imageBuffer) {
        console.warn(`[IMAGE-EMBEDDER] Image non trouvée pour CID: ${cid}`);
        continue;
      }

      if (format === 'cid') {
        // Attacher comme pièce jointe inline avec Content-ID
        attachments.push({
          Filename: imageName + path.extname(imagePath),
          ContentType: contentType,
          ContentID: `<${cid}>`,
          Base64Content: imageBuffer.toString('base64'),
          Disposition: 'inline'
        });
        // Le HTML garde le cid: qui sera résolu par le client email
      } else if (format === 'base64') {
        // Convertir en base64 inline
        const base64 = imageBuffer.toString('base64');
        const dataUri = `data:${contentType};base64,${base64}`;
        processedHtml = processedHtml.replace(
          new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
          dataUri
        );
      }
    }

    return {
      html: processedHtml,
      attachments
    };
  }

  /**
   * Vérifie si des images CID sont présentes dans le HTML
   * @param {string} html - Contenu HTML
   * @returns {boolean} True si des images CID sont présentes
   */
  hasCidImages(html) {
    return /src=["']cid:[^"']+["']/.test(html);
  }
}

module.exports = new ImageEmbedder();

