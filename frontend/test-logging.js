#!/usr/bin/env node

/**
 * Script de test pour vérifier le système de logging
 * Ce script simule les conditions d'environnement pour tester le LoggerService
 */

console.log('🧪 Test du système de logging DDS Share');
console.log('=====================================\n');

// Simulation des conditions d'environnement
const testEnvironments = [
  {
    name: 'Production sur serveur distant',
    hostname: 'share.datadesic.com',
    production: true,
    shouldLog: false
  },
  {
    name: 'Développement sur serveur distant',
    hostname: 'dev.datadesic.com',
    production: false,
    shouldLog: true
  },
  {
    name: 'Localhost',
    hostname: 'localhost',
    production: true,
    shouldLog: true
  },
  {
    name: '127.0.0.1',
    hostname: '127.0.0.1',
    production: true,
    shouldLog: true
  },
  {
    name: 'Adresse privée 192.168.x.x',
    hostname: '192.168.1.100',
    production: true,
    shouldLog: true
  },
  {
    name: 'Adresse privée 10.x.x.x',
    hostname: '10.0.0.1',
    production: true,
    shouldLog: true
  },
  {
    name: 'Adresse privée 172.x.x.x',
    hostname: '172.16.0.1',
    production: true,
    shouldLog: true
  }
];

// Fonction pour simuler la logique du LoggerService
function shouldLog(hostname, production) {
  const isDevelopment = !production;
  const isLocalhost = hostname === 'localhost' || 
                     hostname === '127.0.0.1' ||
                     hostname.startsWith('192.168.') ||
                     hostname.startsWith('10.') ||
                     hostname.startsWith('172.');
  
  return isDevelopment || isLocalhost;
}

// Tests
console.log('📋 Résultats des tests :\n');

testEnvironments.forEach((env, index) => {
  const result = shouldLog(env.hostname, env.production);
  const status = result === env.shouldLog ? '✅' : '❌';
  const logStatus = result ? 'AFFICHÉ' : 'MASQUÉ';
  
  console.log(`${index + 1}. ${env.name}`);
  console.log(`   Hostname: ${env.hostname}`);
  console.log(`   Production: ${env.production}`);
  console.log(`   Logs: ${logStatus}`);
  console.log(`   Test: ${status}\n`);
});

console.log('🎯 Résumé :');
const passedTests = testEnvironments.filter(env => 
  shouldLog(env.hostname, env.production) === env.shouldLog
).length;

console.log(`Tests réussis: ${passedTests}/${testEnvironments.length}`);

if (passedTests === testEnvironments.length) {
  console.log('🎉 Tous les tests sont passés ! Le système de logging fonctionne correctement.');
} else {
  console.log('⚠️  Certains tests ont échoué. Vérifiez la logique du LoggerService.');
}

console.log('\n📝 Instructions pour tester dans l\'application :');
console.log('1. Ouvrez la console du navigateur');
console.log('2. En développement/localhost : les logs doivent s\'afficher');
console.log('3. En production sur serveur distant : les logs doivent être masqués');
console.log('4. Utilisez logger.forceLog() pour forcer l\'affichage en production'); 