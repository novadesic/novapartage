package com.novadesic.novapartage.backend.config;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

import java.util.HashSet;
import java.util.Set;

/**
 * Filtre d'authentification global pour les routes protégées
 * Exclut explicitement les routes publiques (/public-access, /test, etc.)
 */
@Provider
public class AuthenticationFilter implements ContainerRequestFilter {
    
    private static final Logger LOG = Logger.getLogger(AuthenticationFilter.class);
    
    // Routes publiques qui ne nécessitent pas d'authentification
    private static final Set<String> PUBLIC_PATHS = new HashSet<>();
    
    static {
        PUBLIC_PATHS.add("/public-access");
        PUBLIC_PATHS.add("/test");
        PUBLIC_PATHS.add("/health");
        PUBLIC_PATHS.add("/openapi");
        PUBLIC_PATHS.add("/q/");
    }
    
    @Override
    public void filter(ContainerRequestContext requestContext) {
        String path = requestContext.getUriInfo().getPath();
        
        LOG.infof("🔍 AuthenticationFilter - Vérification du chemin: %s", path);
        
        // Vérifier si le chemin est une route publique
        for (String publicPath : PUBLIC_PATHS) {
            if (path.startsWith(publicPath)) {
                LOG.infof("✅ AuthenticationFilter - Route publique détectée: %s, accès autorisé sans authentification", path);
                return; // Autoriser l'accès sans authentification
            }
        }
        
        // Pour les autres routes, vérifier l'authentification
        // Note: Les contrôleurs individuels gèrent leur propre authentification
        // Ce filtre ne bloque que si nécessaire
        LOG.infof("🔍 AuthenticationFilter - Route protégée: %s, laisser les contrôleurs gérer l'authentification", path);
    }
}

