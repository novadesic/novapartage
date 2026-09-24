# Third-Party Licenses

NovaPartage is licensed under **Apache License 2.0** (see [LICENSE](LICENSE)).

This document summarizes **direct dependencies** with notable license requirements.  
Full machine-readable inventories are in [docs/legal/inventories/](docs/legal/inventories/).

**Last updated:** 2026-07-28

---

## Project license

| Item | Value |
|------|-------|
| Project license | Apache-2.0 |
| Copyright holder | Novadesic SAS |
| Product name | NovaPartage |

---

## Direct dependencies — summary

### Frontend (`frontend/`)

| Component | Version | License | Usage |
|-----------|---------|---------|-------|
| Angular | 17.3.x | MIT | SPA framework |
| ag-grid-community | 34.2.x | MIT | Data grids (Community only) |
| ag-grid-angular | 34.2.x | MIT | Angular bindings for AG Grid |
| Bootstrap | 5.3.x | MIT | UI layout |
| bootstrap-icons | 1.13.x | MIT | Icons |
| rxjs | 7.8.x | Apache-2.0 | Reactive streams |
| zone.js | 0.14.x | MIT | Angular change detection |

**Verified:** no `ag-grid-enterprise` in `package.json` or lockfiles (CI guard: `scripts/check-no-ag-grid-enterprise.sh`).

### Backend (`backend/`)

| Component | Version | License | Usage |
|-----------|---------|---------|-------|
| Quarkus | 3.24.x | Apache-2.0 | Backend framework |
| Apache POI (quarkus-poi) | 2.0.4 | Apache-2.0 | Excel read/write |
| PostgreSQL JDBC | (via Quarkus) | BSD-2-Clause | Database |
| Flyway | (via Quarkus) | Apache-2.0 | Migrations |
| Hibernate ORM Panache | (via Quarkus) | LGPL-2.1 / EPL (classpath) | Persistence |

Runtime transitive inventory — see [backend-THIRD-PARTY.txt](docs/legal/inventories/backend-THIRD-PARTY.txt).

### Auth service (`auth-service/`)

| Component | Version | License | Usage |
|-----------|---------|---------|-------|
| express | 4.x | MIT | HTTP server |
| jsonwebtoken | 9.x | MIT | JWT |
| bcryptjs | 2.x | MIT | Password hashing |
| pg | 8.x | MIT | PostgreSQL client |
| redis (ioredis) | — | MIT | Session / tokens |
| express-rate-limit | 7.x | MIT | Rate limiting |

Full inventory: [auth-licenses.csv](docs/legal/inventories/auth-licenses.csv) (~138 production packages).

### Email service (`email-service/`)

| Component | Version | License | Usage |
|-----------|---------|---------|-------|
| express | 4.x | MIT | HTTP server |
| nodemailer | — | MIT | SMTP |
| node-mailjet | — | MIT | Mailjet API (optional) |

Full inventory: [email-licenses.csv](docs/legal/inventories/email-licenses.csv).

### Monitoring service (`monitoring-service/`)

| Component | Version | License | Usage |
|-----------|---------|---------|-------|
| express | 4.x | MIT | HTTP server |
| pg | 8.x | MIT | PostgreSQL |
| node-cron | — | ISC/MIT | Scheduled jobs |
| nodemailer | — | MIT | Alert emails |

Full inventory: [monitoring-licenses.csv](docs/legal/inventories/monitoring-licenses.csv).

---

## Special licenses

### AG Grid

- **Only Community edition** (`ag-grid-community`, `ag-grid-angular`) — MIT
- **No Enterprise** (`ag-grid-enterprise`) — verified by CI

---

## Policy

- Do **not** introduce **AGPL** or strong **GPL** dependencies without legal review.
- `ag-grid-enterprise` is **forbidden** — CI fails if detected.
- Regenerate inventories before each major release:

```bash
# Node services
cd frontend && npx license-checker --production --csv > ../docs/legal/inventories/frontend-licenses.csv
cd auth-service && npx license-checker --production --csv > ../docs/legal/inventories/auth-licenses.csv
cd email-service && npx license-checker --production --csv > ../docs/legal/inventories/email-licenses.csv
cd monitoring-service && npx license-checker --production --csv > ../docs/legal/inventories/monitoring-licenses.csv

# Backend Maven
cd backend && ./mvnw org.codehaus.mojo:license-maven-plugin:2.4.0:add-third-party \
  -DoutputDirectory=target/generated-sources/license
cp target/generated-sources/license/THIRD-PARTY.txt ../docs/legal/inventories/backend-THIRD-PARTY.txt
```

---

## Java packages

Application packages: `com.novadesic.novapartage.*`.

---

## Intellectual property

Copyright on NovaPartage application code: **Novadesic SAS**.  
See [CONTRIBUTORS.md](CONTRIBUTORS.md).
