/**
 * Parse SMTP_FROM au format "Name <email@domain.com>" pour extraire email et nom.
 * Évite les en-têtes From malformés qui causent des échecs DKIM/DMARC.
 *
 * @param {string} smtpFrom - Valeur de SMTP_FROM (ex: "NovaPartage <no-reply@novapartage.fr>")
 * @returns {{ email: string, name: string }}
 */
function parseSmtpFrom(smtpFrom) {
  if (!smtpFrom || typeof smtpFrom !== 'string') {
    return { email: 'no-reply@novapartage.fr', name: 'NovaPartage' };
  }
  const trimmed = smtpFrom.trim();
  // Format "Name <email@domain.com>" ou "email@domain.com"
  const match = trimmed.match(/^(.+?)\s+<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, '');
    const email = match[2].trim();
    return { email, name: name || 'NovaPartage' };
  }
  // Simple email sans nom
  if (trimmed.includes('@')) {
    return { email: trimmed, name: 'NovaPartage' };
  }
  return { email: 'no-reply@novapartage.fr', name: trimmed || 'NovaPartage' };
}

module.exports = { parseSmtpFrom };
