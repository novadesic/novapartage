/**
 * Règles de création de mot de passe (synchronisées avec le backend auth-service)
 */
export const PASSWORD_RULES_MESSAGE = 'Le mot de passe doit contenir : au moins 8 caractères, une majuscule, un chiffre et un caractère spécial (!@#$%^&*...)';

/**
 * Valide un mot de passe côté client (même règles que le backend)
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Mot de passe requis' };
  }
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
  }
  if (trimmed.length > 128) {
    return { valid: false, error: 'Le mot de passe ne peut pas dépasser 128 caractères' };
  }
  if (!/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins une lettre' };
  }
  if (!/[A-Z]/.test(trimmed)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins une majuscule' };
  }
  if (!/[0-9]/.test(trimmed)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins un chiffre' };
  }
  if (!/[^A-Za-z0-9]/.test(trimmed)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...)' };
  }
  return { valid: true };
}
