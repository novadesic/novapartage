package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.model.UserEncryptionKey;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import java.util.Set;

@ApplicationScoped
public class EncryptionKeyService {
    
    private static final Logger LOG = Logger.getLogger(EncryptionKeyService.class);
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int KEY_SIZE = 256; // bits
    private static final int IV_SIZE = 12; // bytes pour GCM
    private static final int TAG_SIZE = 128; // bits
    
    @ConfigProperty(name = "app.encryption.master.key")
    Optional<String> masterKeyBase64;
    
    // Clé maître décodée pour les environnements où elle est obligatoire
    private volatile byte[] cachedMasterKey = null;
    // Clé temporaire en cache pour éviter de la régénérer à chaque appel
    private volatile byte[] cachedTempKey = null;

    private static final Set<String> DEV_PROFILES = Set.of("dev", "test", "local", "ci");

    @PostConstruct
    void validateMasterKeyOnStartup() {
        String profile = detectActiveProfile();
        boolean isDevProfile = profile == null || DEV_PROFILES.contains(profile);

        String keyValue = masterKeyBase64.orElse("").trim();
        if (keyValue.isEmpty()) {
            if (isDevProfile) {
                LOG.warnf("⚠️ APP_ENCRYPTION_MASTER_KEY absente - génération d'une clé temporaire autorisée uniquement pour les profils dev/test");
            } else {
                throw new IllegalStateException("APP_ENCRYPTION_MASTER_KEY manquante : obligatoire en profil " + profile);
            }
            return;
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(keyValue);
            if (decoded.length != 32) {
                throw new IllegalStateException(String.format("APP_ENCRYPTION_MASTER_KEY invalide : taille attendue 32 bytes, obtenue %d bytes", decoded.length));
            }
            cachedMasterKey = decoded;
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("APP_ENCRYPTION_MASTER_KEY invalide (format Base64 attendu, 32 bytes après décodage)", e);
        }
    }

    private String detectActiveProfile() {
        // Priorité aux propriétés système puis aux variables d'environnement
        String profile = System.getProperty("quarkus.profile");
        if (profile == null || profile.isBlank()) {
            profile = System.getenv("QUARKUS_PROFILE");
        }
        if (profile == null || profile.isBlank()) {
            return "prod"; // défaut
        }
        return profile.trim();
    }
    
    /**
     * Récupère ou crée la clé utilisateur
     */
    public byte[] getOrCreateUserKey(String userEmail) {
        UserEncryptionKey key = UserEncryptionKey.findByUserEmail(userEmail);
        
        if (key == null) {
            // Créer une nouvelle clé utilisateur
            byte[] userKey = generateRandomKey();
            byte[] encryptedKey = encryptWithMasterKey(userKey);
            
            key = new UserEncryptionKey();
            key.userEmail = userEmail;
            key.encryptedKey = encryptedKey;
            key.persist();
            
            LOG.infof("Clé utilisateur créée pour: %s", userEmail);
            return userKey;
        }
        
        // Déchiffrer la clé avec la clé maître
        return decryptWithMasterKey(key.encryptedKey);
    }
    
    /**
     * Récupère la clé utilisateur
     */
    public byte[] getUserKey(String userEmail) {
        UserEncryptionKey key = UserEncryptionKey.findByUserEmail(userEmail);
        if (key == null) {
            throw new RuntimeException("Clé utilisateur introuvable: " + userEmail);
        }
        return decryptWithMasterKey(key.encryptedKey);
    }
    
    /**
     * Récupère la clé applicative (pour fichiers temporaires)
     * La clé est mise en cache pour éviter de la régénérer à chaque appel
     */
    public byte[] getApplicationKey() {
        // Si la clé maître est configurée et validée, l'utiliser directement
        if (cachedMasterKey != null) {
            return cachedMasterKey;
        }
        
        // Si la clé maître n'est pas configurée, utiliser une clé temporaire mise en cache
        if (cachedTempKey == null) {
            synchronized (this) {
                if (cachedTempKey == null) {
                    // En développement, générer une clé par défaut (non sécurisée, uniquement pour les tests)
                    LOG.warnf("⚠️ Clé maître non configurée, génération d'une clé temporaire (NON SÉCURISÉE - uniquement pour développement)");
                    LOG.warnf("⚠️ Configurez APP_ENCRYPTION_MASTER_KEY dans .env pour la production");
                    cachedTempKey = new byte[32];
                    new SecureRandom().nextBytes(cachedTempKey);
                }
            }
        }
        return cachedTempKey;
    }
    
    /**
     * Génère une clé aléatoire de 256 bits
     */
    private byte[] generateRandomKey() {
        byte[] key = new byte[KEY_SIZE / 8]; // 32 bytes pour AES-256
        new SecureRandom().nextBytes(key);
        return key;
    }
    
    /**
     * Chiffre une clé utilisateur avec la clé maître
     */
    private byte[] encryptWithMasterKey(byte[] data) {
        try {
            byte[] masterKey = getApplicationKey();
            byte[] iv = new byte[IV_SIZE];
            new SecureRandom().nextBytes(iv);
            
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(masterKey, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(TAG_SIZE, iv);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);
            
            byte[] encrypted = cipher.doFinal(data);
            
            // Combiner IV + données chiffrées
            byte[] result = new byte[IV_SIZE + encrypted.length];
            System.arraycopy(iv, 0, result, 0, IV_SIZE);
            System.arraycopy(encrypted, 0, result, IV_SIZE, encrypted.length);
            
            return result;
            
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors du chiffrement de la clé utilisateur", e);
        }
    }
    
    /**
     * Déchiffre une clé utilisateur avec la clé maître
     */
    private byte[] decryptWithMasterKey(byte[] encryptedData) {
        try {
            byte[] masterKey = getApplicationKey();
            
            // Extraire IV et données
            byte[] iv = new byte[IV_SIZE];
            byte[] encrypted = new byte[encryptedData.length - IV_SIZE];
            System.arraycopy(encryptedData, 0, iv, 0, IV_SIZE);
            System.arraycopy(encryptedData, IV_SIZE, encrypted, 0, encrypted.length);
            
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(masterKey, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(TAG_SIZE, iv);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);
            
            return cipher.doFinal(encrypted);
            
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors du déchiffrement de la clé utilisateur", e);
        }
    }
}

