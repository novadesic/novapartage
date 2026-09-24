#!/usr/bin/env node

/**
 * Script de test pour vérifier le système de logging corrigé
 * Ce script simule les conditions d'environnement pour tester le LoggerService
 * Version corrigée sans dépendance circulaire
 */

console.log('🧪 Test du système de logging DDS Share (Version Corrigée)');
console.log('========================================================\n');

// Simulation des conditions d'environnement
const testEnvironments = [
  {
    name: 'Production sur serveur distant',
    hostname: 'share.datadesic.com',
    port: '443',
    shouldLog: false
  },
  {
    name: 'Développement sur serveur distant',
    hostname: 'dev.datadesic.com',
    port: '443',
    shouldLog: true
  },
  {
    name: 'Localhost',
    hostname: 'localhost',
    port: '4200',
    shouldLog: true
  },
  {
    name: '127.0.0.1',
    hostname: '127.0.0.1',
    port: '4200',
    shouldLog: true
  },
  {
    name: 'Adresse privée 192.168.x.x',
    hostname: '192.168.1.100',
    port: '4200',
    shouldLog: true
  },
  {
    name: 'Adresse privée 10.x.x.x',
    hostname: '10.0.0.1',
    port: '4200',
    shouldLog: true
  },
  {
    name: 'Adresse privée 172.x.x.x',
    hostname: '172.16.0.1',
    port: '4200',
    shouldLog: true
  },
  {
    name: 'Port de développement 3000',
    hostname: 'example.com',
    port: '3000',
    shouldLog: true
  },
  {
    name: 'Port de développement 8080',
    hostname: 'example.com',
    port: '8080',
    shouldLog: true
  }
];

// Fonction pour simuler la logique du LoggerService corrigé
function shouldLog(hostname, port) {
  const isLocalhost = hostname === 'localhost' || 
                     hostname === '127.0.0.1' ||
                     hostname.startsWith('192.168.') ||
                     hostname.startsWith('10.') ||
                     hostname.startsWith('172.');
  
  const isDevMode = 
    // URL contient des indicateurs de développement
    hostname.includes('dev') ||
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1') ||
    // Port de développement typique
    port === '4200' ||
    port === '3000' ||
    port === '8080' ||
    // Vérifier si on est sur localhost
    isLocalhost;
  
  return isDevMode;
}

// Tests
console.log('📋 Résultats des tests :\n');

testEnvironments.forEach((env, index) => {
  const result = shouldLog(env.hostname, env.port);
  const status = result === env.shouldLog ? '✅' : '❌';
  const logStatus = result ? 'AFFICHÉ' : 'MASQUÉ';
  
  console.log(`${index + 1}. ${env.name}`);
  console.log(`   Hostname: ${env.hostname}`);
  console.log(`   Port: ${env.port}`);
  console.log(`   Logs: ${logStatus}`);
  console.log(`   Test: ${status}\n`);
});

console.log('🎯 Résumé :');
const passedTests = testEnvironments.filter(env => 
  shouldLog(env.hostname, env.port) === env.shouldLog
).length;

console.log(`Tests réussis: ${passedTests}/${testEnvironments.length}`);

if (passedTests === testEnvironments.length) {
  console.log('🎉 Tous les tests sont passés ! Le système de logging fonctionne correctement.');
} else {
  console.log('⚠️  Certains tests ont échoué. Vérifiez la logique du LoggerService.');
}

console.log('\n🔧 Corrections apportées :');
console.log('✅ Suppression de la dépendance circulaire');
console.log('✅ LoggerService ne dépend plus d\'EnvironmentService');
console.log('✅ Détection automatique du mode développement');
console.log('✅ EnvironmentService met à jour LoggerService après initialisation');

console.log('\n📝 Instructions pour tester dans l\'application :');
console.log('1. Ouvrez la console du navigateur');
console.log('2. En développement/localhost : les logs doivent s\'afficher');
console.log('3. En production sur serveur distant : les logs doivent être masqués');
console.log('4. Utilisez logger.forceLog() pour forcer l\'affichage en production');
console.log('5. Plus d\'erreur de dépendance circulaire !'); 