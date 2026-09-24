# License inventories

Machine-readable third-party license reports for NovaPartage.

| File | Source | Generated with |
|------|--------|----------------|
| `frontend-licenses.csv` | `frontend/` production deps | `npx license-checker --production --csv` |
| `auth-licenses.csv` | `auth-service/` | same |
| `email-licenses.csv` | `email-service/` | same |
| `monitoring-licenses.csv` | `monitoring-service/` | same |
| `backend-THIRD-PARTY.txt` | `backend/` runtime transitive | Maven `license-maven-plugin:add-third-party` |

Regenerate before each release — see [THIRD-PARTY-LICENSES.md](../../THIRD-PARTY-LICENSES.md).

**Last generated:** 2026-07-28
