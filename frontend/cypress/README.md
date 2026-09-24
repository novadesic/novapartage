# Tests Cypress — NovaPartage

L’authentification NovaPartage est le **magic link** (auth-service + email / Mailpit en local).  
Il n’y a **plus de Keycloak**.

## État actuel

| Zone | Statut |
|------|--------|
| Specs UI wizard / home | Présentes mais **à revoir** (anciennes libellés / parcours) |
| Specs d’intégration auth | **À réécrire** pour magic link (Mailpit ou API de test) |
| CI GitHub | `npm run build` seulement — **pas** `cypress run` |

Les commandes Cypress legacy `loginWithKeycloak`, `kcWaitForReady`, etc. ont été retirées.

## Prérequis pour e2e locaux

1. Stack up (`docker compose up -d` + backend/frontend, ou self-host)
2. Auth-service joignable (ex. `http://localhost/auth` ou port auth)
3. Mailpit pour récupérer le magic link en dev (`http://localhost:8025`)

## Lancer Cypress

```bash
cd frontend
npm ci
npm run e2e:open    # UI
# ou
npm run e2e         # headless (specs actuelles peuvent échouer sans auth adaptée)
```

## Refonte auth e2e (TODO)

Parcours cible à automatiser :

1. Ouvrir `/login` (ou page qui demande l’email)
2. Saisir un email de test
3. Lire le lien dans Mailpit (API ou UI)
4. Visiter le magic link
5. Assert session / accès à `/share/new`

En attendant, privilégier les tests manuels décrits dans [docs/INSTALL.md](../../docs/INSTALL.md) (parcours login / partage).
