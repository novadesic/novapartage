const crypto = require('crypto');

/**
 * Anonymise un email en gardant seulement le domaine
 * @param {string} email - Email à anonymiser
 * @returns {string} Email anonymisé (hash@domain)
 */
function anonymizeEmail(email) {
  if (!email || !email.includes('@')) {
    return 'anonymous';
  }
  
  const [local, domain] = email.split('@');
  const localHash = crypto.createHash('sha256').update(local).digest('hex').substring(0, 8);
  return `${localHash}@${domain}`;
}

/**
 * Anonymise un nom d'utilisateur
 * @param {string} username - Nom d'utilisateur à anonymiser
 * @returns {string} Username anonymisé (user_xxxxxxxx)
 */
function anonymizeUsername(username) {
  if (!username) {
    return 'anonymous';
  }
  const hash = crypto.createHash('sha256').update(username).digest('hex').substring(0, 8);
  return `user_${hash}`;
}

/**
 * Anonymise un nom de fichier en gardant seulement l'extension
 * @param {string} filename - Nom de fichier à anonymiser
 * @returns {string} Nom de fichier anonymisé (hash.ext)
 */
function anonymizeFilename(filename) {
  if (!filename) {
    return 'unknown';
  }
  const path = require('path');
  const ext = path.extname(filename);
  const name = filename.replace(ext, '');
  const hash = crypto.createHash('sha256').update(name).digest('hex').substring(0, 8);
  return `${hash}${ext}`;
}

module.exports = {
  anonymizeEmail,
  anonymizeUsername,
  anonymizeFilename
};

