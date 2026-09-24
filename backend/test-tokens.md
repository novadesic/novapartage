# Test des endpoints de gestion des tokens d'accès

## Endpoints disponibles

### 1. Générer un lien d'accès
```bash
POST /api/shares/{shareId}/recipient-link
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "destinataire@example.com",
  "validityDays": 7
}
```

### 2. Récupérer tous les tokens d'un partage
```bash
GET /api/shares/{shareId}/access-tokens
Authorization: Bearer <token>
```

### 3. Révoquer un token
```bash
DELETE /api/shares/access-tokens/{tokenId}
Authorization: Bearer <token>
```

### 4. Accéder aux données via un token
```bash
GET /api/shares/access/{token}
```

## Tests avec curl

### Générer un token
```bash
curl -X POST "http://localhost:8080/api/shares/687fa513c0b3b19be2c1eaf9/recipient-link" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"email": "Client_A@mail.com", "validityDays": 7}'
```

### Lister les tokens
```bash
curl -X GET "http://localhost:8080/api/shares/687fa513c0b3b19be2c1eaf9/access-tokens" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Révoquer un token
```bash
curl -X DELETE "http://localhost:8080/api/shares/access-tokens/TOKEN_ID_HERE" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Accéder aux données
```bash
curl -X GET "http://localhost:8080/api/shares/access/GENERATED_TOKEN_HERE"
```

## Fonctionnalités implémentées

✅ **Modèle de données** : `AccessToken` avec statuts (ACTIVE, EXPIRED, REVOKED)
✅ **Génération de tokens** : Tokens uniques de 32 caractères
✅ **Stockage en base** : MongoDB avec Panache
✅ **Gestion des expirations** : Calcul automatique des dates d'expiration
✅ **Suivi d'utilisation** : Compteur d'utilisation et dernière utilisation
✅ **Révocation** : Possibilité de révoquer un token
✅ **Interface utilisateur** : Affichage et gestion dans la page de détail
✅ **Sécurité** : Vérification des permissions propriétaire
✅ **Configuration des URLs** : Adaptation automatique au nom de domaine

## Configuration des URLs d'accès

### Variables d'environnement disponibles

1. **`APP_BASE_URL`** (Priorité 1 - Recommandé)
   - URL complète de l'application
   - Exemple: `https://ddsshare.example.com`

2. **`FRONTEND_URL`** (Priorité 2)
   - URL du frontend
   - Exemple: `https://ddsshare.example.com`

3. **`APP_DOMAIN`** (Priorité 3)
   - Nom de domaine (protocole détecté automatiquement)
   - Exemple: `ddsshare.example.com`

### Exemples de configuration

```bash
# Développement local
export APP_DOMAIN=localhost

# Production avec domaine personnalisé
export APP_BASE_URL=https://ddsshare.monentreprise.com

# Production avec sous-domaine
export APP_DOMAIN=ddsshare.monentreprise.com
```

## Prochaines améliorations possibles

- [ ] Nettoyage automatique des tokens expirés
- [ ] Limitation du nombre de tokens actifs par destinataire
- [ ] Notifications lors de l'utilisation d'un token
- [ ] Audit trail complet des accès
- [ ] Tokens à usage unique 