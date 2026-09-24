# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes |
| < 1.0   | No |

## Reporting a vulnerability

**Do not** open a public GitHub issue for security vulnerabilities.

Contact: **security@novadesic.com** (or the maintainers listed in [CONTRIBUTORS.md](CONTRIBUTORS.md)).

Please include:
- Description of the issue
- Steps to reproduce
- Impact assessment (if known)

We aim to acknowledge reports within **5 business days**.

## Self-hosting security

If you deploy NovaPartage yourself, you are responsible for:
- Generating and protecting secrets (`APP_AUTH_JWT_SECRET`, `APP_ENCRYPTION_MASTER_KEY`, database passwords)
- TLS / HTTPS configuration
- Backups and access control
- GDPR compliance for your users

See `README-SECURITY.md` and `env.example`.

## Coordinated disclosure

We follow coordinated disclosure: please allow reasonable time to fix before public disclosure.
