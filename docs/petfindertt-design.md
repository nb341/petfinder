# PetFinderTT Design Document

Nov 27, 2026 · @N B

PetFinderTT is a community platform for finding lost pets and helping strays in Trinidad and Tobago, rebuilt from my 2019 UTT capstone as a portfolio project that shows full stack, DevOps and system design work.

## Overview

Owners of lost pets in Trinidad and Tobago rely on scattered Facebook and Twitter posts, so sightings never come together in one place. PetFinderTT gives the community one map where anyone can report a lost pet or a stray, add sightings, and see a ranked heatmap of where to look next.

|  | 2019 capstone | 2026 rebuild |
| --- | --- | --- |
| Stack | PHP, MySQL, XAMPP | Angular, NestJS, PostgreSQL + PostGIS, AWS |
| Users | 6 tables, one per role, passwords in a column | 1 users table, auth in Cognito, roles as groups |
| Location | Lat/long stored as varchar | PostGIS geography with spatial indexes |
| Estimation model | Described, not built | H3 hex grid + time-decayed kernel, computed async |
| Hosting | Heroku (planned) | Containers on AWS, provisioned with IaC |
| Testing | Manual | Unit, integration, E2E in CI |

**Audience:** pet owners and animal lovers in T&T as users; recruiters and hiring managers as the real readers of the repo.

## Goals and non-goals

**Goals**

- Ship the core loop end to end: report, sight, see zones, resolve
- Show production-grade engineering: event-driven backend, geospatial data, IaC, CI/CD, observability
- Deploy to real AWS on demand, with a near-zero idle bill
- Meet WCAG 2.2 AA on core flows

**Non-goals**

- Native mobile apps (responsive web only)
- Payments, donations or monetization
- Replacing shelters' own case management systems
- Guaranteed rescue: the platform coordinates people, it does not dispatch them

## Users and roles

Every signed-in user is a **member**; extra roles come from verification and live as Cognito groups.

| Role | Who | Main jobs | In MVP |
| --- | --- | --- | --- |
| Visitor | Anyone, not signed in | Browse open cases on the map (fuzzed locations) | Yes |
| Member (owner) | Person whose pet is lost | Report the case, follow sightings and zones, mark resolved | Yes |
| Member (volunteer) | Person who spots an animal | Report strays, add sightings with photo and location | Yes |
| Rescuer | Verified individual or group | Find unrescued strays nearby, mark rescued | No |
| Shelter | Verified organization | Take animals into care, list for adoption, review applicants | No |
| Vet | Verified veterinarian | Claim animals needing treatment, record treatment | No |
| Admin | Project maintainer | Review verification requests, moderate content | No |

## Feature catalog

46 features across 9 areas; 21 are in the MVP. Phase numbers match the roadmap (P1-P2 = MVP).

| ID | Feature | Area | Roles | Phase |
| --- | --- | --- | --- | --- |
| F-01 | Email + password sign-up and sign-in | Accounts | All | **MVP** |
| F-02 | Sign in with Google | Accounts | All | **MVP** |
| F-03 | Sign in with Facebook | Accounts | All | P3 |
| F-04 | Sign in with Apple | Accounts | All | Later |
| F-05 | Link social and email accounts with the same address | Accounts | All | P3 |
| F-06 | Profile: display name, phone, contact visibility | Accounts | Member | **MVP** |
| F-07 | Report a lost pet (photo, details, last seen point and time) | Cases | Member | **MVP** |
| F-08 | Report a stray | Cases | Member | **MVP** |
| F-09 | Photo upload direct to S3 with thumbnails | Cases | Member | **MVP** |
| F-10 | Case detail page with photos and status timeline | Cases | All | **MVP** |
| F-11 | Mark a case resolved (reunited / rescued) | Cases | Owner, reporter | **MVP** |
| F-12 | Edit or withdraw my case | Cases | Owner, reporter | **MVP** |
| F-13 | My cases and my sightings | Cases | Member | **MVP** |
| F-14 | Report as spam or inappropriate | Cases | Member | P3 |
| F-15 | Add a sighting (point, time, photo, note) | Sightings | Member | **MVP** |
| F-16 | Use my location for a report or sighting | Sightings | Member | **MVP** |
| F-17 | Confirm or dispute a sighting | Sightings | Owner | P3 |
| F-18 | Browse map with clustered pins | Map | All | **MVP** |
| F-19 | List view synced with the map, filters by species and type | Map | All | **MVP** |
| F-20 | Search zones heatmap (H3 cells, ranked) | Map | All | **MVP** |
| F-21 | Geoprivacy: public sees a hex, owner sees exact points | Map | All | **MVP** |
| F-22 | Live map updates over WebSockets | Map | All | P4 |
| F-23 | Shareable case link with preview card for social media | Sharing | All | **MVP** |
| F-24 | Printable lost-pet poster with QR code | Sharing | Owner | P3 |
| F-25 | Email alert when my case gets a sighting | Alerts | Owner | P4 |
| F-26 | Geofenced alerts: new cases near an area I watch | Alerts | Member | P4 |
| F-27 | Web push notifications | Alerts | Member | Later |
| F-28 | Request rescuer / vet / shelter verification | Care network | Member | P3 |
| F-29 | Admin review of verification requests | Care network | Admin | P3 |
| F-30 | Rescuer: strays needing pickup near me, mark rescued | Care network | Rescuer | P3 |
| F-31 | Shelter: take an animal into care (placements) | Care network | Shelter | P3 |
| F-32 | Foster placements by individuals | Care network | Member | P3 |
| F-33 | Vet: priority queue of medical requests, claim and treat | Care network | Vet | P3 |
| F-34 | Adoption listings | Adoption | Shelter | P3 |
| F-35 | Adoption applications and screening questions | Adoption | Member, shelter | P3 |
| F-36 | Photo matching: possible match between a stray and a lost pet | ML | System | P5 |
| F-37 | Animal detection and crop before matching | ML | System | P5 |
| F-38 | Breed suggestion from photo | ML | System | Later |
| F-39 | In-app messaging between reporter and finder | Community | Member | Later |
| F-40 | Moderation queue | Admin | Admin | P3 |
| F-41 | Basic stats: open cases, reunions, median time to resolve | Admin | Admin | P6 |
| F-42 | Seeded T&T demo data | Platform | - | **MVP** |
| F-43 | Distributed tracing, metrics and logs | Platform | - | **MVP** |
| F-44 | Infrastructure as code, local AWS emulation | Platform | - | **MVP** |
| F-45 | CI/CD with on-demand demo environment | Platform | - | **MVP** |
| F-46 | Load testing and published performance results | Platform | - | P6 |

## MVP scope

The MVP proves one loop: **report, sight, see zones, resolve**, deployed to AWS with CI green.

**Why this cut**

- It covers every hard engineering piece: auth with a social provider, geospatial queries, the event pipeline, async compute, IaC
- The care network (F-28 to F-35) is mostly CRUD on top of the same patterns, so it adds scope without adding new skills
- Alerts and live updates need the event pipeline first, so they follow naturally in P4

**Deliberate MVP simplifications**

- Case status is only `reported`, `sighted`, `resolved`; the full stray lifecycle arrives in P3 through a schema migration
- Map freshness comes from polling every 10 s, not WebSockets
- One role (member); no verification or moderation

**Done when**

- [ ] A visitor can sign up with Google and report a lost pet with a photo
- [ ] A second user adds three sightings and the heatmap updates within 10 s
- [ ] The owner marks the case resolved and it leaves the public map
- [ ] Playwright covers that whole loop in CI, with axe accessibility checks
- [ ] The stack deploys to AWS from GitHub Actions and tears down on schedule
- [ ] One trace in Grafana follows a sighting from the sighting mutation to the zone write

## Architecture

The API never calls the worker directly: it writes domain rows and an outbox event in one transaction, and the worker consumes the event from a Redis Stream after the outbox relay publishes it.

> Embedded content: AWS architecture · 8 components

- **Read path:** Angular sends GraphQL queries to `/api/graphql`. CloudFront forwards them to the ALB without caching, and NestJS resolvers use PostGIS for spatial reads.
- **Write path:** GraphQL mutations write domain rows and an outbox event in one transaction. The worker relays the event and computes zones.
- **Photos:** a GraphQL mutation returns a presigned S3 POST. The browser uploads the bytes directly to S3 and passes the photo key to the case or sighting mutation.
- **Locally:** Floci emulates S3 and Cognito on `localhost:4566`. Redis, Postgres and Grafana LGTM run in Docker Compose.

### GraphQL API

- Queries cover the case map and list, case details, ranked zones, and the signed-in member’s cases and sightings. The map and zone queries poll every 10 s in the MVP.
- Mutations cover profile edits, photo upload authorization, case reporting, editing, withdrawal and resolution, and adding sightings. Cognito handles sign-in through its OIDC flow.

## Tech stack

One language end to end (TypeScript), so the frontend and backend share validation schemas through the Nx graph.

| Layer | Pick | Why |
| --- | --- | --- |
| Monorepo | Nx 24, pnpm | Affected builds, enforced module boundaries, one dependency graph |
| Frontend | Angular 22, spartan/ui (shadcn port), Tailwind | Typed, opinionated; spartan gives the shadcn look in Angular |
| Maps | MapLibre GL, h3-js | Open source, no Google billing; hex layer for zones |
| API | NestJS 12, code-first GraphQL | Typed queries and mutations for the Angular app |
| Worker | NestJS standalone app | Outbox relay + Redis Streams consumers, same code style as the API |
| Validation | zod in a shared lib (nestjs-zod) | Shared schemas validate Angular forms and GraphQL mutation inputs |
| ORM | Drizzle | Typed SQL, supports PostGIS and pgvector columns |
| Database | PostgreSQL 17 + PostGIS, pgvector, btree\_gist | Spatial queries and indexes; vectors ready for P5 |
| Auth | Amazon Cognito, angular-auth-oidc-client, aws-jwt-verify | Managed login with Google federation, PKCE for the SPA |
| Messaging | Redis Streams with consumer groups and a dead-letter stream, transactional outbox | At-least-once delivery without dual-write bugs |
| IaC | cdktn (TypeScript) + OpenTofu | Same language as the app; open-source Terraform engine |
| Local cloud | Floci | AWS APIs on localhost, no account needed |
| Observability | OpenTelemetry, Grafana LGTM | Traces, metrics, logs; one trace across the pipeline |
| Testing | Jest/Vitest, Testcontainers, Playwright + axe, k6 | Full pyramid plus accessibility and load |
| CI/CD | GitHub Actions, OIDC to AWS | No stored cloud keys |

## Use cases

The MVP serves two actors, visitor and member; the verified care roles and their use cases (dashed) arrive in P3.

> Embedded content: UML use case diagram · 9 MVP and 5 post-MVP use cases

Member inherits every visitor use case (hollow arrow). Both report use cases include photo upload, and Google takes part in sign-in as an external identity provider.

## Workflow: report a lost pet

The owner is signed in (precondition). The photo goes to S3 before submit, so the GraphQL mutation carries the photo key.

> Embedded content: UML activity diagram · report a lost pet, 4 swimlanes

The dashed arrow is asynchronous: the owner sees the case page as soon as the transaction commits, and zones appear a few seconds later. Reporting a stray follows the same flow with type `stray` and no owner.

## Workflow: sighting to search zones

A sighting is acknowledged as soon as it is committed; the zone update reaches the owner through the outbox, Redis Streams and the worker.

> Embedded content: UML sequence diagram · sighting to search zones

- **No dual writes:** the event is a row in the same transaction as the sighting, so it cannot be lost or sent for a rolled-back write.
- **At-least-once safe:** the worker records the outbox event ID in `processed_messages` in the same transaction as the zone update and acknowledges the stream entry after commit. Reclaimed pending entries and duplicate publications reuse that ID.
- **Recovery:** the relay marks an outbox event published only after Redis accepts it. Consumers reclaim stale pending entries, retry transient failures and move exhausted entries to a dead-letter stream before acknowledging them. Retain published outbox rows for replay after broker data loss.
- **Out-of-order safe:** zones are written only if their newest sighting beats the case's watermark.

## Workflow: sign in with Google

Cognito brokers the Google login, so the API only ever validates Cognito tokens, whichever provider the user picked.

> Embedded content: UML sequence diagram · Google sign-in with PKCE

Email and password sign-in is the same flow without the Google hop. The first authenticated API call creates the user row just in time, keyed by the Cognito `sub`.

## Case lifecycle

The MVP has three states; P3 adds the stray care path (dashed) through a migration that widens the status check.

> Embedded content: UML state machine · case lifecycle

The database enforces the allowed statuses per case type with a CHECK constraint, and `closed_at` must be set exactly when a case is resolved. Every transition writes a `case_events` row.

## Data model

Nine tables in PostgreSQL with PostGIS; `cases` is the aggregate root that everything else hangs off.

> Embedded content: Entity relationship diagram · 9 MVP tables

- One open case per animal (partial unique index on `animal_id WHERE closed_at IS NULL`).
- Spatial GIST indexes on `cases.last_seen_location` and `sightings.location` serve the map bbox queries.
- Full column-level detail lives in `SCHEMA.md`; post-MVP tables (organizations, placements, medical requests, adoption, alerts) are in `schema.sql`.

## Search zone model

Each sighting spreads probability over nearby H3 cells; the worker sums, decays and normalizes them into a ranked heatmap after every new sighting.

1. Index each sighting to an H3 cell at resolution 8 (about 0.7 km² per cell).
2. Set a spread radius that grows with time since the sighting, scaled by species roam speed (dogs farther than cats), capped at a maximum ring count.
3. Give each cell in that disk a Gaussian weight by distance from the sighting cell.
4. Multiply by an age decay so recent sightings dominate.
5. Sum across all sightings of the case, normalize so all cells add to 1, keep the top N cells.
6. Write the result to `search_zones` only if its newest sighting is newer than the case's watermark.

```latex
w_{s,c} = e^{-\lambda \, \Delta t_s} \cdot e^{-d(s,c)^2 / 2\sigma(\Delta t_s)^2}, \qquad p_c = \frac{\sum_s w_{s,c}}{\sum_{c'} \sum_s w_{s,c'}}
```

The model is a pure function in `libs/shared/domain`, so it is unit and property tested (sums to 1, a newer sighting always outweighs an older one at the same spot) without a database.

## Non-functional requirements

| Area | Target | How it is checked |
| --- | --- | --- |
| Map query latency | p95 < 300 ms at 10,000 open cases | k6 against seeded data |
| Sighting to zones visible | < 10 s end to end | Playwright + trace timing |
| Photo upload | Up to 10 MB; JPEG, PNG, WebP | Presigned POST policy |
| Accessibility | WCAG 2.2 AA on core flows | axe in Playwright, manual keyboard pass |
| Availability | Best effort demo; no SLA | - |
| Data durability | Recoverable events with no duplicate processing effects | Outbox + idempotent consumers, integration tests |
| Idle AWS cost | Near zero | Demo env deployed on demand, scheduled destroy |
| Browser support | Last 2 versions of Chrome, Firefox, Safari, Edge; mobile web | Playwright projects |

## Security and privacy

| Concern | Control |
| --- | --- |
| Passwords | Never stored by the app; Cognito handles credentials and federation |
| Token theft in the SPA | Authorization code + PKCE, no client secret in the browser, short-lived access tokens |
| API authorization | GraphQL-aware JWT guard (issuer, audience, `token_use`); public queries expose fuzzed locations, and mutations enforce authentication and ownership where applicable |
| Owner home locations | Public responses carry only an H3 cell; exact points go to the owner and reporter. Enforced in the API, never hidden client-side |
| Contact details | Hidden unless the owner opts in per case |
| Photo uploads | Presigned POST with size and MIME limits, keys scoped to the user, bucket not public; served via CloudFront |
| Secrets | SSM Parameter Store; CI reaches AWS through GitHub OIDC, no long-lived keys |
| Abuse | Rate limiting on report and sighting mutations, bounded query depth and page sizes; spam reporting in P3 |
| Data in transit / at rest | TLS everywhere; RDS and S3 encryption at rest |

## Delivery

**Infrastructure (cdktn stacks)**

| Stack | Resources |
| --- | --- |
| network | VPC, subnets, security groups, VPC endpoints |
| data | RDS PostgreSQL, S3 photo bucket |
| messaging | Private Redis broker on AWS with persistence and TLS, event stream, consumer group and dead-letter stream |
| auth | Cognito user pool, app client, managed login, Google IdP |
| compute | ECR, ECS cluster, Fargate services (api, ui on nginx, worker), ALB |
| edge | ALB routing `/api` to the api service and everything else to the nginx ui service; CloudFront, ACM and a custom domain later |

One codebase targets both environments: `TARGET=floci` points the AWS provider at `localhost:4566`; otherwise it deploys to AWS with remote state.

**CI/CD**

| Trigger | Pipeline |
| --- | --- |
| Pull request | `nx affected -t lint test build`, integration tests with Floci and Redis, `cdktn synth` + plan comment |
| Merge to main | Build and push images to ECR, apply via GitHub OIDC |
| Manual / schedule | Deploy the demo environment; destroy it nightly |

**Observability:** OpenTelemetry in the API and worker; `traceparent` travels inside each event so one trace spans the GraphQL mutation, the outbox relay, Redis Streams and the worker. Locally everything lands in the `grafana/otel-lgtm` container.

**Testing**

| Level | Tools | Covers |
| --- | --- | --- |
| Unit | Jest / Vitest | Zone model, state machine, guards, components |
| Integration | Testcontainers (Postgres, Redis, Floci) | GraphQL authorization and input validation, spatial queries, outbox relay, pending entry recovery, dead-letter handling, idempotent consumers, watermark |
| E2E | Playwright + axe | The core loop and accessibility |
| Load | k6 | Map queries and sighting ingestion |

## Roadmap

Five MVP milestones (118 story points, 40 tickets in the PetFinderTT MVP Backlog) come before any post-MVP phase.

> Embedded content: Roadmap · 5 MVP milestones, 4 post-MVP phases

No dates yet: pace depends on hours per week. M3 is the differentiator, so protect time for it.

## Risks and open questions

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Floci may not emulate Cognito federation | Google login untestable locally | Test Google in the AWS dev env; email/password locally |
| Same email via Google and password makes two accounts | Duplicate users | Document for MVP; pre-sign-up Lambda linking in P3 |
| AWS cost creep (NAT, RDS idle) | Bill while job hunting | VPC endpoints, smallest RDS class, scheduled destroy |
| Scope creep into the care network | MVP never ships | Hold P3+ until the MVP done list is ticked |
| Few real users to generate sightings | Empty-looking demo | Seeded T&T data and a scripted demo |
| Zone model is a heuristic, not validated | Over-claiming accuracy | Present it as a ranked search aid; document assumptions |

**Open questions**

- [ ] Which map tiles for production: OpenFreeMap or a paid provider?
- [ ] Public zones for everyone, or owner and reporter only?
- [ ] Contact flow: show the owner's phone, or relay messages through the app?
- [ ] Facebook login in P3: worth the app review process?
