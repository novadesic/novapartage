package com.novadesic.novapartage.backend.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;

@ApplicationScoped
public class FileEncryptionService {
    
    private static final Logger LOG = Logger.getLogger(FileEncryptionService.class);
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int IV_SIZE = 12; // bytes pour GCM
    private static final int TAG_SIZE = 128; // bits
    
    @Inject
    EncryptionKeyService keyService;
    
    /**
     * Chiffre un fichier avec la clé utilisateur
     */
    public EncryptedFileData encryptFile(InputStream fileStream, String userEmail) throws IOException {
        try {
            // Récupérer ou créer la clé utilisateur
            byte[] userKey = keyService.getOrCreateUserKey(userEmail);
            
            // Lire le fichier en mémoire (pour les fichiers de taille raisonnable)
            byte[] fileBytes = fileStream.readAllBytes();
            
            // Générer IV aléatoire
            byte[] iv = new byte[IV_SIZE];
            SecureRandom random = new SecureRandom();
            random.nextBytes(iv);
            
            // Initialiser le cipher
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(userKey, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(TAG_SIZE, iv);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);
            
            // Chiffrer le fichier
            byte[] encrypted = cipher.doFinal(fileBytes);
            
            // Combiner IV + données chiffrées
            byte[] result = new byte[IV_SIZE + encrypted.length];
            System.arraycopy(iv, 0, result, 0, IV_SIZE);
            System.arraycopy(encrypted, 0, result, IV_SIZE, encrypted.length);
            
            LOG.infof("Fichier chiffré pour utilisateur: %s (%d bytes -> %d bytes)", 
                     userEmail, fileBytes.length, result.length);
            
            return new EncryptedFileData(result, userEmail);
            
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors du chiffrement du fichier", e);
        }
    }
    
    /**
     * Déchiffre un fichier (avec détection automatique selon isEncrypted)
     */
    public InputStream decryptFile(Path filePath, boolean isEncrypted, String encryptionKeyId) throws IOException {
        // Si isEncrypted est false ou null, ou si encryptionKeyId est manquant, retourner le fichier tel quel
        if (!isEncrypted || encryptionKeyId == null || encryptionKeyId.isEmpty()) {
            // Fichier non chiffré : retourner tel quel (rétrocompatibilité)
            return Files.newInputStream(filePath);
        }
        
        try {
            // Récupérer la clé utilisateur
            byte[] userKey = keyService.getUserKey(encryptionKeyId);
            
            // Lire le fichier chiffré
            byte[] encryptedData = Files.readAllBytes(filePath);
            
            // Extraire IV et données
            byte[] iv = new byte[IV_SIZE];
            byte[] encrypted = new byte[encryptedData.length - IV_SIZE];
            System.arraycopy(encryptedData, 0, iv, 0, IV_SIZE);
            System.arraycopy(encryptedData, IV_SIZE, encrypted, 0, encrypted.length);
            
            // Déchiffrer
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(userKey, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(TAG_SIZE, iv);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);
            
            byte[] decrypted = cipher.doFinal(encrypted);
            
            LOG.infof("Fichier déchiffré pour utilisateur: %s (%d bytes -> %d bytes)", 
                     encryptionKeyId, encryptedData.length, decrypted.length);
            
            return new ByteArrayInputStream(decrypted);
            
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors du déchiffrement du fichier", e);
        }
    }
    
    /**
     * Chiffre un fichier temporaire avec la clé applicative
     */
    public EncryptedFileData encryptTempFile(InputStream fileStream) throws IOException {
        try {
            // Récupérer la clé applicative
            byte[] appKey = keyService.getApplicationKey();
            
            // Lire le fichier
            byte[] fileBytes = fileStream.readAllBytes();
            
            // Générer IV aléatoire
            byte[] iv = new byte[IV_SIZE];
            SecureRandom random = new SecureRandom();
            random.nextBytes(iv);
            
            // Chiffrer
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(appKey, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(TAG_SIZE, iv);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);
            
            byte[] encrypted = cipher.doFinal(fileBytes);
            
            // Combiner IV + données chiffrées
            byte[] result = new byte[IV_SIZE + encrypted.length];
            System.arraycopy(iv, 0, result, 0, IV_SIZE);
            System.arraycopy(encrypted, 0, result, IV_SIZE, encrypted.length);
            
            LOG.infof("Fichier temporaire chiffré (%d bytes -> %d bytes)", 
                     fileBytes.length, result.length);
            
            return new EncryptedFileData(result, "APPLICATION");
            
        } catch (Exception e) {
            LOG.errorf("Erreur lors du chiffrement du fichier temporaire: %s", e.getMessage(), e);
            throw new RuntimeException("Erreur lors du chiffrement du fichier temporaire: " + e.getMessage(), e);
        }
    }
    
    /**
     * Déchiffre un fichier temporaire
     */
    public InputStream decryptTempFile(Path filePath) throws IOException {
        try {
            byte[] appKey = keyService.getApplicationKey();
            
            byte[] encryptedData = Files.readAllBytes(filePath);
            byte[] iv = new byte[IV_SIZE];
            byte[] encrypted = new byte[encryptedData.length - IV_SIZE];
            System.arraycopy(encryptedData, 0, iv, 0, IV_SIZE);
            System.arraycopy(encryptedData, IV_SIZE, encrypted, 0, encrypted.length);
            
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(appKey, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(TAG_SIZE, iv);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);
            
            byte[] decrypted = cipher.doFinal(encrypted);
            
            LOG.infof("Fichier temporaire déchiffré (%d bytes -> %d bytes)", 
                     encryptedData.length, decrypted.length);
            
            return new ByteArrayInputStream(decrypted);
            
        } catch (javax.crypto.AEADBadTagException e) {
            LOG.errorf("Erreur d'authentification lors du déchiffrement du fichier temporaire %s (clé incorrecte ou fichier corrompu)", filePath);
            throw new RuntimeException("Erreur d'authentification lors du déchiffrement (clé incorrecte ou fichier corrompu): " + e.getMessage(), e);
        } catch (Exception e) {
            LOG.errorf("Erreur lors du déchiffrement du fichier temporaire %s: %s", filePath, e.getMessage(), e);
            throw new RuntimeException("Erreur lors du déchiffrement du fichier temporaire: " + e.getMessage(), e);
        }
    }
    
    /**
     * Chiffre des données brutes (byte[]) avec la clé utilisateur
     * Utilisé pour chiffrer row_data dans share_access_tabdata_row
     * 
     * @param data Les données à chiffrer (JSON sérialisé en bytes)
     * @param userEmail L'email de l'utilisateur propriétaire (utilisé pour récupérer la clé)
     * @return Les données chiffrées avec IV (format: [IV (12 bytes)][Données chiffrées + Tag])
     */
    public byte[] encryptData(byte[] data, String userEmail) {
        try {
            // Récupérer ou créer la clé utilisateur
            byte[] userKey = keyService.getOrCreateUserKey(userEmail);
            
            // Générer IV aléatoire
            byte[] iv = new byte[IV_SIZE];
            SecureRandom random = new SecureRandom();
            random.nextBytes(iv);
            
            // Initialiser le cipher
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(userKey, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(TAG_SIZE, iv);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);
            
            // Chiffrer les données
            byte[] encrypted = cipher.doFinal(data);
            
            // Combiner IV + données chiffrées
            byte[] result = new byte[IV_SIZE + encrypted.length];
            System.arraycopy(iv, 0, result, 0, IV_SIZE);
            System.arraycopy(encrypted, 0, result, IV_SIZE, encrypted.length);
            
            LOG.infof("Données chiffrées pour utilisateur: %s (%d bytes -> %d bytes)", 
                     userEmail, data.length, result.length);
            
            return result;
            
        } catch (Exception e) {
            LOG.errorf("Erreur lors du chiffrement des données pour utilisateur %s: %s", userEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur lors du chiffrement des données", e);
        }
    }
    
    /**
     * Déchiffre des données brutes (byte[]) avec la clé utilisateur ou applicative
     * Utilisé pour déchiffrer row_data dans share_access_tabdata_row
     * 
     * @param encryptedData Les données chiffrées avec IV (format: [IV (12 bytes)][Données chiffrées + Tag])
     * @param encryptionKeyId L'email de l'utilisateur propriétaire ou "APPLICATION" pour clé applicative
     * @return Les données déchiffrées (JSON sérialisé en bytes)
     */
    public byte[] decryptData(byte[] encryptedData, String encryptionKeyId) {
        if (encryptionKeyId == null || encryptionKeyId.isEmpty()) {
            throw new IllegalArgumentException("encryptionKeyId ne peut pas être null ou vide");
        }
        
        try {
            byte[] key;
            
            // Gérer le cas spécial "APPLICATION" pour les données temporaires
            if ("APPLICATION".equals(encryptionKeyId)) {
                key = keyService.getApplicationKey();
            } else {
                // Récupérer la clé utilisateur
                key = keyService.getUserKey(encryptionKeyId);
            }
            
            // Extraire IV et données
            if (encryptedData.length < IV_SIZE) {
                throw new IllegalArgumentException("Données chiffrées invalides : taille insuffisante pour contenir l'IV");
            }
            
            byte[] iv = new byte[IV_SIZE];
            byte[] encrypted = new byte[encryptedData.length - IV_SIZE];
            System.arraycopy(encryptedData, 0, iv, 0, IV_SIZE);
            System.arraycopy(encryptedData, IV_SIZE, encrypted, 0, encrypted.length);
            
            // Déchiffrer
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(key, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(TAG_SIZE, iv);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);
            
            byte[] decrypted = cipher.doFinal(encrypted);
            
            LOG.infof("Données déchiffrées pour clé: %s (%d bytes -> %d bytes)", 
                     encryptionKeyId, encryptedData.length, decrypted.length);
            
            return decrypted;
            
        } catch (javax.crypto.AEADBadTagException e) {
            LOG.errorf("Erreur d'authentification lors du déchiffrement pour clé %s (clé incorrecte ou données corrompues)", encryptionKeyId);
            throw new RuntimeException("Erreur d'authentification lors du déchiffrement (clé incorrecte ou données corrompues)", e);
        } catch (Exception e) {
            LOG.errorf("Erreur lors du déchiffrement des données pour clé %s: %s", encryptionKeyId, e.getMessage(), e);
            throw new RuntimeException("Erreur lors du déchiffrement des données", e);
        }
    }
    
    /**
     * Chiffre des données avec la clé applicative (pour données temporaires)
     * 
     * @param data Les données à chiffrer
     * @return Les données chiffrées avec IV
     */
    public byte[] encryptDataWithApplicationKey(byte[] data) {
        try {
            byte[] appKey = keyService.getApplicationKey();
            
            byte[] iv = new byte[IV_SIZE];
            SecureRandom random = new SecureRandom();
            random.nextBytes(iv);
            
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            SecretKeySpec keySpec = new SecretKeySpec(appKey, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(TAG_SIZE, iv);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);
            
            byte[] encrypted = cipher.doFinal(data);
            
            byte[] result = new byte[IV_SIZE + encrypted.length];
            System.arraycopy(iv, 0, result, 0, IV_SIZE);
            System.arraycopy(encrypted, 0, result, IV_SIZE, encrypted.length);
            
            LOG.infof("Données chiffrées avec clé applicative (%d bytes -> %d bytes)", 
                     data.length, result.length);
            
            return result;
            
        } catch (Exception e) {
            LOG.errorf("Erreur lors du chiffrement avec clé applicative: %s", e.getMessage(), e);
            throw new RuntimeException("Erreur lors du chiffrement avec clé applicative", e);
        }
    }
    
    /**
     * Classe pour stocker les données chiffrées
     */
    public static class EncryptedFileData {
        public final byte[] data;
        public final String keyId;
        
        public EncryptedFileData(byte[] data, String keyId) {
            this.data = data;
            this.keyId = keyId;
        }
    }
}

