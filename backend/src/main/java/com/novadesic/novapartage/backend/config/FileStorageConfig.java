package com.novadesic.novapartage.backend.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

import java.util.List;

@ConfigMapping(prefix = "app.file-storage")
public interface FileStorageConfig {
    
    @WithDefault("../user_files")
    String basePath();
    
    @WithDefault("50MB")
    String maxFileSize();
    
    @WithDefault(".xlsx,.xls")
    List<String> allowedExtensions();
    
    @WithDefault("true")
    boolean createUserDirectories();
    
    @WithDefault("rw-r--r--")
    String filePermissions();
} 