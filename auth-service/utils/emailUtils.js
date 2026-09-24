/**
 * Utilitaires pour la gestion des emails
 */

/**
 * Normalise un email en le convertissant en minuscules
 * Cela permet d'éviter les problèmes de comptes dupliqués dus à des erreurs de frappe
 * @param {string} email - Email à normaliser
 * @returns {string} Email normalisé en minuscules
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return email;
  }
  return email.toLowerCase().trim();
}

module.exports = {
  normalizeEmail
};





























