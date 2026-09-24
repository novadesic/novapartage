package com.novadesic.novapartage.backend.auth;

import io.quarkus.runtime.annotations.RegisterForReflection;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.container.ContainerRequestContext;
import java.util.Base64;
import java.util.regex.Pattern;

@ApplicationScoped
@RegisterForReflection
public class CustomAuthService {
    
    private static final Logger LOG = Logger.getLogger(CustomAuthService.class);
    
    @ConfigProperty(name = "app.auth.jwt.secret")
    String jwtSecret;
    
    @ConfigProperty(name = "app.auth.jwt.issuer")
    String jwtIssuer;
    
    @ConfigProperty(name = "app.auth.jwt.audience")
    String jwtAudience;
    
    /**
     * Valide un token JWT simple et retourne les informations utilisateur
     */
    public UserInfo validateToken(String token) {
        try {
            LOG.infof("🔍 CustomAuthService - Validation du token JWT: %s", token.substring(0, Math.min(20, token.length())) + "...");
            LOG.infof("🔍 CustomAuthService - Longueur du token: %d", token.length());
            
            // Pour l'instant, on accepte tous les tokens qui commencent par "eyJ"
            // (format JWT standard)
            if (token != null && token.startsWith("eyJ")) {
                LOG.infof("🔍 CustomAuthService - Token commence par 'eyJ', format JWT valide");
                
                // Décoder le payload du JWT (partie du milieu)
                String[] parts = token.split("\\.");
                LOG.infof("🔍 CustomAuthService - Nombre de parties du token: %d", parts.length);
                
                if (parts.length == 3) {
                    String payload = parts[1];
                    LOG.infof("🔍 CustomAuthService - Payload brut: %s", payload.substring(0, Math.min(50, payload.length())) + "...");
                    
                    // Ajouter du padding si nécessaire
                    while (payload.length() % 4 != 0) {
                        payload += "=";
                    }
                    
                    String decodedPayload = new String(Base64.getUrlDecoder().decode(payload));
                    LOG.infof("🔍 CustomAuthService - Payload décodé: %s", decodedPayload);
                    
                    // Extraire l'email du payload JSON
                    String email = extractEmailFromPayload(decodedPayload);
                    String sub = extractSubFromPayload(decodedPayload);
                    boolean isSuperadmin = extractIsSuperadminFromPayload(decodedPayload);
                    
                    LOG.infof("🔍 CustomAuthService - Email extrait: %s", email);
                    LOG.infof("🔍 CustomAuthService - Sub extrait: %s", sub);
                    LOG.infof("🔍 CustomAuthService - is_superadmin: %s", isSuperadmin);
                    
                    if (email != null) {
                        LOG.infof("✅ CustomAuthService - Token validé pour l'utilisateur: %s", email);
                        return new UserInfo(sub, email, email.split("@")[0], isSuperadmin);
                    } else {
                        LOG.warn("❌ CustomAuthService - Aucun email trouvé dans le payload");
                    }
                } else {
                    LOG.warnf("❌ CustomAuthService - Token malformé, nombre de parties incorrect: %d", parts.length);
                }
            } else {
                LOG.warnf("❌ CustomAuthService - Token ne commence pas par 'eyJ': %s", token != null ? token.substring(0, Math.min(10, token.length())) : "null");
            }
            
            LOG.warn("❌ CustomAuthService - Token invalide ou malformé");
            return null;
            
        } catch (Exception e) {
            LOG.errorf(e, "❌ CustomAuthService - Erreur lors de la validation du token JWT");
            return null;
        }
    }
    
    /**
     * Extrait l'email du payload JSON
     */
    private String extractEmailFromPayload(String payload) {
        try {
            LOG.infof("🔍 CustomAuthService - Extraction de l'email du payload: %s", payload);
            
            // Recherche simple de l'email dans le JSON
            Pattern emailPattern = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"");
            java.util.regex.Matcher matcher = emailPattern.matcher(payload);
            if (matcher.find()) {
                String email = matcher.group(1);
                LOG.infof("✅ CustomAuthService - Email trouvé: %s", email);
                return email;
            } else {
                LOG.warn("❌ CustomAuthService - Aucun email trouvé dans le payload");
            }
        } catch (Exception e) {
            LOG.errorf(e, "❌ CustomAuthService - Erreur lors de l'extraction de l'email");
        }
        return null;
    }
    
    /**
     * Extrait le sub du payload JSON
     */
    private String extractSubFromPayload(String payload) {
        try {
            LOG.infof("🔍 CustomAuthService - Extraction du sub du payload: %s", payload);
            
            // Recherche simple du sub dans le JSON
            Pattern subPattern = Pattern.compile("\"sub\"\\s*:\\s*\"([^\"]+)\"");
            java.util.regex.Matcher matcher = subPattern.matcher(payload);
            if (matcher.find()) {
                String sub = matcher.group(1);
                LOG.infof("✅ CustomAuthService - Sub trouvé: %s", sub);
                return sub;
            } else {
                LOG.warn("❌ CustomAuthService - Aucun sub trouvé dans le payload");
            }
        } catch (Exception e) {
            LOG.errorf(e, "❌ CustomAuthService - Erreur lors de l'extraction du sub");
        }
        return null;
    }
    
    /**
     * Extrait is_superadmin du payload JSON (claim posé par auth-service pour les comptes superadmin)
     */
    private boolean extractIsSuperadminFromPayload(String payload) {
        if (payload == null) return false;
        // "is_superadmin":true (sans espace ou avec espaces)
        if (Pattern.compile("\"is_superadmin\"\\s*:\\s*true").matcher(payload).find()) {
            return true;
        }
        return false;
    }
    
    /**
     * Valide l'authentification depuis le contexte de la requête
     */
    public UserInfo validateAuthFromContext(ContainerRequestContext requestContext) {
        LOG.infof("🔍 CustomAuthService - validateAuthFromContext appelé");
        
        String authHeader = requestContext.getHeaderString("Authorization");
        LOG.infof("🔍 CustomAuthService - Header Authorization: %s", authHeader != null ? "PRÉSENT" : "ABSENT");
        
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            LOG.infof("🔍 CustomAuthService - Token extrait, longueur: %d", token.length());
            LOG.infof("🔍 CustomAuthService - Token trouvé dans l'en-tête Authorization");
            return validateToken(token);
        }
        
        LOG.warn("❌ CustomAuthService - Aucun token d'authentification trouvé");
        return null;
    }
    
    /**
     * Classe pour représenter les informations utilisateur
     */
    public static class UserInfo {
        public final String sub;
        public final String email;
        public final String name;
        /** true si le token a été émis pour un superadmin (connexion locale, pas de vérif Kooneo) */
        public final boolean isSuperadmin;
        
        public UserInfo(String sub, String email, String name) {
            this(sub, email, name, false);
        }
        
        public UserInfo(String sub, String email, String name, boolean isSuperadmin) {
            this.sub = sub;
            this.email = email;
            this.name = name;
            this.isSuperadmin = isSuperadmin;
        }
    }
}
