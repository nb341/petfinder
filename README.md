# Petfinder

A project for finding pets, built as an [Nx](https://nx.dev) monorepo with an **Angular** frontend and a **NestJS** backend.

## Tech Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Monorepo | Nx 24                                       |
| Frontend | Angular 22 (client-side only, no SSR), SCSS |
| Backend  | NestJS 12 (Express)                         |
| Database | PostgreSQL 17 (Docker), TypeORM 1.x with migrations |
| Testing  | Vitest (ui), Jest (api), Playwright (e2e)   |
| Linting  | Oxlint                                      |

## Project Structure

```
petfinder/
├── apps/
│   ├── ui/            # Angular frontend          → http://localhost:4200
│   ├── ui-e2e/        # BDD acceptance tests for ui (Gherkin + Playwright, with videos)
│   ├── api/           # NestJS backend            → http://localhost:3000/api
│   └── api-e2e/       # BDD acceptance tests for api (Gherkin + jest-cucumber)
├── infrastructure/    # AWS infrastructure (standalone cdktn package) + local/ services, see infrastructure/README.md
├── libs/
│   └── shared/
│       └── models/    # Shared types/DTOs, imported as `models`
├── nx.json            # Nx workspace config
├── tsconfig.base.json # Shared TS config + path aliases
└── package.json
```

## Prerequisites

- [Node.js](https://nodejs.org) (LTS recommended; developed on Node 25 / npm 11)
- npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) for the Postgres database

You don't need a global Nx install. Every command below runs through `npx nx`.

## Getting Started

```bash
git clone https://github.com/nb341/petfinder.git
cd petfinder
npm install
cp .env.example .env
cd infrastructure/local && docker compose up -d && cd ../..   # start Postgres and floci (see below)
```

## Local Services (Docker)

All local services are defined in one file, `infrastructure/local/docker-compose.yml`. Run the `docker compose` commands below from `infrastructure/local/`. You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

| Service    | What it is                                   | Address                 |
| ---------- | -------------------------------------------- | ----------------------- |
| `postgres` | Postgres 17 for day-to-day api development   | `localhost:5432`        |
| `floci`    | Local AWS emulator for infrastructure work   | `http://localhost:4566` |

| Task                  | Command                                                  |
| --------------------- | -------------------------------------------------------- |
| Start everything      | `docker compose up -d`                                   |
| Start only Postgres   | `docker compose up -d postgres`                          |
| Stop                  | `docker compose down`                                    |
| Stop + wipe Postgres  | `docker compose down -v`                                 |
| Logs                  | `docker compose logs -f postgres`                        |
| psql shell            | `docker compose exec postgres psql -U petfinder -d petfinder` |

### Database (Postgres)

| Setting  | Default                                                  |
| -------- | -------------------------------------------------------- |
| Host     | `localhost:5432`                                         |
| User     | `petfinder`                                              |
| Password | `petfinder`                                              |
| Database | `petfinder`                                              |
| URL      | `postgresql://petfinder:petfinder@localhost:5432/petfinder` |

To change the credentials, edit the root `.env`. Compose passes it to the container with `env_file`. Compose doesn't read the root `.env` for the port mapping, so change the host port with `POSTGRES_PORT=5433 docker compose up -d`. Data persists in the `petfinder_postgres-data` Docker volume.

### Local AWS (floci)

floci emulates AWS locally. See [infrastructure/local/README.md](infrastructure/local/README.md). For the AWS infrastructure itself, see [infrastructure/README.md](infrastructure/README.md).

## Running the App

```bash
npx nx serve ui
```

This starts **both** apps, because `ui` declares a dependency on `api:serve`:

- UI: http://localhost:4200
- API: http://localhost:3000/api

In development the UI forwards any request to `/api/*` to the backend via `apps/ui/proxy.conf.json`. In Angular code, call relative URLs such as `/api/pets`. You don't need a hostname or any CORS setup.

To run only the backend:

```bash
npx nx serve api
```

## Common Commands

| Task                    | Command                          |
| ----------------------- | -------------------------------- |
| Serve ui + api          | `npx nx serve ui`                |
| Serve api only          | `npx nx serve api`               |
| Build a project         | `npx nx build ui` / `npx nx build api` |
| Build everything        | `npx nx run-many -t build`       |
| Unit tests (all)        | `npx nx run-many -t test`        |
| e2e tests               | `npx nx e2e ui-e2e` / `npx nx e2e api-e2e` |
| Lint (all)              | `npx nx run-many -t lint`        |
| Only affected projects  | `npx nx affected -t test lint build` |
| Project graph           | `npx nx graph`                   |
| Clear Nx cache          | `npx nx reset`                   |

Build output goes to `dist/apps/<project>`. The UI build is a static site in `dist/apps/ui/browser`. To preview it locally, run `npx nx serve-static ui`.

## Testing (BDD + TDD)

Features are built outside-in:

1. Describe the behavior in a Gherkin `.feature` file.
2. Watch the acceptance test fail.
3. Drive the implementation with unit tests, using red, green, refactor.
4. Watch the acceptance test pass.

Claude Code follows this workflow through the `bdd-tdd` skill in `.claude/skills/bdd-tdd/SKILL.md`.

| Layer | Features | Steps | Run |
| --- | --- | --- | --- |
| UI acceptance | `apps/ui-e2e/src/features/*.feature` | `apps/ui-e2e/src/steps/*.steps.ts` | `npx nx e2e ui-e2e` |
| API acceptance | `apps/api-e2e/src/features/*.feature` | `apps/api-e2e/src/steps/*.steps.ts` | `npx nx e2e api-e2e` |
| API ↔ database | `apps/api/src/database/features/*.feature` | `apps/api/src/**/*.int.spec.ts` | `npx nx test-integration api` (needs Postgres running) |
| Unit tests | n/a | `*.spec.ts` next to the code | `npx nx run-many -t test` |

Both e2e commands start the apps they need. UI e2e tests run on Chromium. Install the browser once with `npx playwright install chromium`.

### Feature videos

Every UI scenario is recorded on video. After `npx nx e2e ui-e2e`:

- **Videos grouped by feature:** `dist/feature-videos/<feature>/<scenario> [chromium].webm`
- **HTML report** with a video, screenshots and steps for each scenario:
  ```bash
  npx playwright show-report dist/.playwright/apps/ui-e2e/playwright-report
  ```

`apps/ui-e2e/.features-gen/` is generated by `bddgen` and git-ignored. Don't edit it.

## Data Model

TypeORM entities live next to their domain in `apps/api/src/app/<domain>/`. Enums shared with the ui are in `libs/shared/models`. Tables and columns use snake_case.

```mermaid
erDiagram
  SHELTER ||--o{ PET : has
  SHELTER |o--o{ USER : "employs (staff)"
  PET ||--o{ PET_PHOTO : has
  PET ||--o{ ADOPTION_APPLICATION : receives
  USER ||--o{ ADOPTION_APPLICATION : submits

  SHELTER { uuid id string name string email string city char2 country }
  PET { uuid id string name enum species string breed enum sex enum size date birth_date enum status }
  PET_PHOTO { uuid id string url int sort_order }
  USER { uuid id string email enum role }
  ADOPTION_APPLICATION { uuid id enum status text message }
```

| Rule | Enforced by |
| --- | --- |
| A pet belongs to exactly one shelter. Deleting the shelter deletes its pets and their photos. | FK `ON DELETE CASCADE` |
| New pets are `available` and new applications are `submitted` | Column defaults |
| User emails are unique regardless of case | Lowercased on write + unique constraint |
| One application per adopter per pet | Unique index `(pet_id, applicant_id)` |
| Pets and users that have applications can't be deleted | FK `ON DELETE RESTRICT` |

### Migrations

The schema is changed only through migrations (`synchronize` is off). When `DB_RUN_MIGRATIONS=true` (the default in `.env.example`), the api applies pending migrations on startup.

```bash
npx nx migration-generate api --args="--name=AddPetColour"   # diff entities against the DB
npx nx migration-run api
npx nx migration-revert api
```

After generating a migration:
1. Rename the file to kebab-case without the timestamp, for example `add-pet-colour.ts`. Keep the timestamp in the class name, because TypeORM orders migrations by it.
2. Add the class to `apps/api/src/database/migrations/index.ts`.

## Shared Code

Put types and interfaces used by both apps in `libs/shared/models/src` and export them from its `index.ts`. Import them anywhere with:

```ts
import { Pet } from 'models';
```

## Generating Code

```bash
# Angular component in the ui app
npx nx g @nx/angular:component apps/ui/src/app/pet-list/pet-list

# NestJS resource (module + controller + service) in the api app
npx nx g @nx/nest:resource apps/api/src/app/pets/pets

# New shared library
npx nx g @nx/js:library libs/shared/<name>
```

## Setup History

How this workspace was created, for reference:

1. Initialized the git repo with `origin` set to `https://github.com/nb341/petfinder.git`, and added `.gitignore` and `README.md`.
2. Added Nx to the existing repo:
   ```bash
   npm init -y
   npx nx@latest init
   npx nx add @nx/angular
   npx nx add @nx/nest
   ```
3. Generated the apps and shared library:
   ```bash
   npx nx g @nx/angular:application apps/ui --style=scss --routing=true --bundler=esbuild --e2eTestRunner=playwright
   npx nx g @nx/nest:application apps/api --frontendProject=ui
   npx nx g @nx/js:library libs/shared/models --unitTestRunner=jest --bundler=none
   ```
4. **Removed SSR** from `ui`, because the generator enabled it and the app is client-side only:
   - Deleted `main.server.ts`, `server.ts`, `app.config.server.ts` and `app.routes.server.ts`
   - Removed the `server`, `ssr`, `outputMode` and `security` build options from `apps/ui/project.json`
   - Removed `provideClientHydration()` from `app.config.ts`
   - Uninstalled `@angular/ssr` and `@angular/platform-server`

## Contributing

1. Create a branch: `git checkout -b feature/my-feature`
2. Commit your changes
3. Run `npx nx affected -t lint test build` before pushing
4. Push the branch and open a pull request
