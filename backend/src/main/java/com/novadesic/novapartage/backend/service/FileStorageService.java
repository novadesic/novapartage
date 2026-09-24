package com.novadesic.novapartage.backend.service;

import com.novadesic.novapartage.backend.config.FileStorageConfig;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@ApplicationScoped
public class FileStorageService {
    
    private static final Logger LOG = Logger.getLogger(FileStorageService.class);
    
    @Inject
    FileStorageConfig config;
    
    @Inject
    FileEncryptionService fileEncryptionService;

    @PostConstruct
    void initStorageDirectories() {
        try {
            Path basePath = Paths.get(config.basePath()).toAbsolutePath().normalize();
            Files.createDirectories(basePath.resolve("temp"));
            Files.createDirectories(basePath.resolve("users"));
            LOG.infof("Stockage fichiers initialisé: %s", basePath);
        } catch (IOException e) {
            LOG.errorf(e, "Impossible de créer les répertoires de stockage sous %s", config.basePath());
            throw new IllegalStateException("Répertoire de stockage inaccessible: " + config.basePath(), e);
        }
    }
    
    /**
     * Convertit une taille de fichier en format string (ex: "50MB") en bytes
     */
    public long parseFileSize(String sizeString) {
        if (sizeString == null || sizeString.trim().isEmpty()) {
            return 50 * 1024 * 1024; // 50MB par défaut
        }
        
        sizeString = sizeString.trim().toUpperCase();
        long multiplier = 1;
        
        if (sizeString.endsWith("KB")) {
            multiplier = 1024;
            sizeString = sizeString.substring(0, sizeString.length() - 2).trim();
        } else if (sizeString.endsWith("MB")) {
            multiplier = 1024 * 1024;
            sizeString = sizeString.substring(0, sizeString.length() - 2).trim();
        } else if (sizeString.endsWith("GB")) {
            multiplier = 1024 * 1024 * 1024;
            sizeString = sizeString.substring(0, sizeString.length() - 2).trim();
        } else if (sizeString.endsWith("B")) {
            multiplier = 1;
            sizeString = sizeString.substring(0, sizeString.length() - 1).trim();
        }
        
        try {
            double value = Double.parseDouble(sizeString);
            return (long) (value * multiplier);
        } catch (NumberFormatException e) {
            LOG.warnf("Impossible de parser la taille de fichier: %s, utilisation de la valeur par défaut 50MB", sizeString);
            return 50 * 1024 * 1024;
        }
    }
    
    /**
     * Vérifie si la taille du fichier est valide
     */
    public void validateFileSize(long fileSizeBytes) throws IllegalArgumentException {
        long maxSizeBytes = parseFileSize(config.maxFileSize());
        if (fileSizeBytes > maxSizeBytes) {
            String maxSizeFormatted = formatFileSize(maxSizeBytes);
            String fileSizeFormatted = formatFileSize(fileSizeBytes);
            throw new IllegalArgumentException(
                String.format("La taille du fichier (%s) dépasse la limite autorisée (%s)", 
                    fileSizeFormatted, maxSizeFormatted)
            );
        }
    }
    
    /**
     * Formate une taille en bytes en format lisible (ex: "50 MB")
     */
    public String formatFileSize(long bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        } else if (bytes < 1024 * 1024) {
            return String.format("%.2f KB", bytes / 1024.0);
        } else if (bytes < 1024 * 1024 * 1024) {
            return String.format("%.2f MB", bytes / (1024.0 * 1024.0));
        } else {
            return String.format("%.2f GB", bytes / (1024.0 * 1024.0 * 1024.0));
        }
    }
    
    /**
     * Récupère la taille maximale autorisée en bytes
     */
    public long getMaxFileSizeBytes() {
        return parseFileSize(config.maxFileSize());
    }
    
    /**
     * Récupère la taille maximale autorisée en format string
     */
    public String getMaxFileSizeString() {
        return config.maxFileSize();
    }
    
    /**
     * Stocke un fichier dans le répertoire utilisateur
     */
    public FileInfo storeFile(InputStream inputStream, String originalFileName, String username) throws IOException {
        // Valider l'extension
        if (!isAllowedExtension(originalFileName)) {
            throw new IllegalArgumentException("Extension de fichier non autorisée: " + getFileExtension(originalFileName));
        }
        
        // Créer le répertoire utilisateur si nécessaire
        Path userDirectory = getUserDirectory(username);
        Files.createDirectories(userDirectory);
        
        // Générer un nom de fichier unique
        String uniqueFileName = generateUniqueFileName(originalFileName);
        Path targetPath = userDirectory.resolve(uniqueFileName);
        
        // Copier le fichier
        long size = Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
        
        // Calculer le hash pour vérification d'intégrité
        String fileHash = calculateFileHash(targetPath);
        
        LOG.infof("Fichier stocké: %s (%d bytes) pour l'utilisateur %s", uniqueFileName, size, username);
        
        return new FileInfo(
            uniqueFileName,
            originalFileName,
            getRelativePath(username, uniqueFileName),
            getFileExtension(originalFileName),
            size,
            fileHash
        );
    }
    
    /**
     * Stocke un fichier temporaire (avant création du partage)
     * Les fichiers temporaires sont chiffrés avec la clé applicative
     */
    public String storeTemporaryFile(InputStream inputStream, String originalFileName, String username) throws IOException {
        String tempId = UUID.randomUUID().toString();
        Path tempDirectory = getTempDirectory();
        Files.createDirectories(tempDirectory);
        
        // Chiffrer le fichier temporaire avec la clé applicative
        FileEncryptionService.EncryptedFileData encrypted = fileEncryptionService.encryptTempFile(inputStream);
        
        // Utiliser uniquement le tempId et l'extension .enc pour les fichiers chiffrés
        String extension = getFileExtension(originalFileName);
        String uniqueFileName = tempId + extension + ".enc";
        Path targetPath = tempDirectory.resolve(uniqueFileName);
        
        // Sauvegarder le fichier chiffré
        Files.write(targetPath, encrypted.data);
        
        LOG.infof("Fichier temporaire chiffré stocké: %s pour l'utilisateur %s", uniqueFileName, username);
        
        return tempId;
    }
    
    /**
     * Déplace un fichier temporaire vers le stockage permanent
     * Le fichier est chiffré avec la clé utilisateur lors du déplacement
     */
    public FileInfo moveTemporaryFile(String tempId, String originalFileName, String username) throws IOException {
        Path tempDirectory = getTempDirectory();
        Path tempFile = null;
        
        // Chercher le fichier temporaire par ID exact avec l'extension .enc
        String extension = getFileExtension(originalFileName);
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(tempDirectory, tempId + "*")) {
            for (Path path : stream) {
                String fileName = path.getFileName().toString();
                // Vérifier que le fichier commence par tempId et se termine par .enc
                if (fileName.startsWith(tempId) && fileName.endsWith(extension + ".enc")) {
                    tempFile = path;
                    break;
                }
            }
        }
        
        if (tempFile == null || !Files.exists(tempFile)) {
            throw new FileNotFoundException("Fichier temporaire non trouvé: " + tempId + " pour fichier: " + originalFileName);
        }
        
        // Déchiffrer le fichier temporaire
        InputStream decryptedStream = fileEncryptionService.decryptTempFile(tempFile);
        
        // Chiffrer avec la clé utilisateur
        FileEncryptionService.EncryptedFileData encrypted = fileEncryptionService.encryptFile(decryptedStream, username);
        
        // Déplacer vers le stockage permanent
        Path userDirectory = getUserDirectory(username);
        Files.createDirectories(userDirectory);
        
        String uniqueFileName = generateUniqueFileName(originalFileName) + ".enc";
        Path targetPath = userDirectory.resolve(uniqueFileName);
        
        // Sauvegarder le fichier chiffré
        Files.write(targetPath, encrypted.data);
        
        // Supprimer le fichier temporaire
        Files.deleteIfExists(tempFile);
        
        long size = Files.size(targetPath);
        String fileHash = calculateFileHash(targetPath);
        
        LOG.infof("Fichier temporaire déplacé et chiffré vers permanent: %s (%d bytes) pour %s", uniqueFileName, size, username);
        
        return new FileInfo(
            uniqueFileName,
            originalFileName,
            getRelativePath(username, uniqueFileName),
            getFileExtension(originalFileName),
            size,
            fileHash
        );
    }
    
    /**
     * Récupère un fichier temporaire (déchiffré)
     */
    public InputStream getTemporaryFile(String tempId, String username) throws IOException {
        Path tempDirectory = getTempDirectory();
        Path tempFile = null;
        
        // Chercher le fichier temporaire par ID exact (le fichier commence par tempId et se termine par .enc)
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(tempDirectory, tempId + "*")) {
            for (Path path : stream) {
                String fileName = path.getFileName().toString();
                // Vérifier que le fichier commence exactement par tempId et se termine par .enc
                if (fileName.startsWith(tempId) && fileName.endsWith(".enc")) {
                    tempFile = path;
                    break;
                }
            }
        }
        
        if (tempFile == null || !Files.exists(tempFile)) {
            throw new FileNotFoundException("Fichier temporaire non trouvé: " + tempId);
        }
        
        // Déchiffrer le fichier temporaire
        return fileEncryptionService.decryptTempFile(tempFile);
    }
    
    /**
     * Récupère le nom de fichier temporaire (retourne le nom original sans .enc pour la détection du format)
     * Le fichier sur le disque est stocké comme: tempId + extension + ".enc"
     * Cette méthode retourne: tempId + extension (pour que createWorkbook puisse détecter le format)
     */
    public String getTemporaryFileName(String tempId, String username) throws IOException {
        Path tempDirectory = getTempDirectory();
        Path tempFile = null;
        
        // Chercher le fichier temporaire par ID exact
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(tempDirectory, tempId + "*")) {
            for (Path path : stream) {
                String fileName = path.getFileName().toString();
                // Vérifier que le fichier commence exactement par tempId et se termine par .enc
                if (fileName.startsWith(tempId) && fileName.endsWith(".enc")) {
                    tempFile = path;
                    break;
                }
            }
        }
        
        if (tempFile == null || !Files.exists(tempFile)) {
            throw new FileNotFoundException("Fichier temporaire non trouvé: " + tempId);
        }
        
        // Extraire le nom original en enlevant .enc à la fin
        // Format: tempId + extension + ".enc" -> tempId + extension
        String fileName = tempFile.getFileName().toString();
        if (fileName.endsWith(".enc")) {
            fileName = fileName.substring(0, fileName.length() - 4); // Enlever ".enc"
        }
        
        return fileName;
    }
    
    /**
     * Récupère un fichier stocké (avec déchiffrement automatique si nécessaire)
     * Note: Cette méthode ne déchiffre pas automatiquement, utilisez getFileDecrypted() pour les fichiers chiffrés
     */
    public InputStream getFile(String relativePath) throws IOException {
        Path basePath = Paths.get(config.basePath());
        Path filePath = basePath.resolve(relativePath);
        
        // Vérification de sécurité - s'assurer que le chemin est dans le répertoire de base
        if (!filePath.normalize().startsWith(basePath.normalize())) {
            throw new SecurityException("Accès au fichier non autorisé: " + relativePath);
        }
        
        if (!Files.exists(filePath)) {
            throw new FileNotFoundException("Fichier non trouvé: " + relativePath);
        }
        
        return Files.newInputStream(filePath);
    }
    
    /**
     * Récupère un fichier stocké avec déchiffrement automatique
     */
    public InputStream getFileDecrypted(String relativePath, Boolean isEncrypted, String encryptionKeyId) throws IOException {
        Path basePath = Paths.get(config.basePath());
        Path filePath = basePath.resolve(relativePath);
        
        // Vérification de sécurité
        if (!filePath.normalize().startsWith(basePath.normalize())) {
            throw new SecurityException("Accès au fichier non autorisé: " + relativePath);
        }
        
        if (!Files.exists(filePath)) {
            throw new FileNotFoundException("Fichier non trouvé: " + relativePath);
        }
        
        // Déchiffrer automatiquement si nécessaire (null = non chiffré pour rétrocompatibilité)
        return fileEncryptionService.decryptFile(filePath, Boolean.TRUE.equals(isEncrypted), encryptionKeyId);
    }
    
    /**
     * Supprime un fichier
     */
    public boolean deleteFile(String relativePath) {
        try {
            Path basePath = Paths.get(config.basePath());
            Path filePath = basePath.resolve(relativePath);
            
            if (!filePath.normalize().startsWith(basePath.normalize())) {
                LOG.errorf("Tentative d'accès non autorisé au fichier: %s", relativePath);
                return false;
            }
            
            boolean deleted = Files.deleteIfExists(filePath);
            if (deleted) {
                LOG.infof("Fichier supprimé: %s", relativePath);
            }
            return deleted;
            
        } catch (IOException e) {
            LOG.errorf(e, "Erreur lors de la suppression du fichier: %s", relativePath);
            return false;
        }
    }
    
    /**
     * Nettoie les fichiers temporaires anciens
     */
    public void cleanupTemporaryFiles(long maxAgeHours) {
        try {
            Path tempDirectory = getTempDirectory();
            if (!Files.exists(tempDirectory)) {
                return;
            }
            
            long cutoffTime = System.currentTimeMillis() - (maxAgeHours * 60 * 60 * 1000);
            
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(tempDirectory)) {
                for (Path path : stream) {
                    try {
                        if (Files.getLastModifiedTime(path).toMillis() < cutoffTime) {
                            Files.delete(path);
                            LOG.infof("Fichier temporaire supprimé: %s", path.getFileName());
                        }
                    } catch (IOException e) {
                        LOG.warnf(e, "Impossible de supprimer le fichier temporaire: %s", path);
                    }
                }
            }
            
        } catch (IOException e) {
            LOG.errorf(e, "Erreur lors du nettoyage des fichiers temporaires");
        }
    }
    
    // Méthodes utilitaires privées
    
    private Path getUserDirectory(String username) {
        String sanitizedUsername = sanitizeFileName(username);
        return Paths.get(config.basePath()).resolve("users").resolve(sanitizedUsername);
    }
    
    private Path getTempDirectory() {
        return Paths.get(config.basePath()).resolve("temp");
    }
    
    private String getRelativePath(String username, String fileName) {
        return "users/" + sanitizeFileName(username) + "/" + fileName;
    }
    
    private boolean isAllowedExtension(String fileName) {
        String extension = getFileExtension(fileName);
        return config.allowedExtensions().contains(extension.toLowerCase());
    }
    
    private String getFileExtension(String fileName) {
        int lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex >= 0 ? fileName.substring(lastDotIndex) : "";
    }
    
    private String generateUniqueFileName(String originalFileName) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String uuid = UUID.randomUUID().toString().substring(0, 8);
        String extension = getFileExtension(originalFileName);
        String baseName = sanitizeFileName(originalFileName.substring(0, originalFileName.lastIndexOf('.') >= 0 ? 
                                         originalFileName.lastIndexOf('.') : originalFileName.length()));
        
        return String.format("%s_%s_%s%s", baseName, timestamp, uuid, extension);
    }
    
    private String sanitizeFileName(String fileName) {
        // Supprimer les caractères dangereux et limiter la longueur
        String sanitized = fileName.replaceAll("[^a-zA-Z0-9._-]", "_")
                                   .replaceAll("_{2,}", "_");
        return sanitized.substring(0, Math.min(sanitized.length(), 100));
    }
    
    private String calculateFileHash(Path filePath) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] fileBytes = Files.readAllBytes(filePath);
            byte[] hashBytes = digest.digest(fileBytes);
            
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
            
        } catch (NoSuchAlgorithmException e) {
            LOG.warn("SHA-256 non disponible, pas de hash généré");
            return null;
        }
    }
    
    // Classe interne pour les informations de fichier
    public static class FileInfo {
        public final String fileName;
        public final String originalFileName;
        public final String relativePath;
        public final String extension;
        public final long size;
        public final String hash;
        
        public FileInfo(String fileName, String originalFileName, String relativePath, String extension, long size, String hash) {
            this.fileName = fileName;
            this.originalFileName = originalFileName;
            this.relativePath = relativePath;
            this.extension = extension;
            this.size = size;
            this.hash = hash;
        }
    }
} 