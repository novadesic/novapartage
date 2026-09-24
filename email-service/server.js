// Charger les variables d'environnement depuis .env si disponible
// Essayer d'abord depuis le répertoire parent (pour Docker Compose)
const path = require('path');
const fs = require('fs');
const rootEnvPath = path.join(__dirname, '../../.env');
const localEnvPath = path.join(__dirname, '../.env');

if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
  console.log('[EMAIL-SERVICE] Variables chargées depuis .env (racine)');
} else if (fs.existsSync(localEnvPath)) {
  require('dotenv').config({ path: localEnvPath });
  console.log('[EMAIL-SERVICE] Variables chargées depuis .env (local)');
} else {
  require('dotenv').config(); // Essayer le répertoire courant
  console.log('[EMAIL-SERVICE] Variables chargées depuis .env (courant) ou variables système');
}

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const emailRoutes = require('./routes/email');
const templateRoutes = require('./routes/templates');

const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/v3.1', emailRoutes);
app.use('/v3.1/templates', templateRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'email-service' });
});

// Démarrage du serveur
app.listen(PORT, HOST, async () => {
  console.log('[EMAIL-SERVICE] ========================================');
  console.log(`[EMAIL-SERVICE] Service d'envoi d'emails démarré`);
  console.log(`[EMAIL-SERVICE] Écoute sur ${HOST}:${PORT}`);
  console.log(`[EMAIL-SERVICE] API disponible sur /v3.1/send`);
  console.log(`[EMAIL-SERVICE] Templates API disponible sur /v3.1/templates/:group/send`);
  console.log('[EMAIL-SERVICE] ========================================');
  
  // Envoyer des exemples de templates en mode développement
  try {
    const templateExamples = require('./utils/templateExamples');
    if (templateExamples.isDevelopmentMode()) {
      // Attendre un peu que le service soit complètement démarré
      setTimeout(async () => {
        await templateExamples.sendAllTemplateExamples('novapartage');
      }, 2000);
    }
  } catch (error) {
    console.warn('[EMAIL-SERVICE] Impossible d\'envoyer les exemples de templates:', error.message);
  }
});

// Gestion des signaux
process.on('SIGTERM', () => {
  console.log('[EMAIL-SERVICE] Signal SIGTERM reçu, arrêt du service...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[EMAIL-SERVICE] Signal SIGINT reçu, arrêt du service...');
  process.exit(0);
});

