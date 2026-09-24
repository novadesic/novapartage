/**
 * Configuration des relais d'envoi d'email
 * Supporte plusieurs relais configurés via variables d'environnement
 */

// Debug: Afficher les variables SMTP pour diagnostic
console.log('[EMAIL-RELAYS] Variables d\'environnement SMTP:');
console.log(`  SMTP_ENABLED=${process.env.SMTP_ENABLED}`);
console.log(`  SMTP_HOST=${process.env.SMTP_HOST}`);
console.log(`  SMTP_PORT=${process.env.SMTP_PORT}`);
console.log(`  SMTP_FROM=${process.env.SMTP_FROM}`);

const relays = [];

// Helper pour vérifier si SMTP est activé
// Active par défaut si SMTP_HOST est défini (rétrocompatibilité)
const isSmtpEnabled = () => {
  if (process.env.SMTP_ENABLED === 'true') return true;
  if (process.env.SMTP_ENABLED === 'false') return false;
  // Par défaut, activer si SMTP_HOST est défini (pour rétrocompatibilité)
  return !!process.env.SMTP_HOST;
};

// Relais SMTP
if (isSmtpEnabled()) {
  if (!process.env.SMTP_HOST) {
    console.warn('[EMAIL-RELAYS] SMTP_ENABLED=true mais SMTP_HOST n\'est pas défini. SMTP désactivé.');
  } else {
    relays.push({
      type: 'smtp',
      name: process.env.SMTP_NAME || 'smtp-default',
      priority: parseInt(process.env.SMTP_PRIORITY || '10'),
      config: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        ignoreTLS: process.env.SMTP_IGNORE_TLS === 'true',
        requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
        tls: {
          rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true'
        },
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        } : null,
        from: process.env.SMTP_FROM
      }
    });
    console.log(`[EMAIL-RELAYS] Relais SMTP configuré: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || '587'}`);
  }
}

// Relais Mailjet
if (process.env.MAILJET_ENABLED === 'true') {
  relays.push({
    type: 'mailjet',
    name: process.env.MAILJET_NAME || 'mailjet-default',
    priority: parseInt(process.env.MAILJET_PRIORITY || '5'),
    config: {
      apiKey: process.env.MAILJET_API_KEY,
      apiSecret: process.env.MAILJET_API_SECRET,
      fromEmail: process.env.MAILJET_FROM_EMAIL,
      fromName: process.env.MAILJET_FROM_NAME
    }
  });
}

// Trier par priorité (plus bas = priorité plus élevée)
relays.sort((a, b) => a.priority - b.priority);

// Log de la configuration au démarrage
if (relays.length === 0) {
  console.warn('[EMAIL-RELAYS] ⚠️  Aucun relais d\'envoi configuré!');
  console.warn('[EMAIL-RELAYS] Pour activer SMTP, définissez SMTP_ENABLED=true et SMTP_HOST dans les variables d\'environnement.');
  console.warn('[EMAIL-RELAYS] Pour activer Mailjet, définissez MAILJET_ENABLED=true et les clés API dans les variables d\'environnement.');
} else {
  console.log(`[EMAIL-RELAYS] ✅ ${relays.length} relais configuré(s): ${relays.map(r => r.name).join(', ')}`);
}

/**
 * Récupère le relais par défaut (celui avec la priorité la plus élevée)
 */
function getDefaultRelay() {
  return relays.length > 0 ? relays[0] : null;
}

/**
 * Récupère un relais par son nom
 */
function getRelayByName(name) {
  return relays.find(r => r.name === name) || getDefaultRelay();
}

/**
 * Récupère tous les relais disponibles
 */
function getAllRelays() {
  return relays;
}

module.exports = {
  getDefaultRelay,
  getRelayByName,
  getAllRelays
};

