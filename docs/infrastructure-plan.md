# Infrastructure Plan

> **Status:** planned, with tickets #6–#13. #6 (floci), #7 (cdktn project) and #8 (environment-aware provider and state) are done. The API compute choice is still open (#13).

## Goals

1. **Infrastructure as code** in TypeScript, using [cdktn](https://cdktn.io) (CDK Terrain) with **OpenTofu** as the engine.
2. **Local first.** Test supported AWS resources locally with [floci](https://floci.io/aws/), a free MIT-licensed AWS emulator in Docker. Run Redis Streams in Docker Compose for local messaging.
3. **One codebase, two targets.** The same constructs deploy to floci and to AWS. Only configuration differs, such as endpoints, credentials, the state backend and sizes. There are no `if (local)` forks in resource code unless floci can't emulate something.

## Tooling

| Tool | Version | Why |
| --- | --- | --- |
| `cdktn` / `cdktn-cli` | 0.25.x | Community continuation of CDKTF, which HashiCorp archived in Dec 2025. Maintained by the Open Construct Foundation. |
| `@cdktn/provider-aws` | 26.x | Prebuilt bindings for `hashicorp/aws` 6.x. Floci's Terraform docs require `~> 6.0`. |
| OpenTofu | 1.13.x (`brew install opentofu`) | Open source, and a first-class cdktn target. Its S3 backend locks state natively (`use_lockfile`), so no DynamoDB lock table is needed. |
| floci | `floci/floci:<pinned x.y.z>` | Single endpoint on `localhost:4566`. RDS, ECS, Lambda and EC2 run as real Docker containers. No auth token needed. |

## Repo Layout

```
infrastructure/cdktn/          # Nx project "infra"
├── cdktf.json                 # cdktn still reads this file name; targetVersions selects OpenTofu
├── main.ts                    # app entry: builds the stack for INFRA_ENV
├── scripts/require-tofu.sh    # fails early with install instructions
├── src/
│   ├── config/                # per-environment settings (local, dev, prod)
│   ├── provider.ts            # environment-aware AWS provider + backend
│   ├── stacks/
│   │   ├── bootstrap-stack.ts # S3 state bucket, one per account (also deployable to floci)
│   │   └── petfinder-stack.ts # composes the constructs below
│   └── constructs/
│       ├── network.ts         # VPC, subnets, routing, security groups
│       ├── database.ts        # RDS Postgres + Secrets Manager credentials
│       ├── static-site.ts     # S3 + CloudFront for apps/ui
│       └── api-service.ts     # API compute (pending decision)
```

Nx targets: `synth`, `plan`, `deploy` and `destroy`, each with `--configuration=local|dev|uat|staging|prod` (default `local`).

For example: `npx nx deploy infra -c local`.

## Local vs AWS

The constructs are the same in every environment. Only configuration changes:

| Concern | `local` (floci) | `dev` / `uat` / `staging` / `prod` (AWS) |
| --- | --- | --- |
| Provider endpoints | Every service used points to `http://localhost:4566`. Floci requires an entry for each service. | Default AWS endpoints |
| Credentials | `test` / `test`, with `skip_credentials_validation`, `skip_metadata_api_check`, `skip_requesting_account_id` and `s3_use_path_style` | AWS profile `petfinder-<env>` (SSO), later an OIDC role in CI. `allowed_account_ids` guards against the wrong account. |
| Region / account | `us-east-1` / `000000000000` | `us-east-1`, one shared account (`INFRA_AWS_ACCOUNT_ID` in the root `.env`) |
| State backend | Local file at `infrastructure/cdktn/.state/local.tfstate`, git-ignored | One shared S3 bucket `petfinder-tfstate-<accountId>` (override with `INFRA_STATE_BUCKET`), key `petfinder/<env>.tfstate`, `encrypt` and `use_lockfile`. Created by `nx bootstrap infra`. |
| Sizes | Smallest available | Set per environment, for example `db.t4g.micro` in dev |
| Deletion protection | Off | On in prod |

Each construct takes a typed config object, so the differences stay in `src/config/*.ts`. Every provider sets default tags `project=petfinder`, `env=<env>` and `managed-by=cdktn`.

**Bootstrap state:** the bootstrap stack can't keep its state in the bucket it creates, so its state is a git-ignored local file, `.state/bootstrap-aws.tfstate`. Back it up. If it's lost, re-import the bucket with `tofu import`.

**floci gaps:**
- floci reports `db_endpoint` as its internal Docker IP (for example `172.25.0.3`). From the host, connect to `localhost:<db_port>` instead. `db_port` is the proxy port, `7001` and up.
- floci only runs a real Postgres behind RDS if it can reach the Docker daemon through the mounted socket. Without it, the instance reaches `available` and the secret is created, but connections are dropped. On Docker Desktop, turn on Settings → Advanced → "Allow the default Docker socket to be used".
- floci returns `referenced_security_group_id` as `000000000000/sg-…`, a form AWS uses only for cross-account references. So `nx plan infra -c local` always shows one harmless in-place update on `db-from-app`. AWS isn't affected, so there's no workaround in code.

**floci fidelity checked so far:** S3 native state locking (`use_lockfile`) works against floci. Checked on 2026-11-27: a second `tofu apply` failed with "Error acquiring the state lock" while the first was running.

## Messaging

The [PetFinderTT design](petfindertt-design.md#workflow-sighting-to-search-zones) uses Redis Streams for messaging. Run Redis in Docker Compose locally and provision a private Redis broker with persistence and TLS for the on-demand AWS environment. Configure the outbox relay and worker with the environment’s Redis endpoint. Run messaging integration tests with a real Redis container.

## floci Setup

floci is a service in `infrastructure/docker-compose.yml`, the single compose file for local services, next to Postgres. Start it from `infrastructure/` with `docker compose up -d floci`.

- **Image and tag:** a pinned `x.y.z` tag of `floci/floci`, never `latest`, so local behavior is reproducible.
- **Ports:** `127.0.0.1:4566:4566` for the AWS API, and `127.0.0.1:7001-7099:7001-7099` for RDS database connections. Both are bound to loopback only, because floci is unauthenticated.
- **Docker socket:** `/var/run/docker.sock` is mounted, so floci can start real Postgres containers for RDS and real containers for ECS and Lambda.
- **Storage:** `FLOCI_STORAGE_MODE=persistent` with `infrastructure/.floci` mounted at `/app/data` (git-ignored), so the emulated infrastructure survives restarts.
- **Smoke test:** `infrastructure/scripts/floci-smoke.sh` checks the #6 scenarios in `infrastructure/features/local-emulator.feature` using only `curl` and `docker`.

**How the api reaches RDS locally:** floci proxies each RDS instance on a port from 7001 to 7099. The infra outputs `db_endpoint` and `db_port`, and `DATABASE_URL` is built from those outputs.

**Relationship to the existing Postgres container:** the plain Postgres from PR #1 stays as the fast default for day-to-day api development. floci RDS is used to test the infrastructure, and the api can switch to it by changing `DATABASE_URL`.

## Target Architecture

Everything except compute is independent of the API compute decision.

```
                    ┌──────────────┐
  browser ────────▶ │  CloudFront  │──▶ S3 (apps/ui build, private, OAC)
                    └──────┬───────┘
                           │ /api/graphql
                           ▼
                    ┌──────────────┐        ┌─────────────────────┐
                    │ API compute  │──────▶ │ RDS Postgres 17     │
                    │ (TBD)        │        │ private subnets     │
                    └──────┬───────┘        └─────────────────────┘
                           │
                 Secrets Manager (DB creds) · CloudWatch Logs
```

- **Network** (`src/constructs/network.ts`):
  - A VPC across `us-east-1a` and `us-east-1b`. Each env has its own `/16` (`local` 10.0, `dev` 10.10, `uat` 10.20, `staging` 10.30, `prod` 10.40), so they can be peered later.
  - Subnets are `/24`: public `x.0`–`x.1` and private `x.10`–`x.11`. None assigns public IPs automatically.
  - Only the public route table routes `0.0.0.0/0` to the internet gateway. Each private subnet has its own route table.
  - NAT is a per-env config flag, `nat: 'none' | 'single'`. Every env is `none` until the compute decision (#13).
  - The default security group is managed with no rules.
  - There are two baseline security groups. `app` has no ingress yet and all egress. `db` allows `5432` only from `app` and has no egress.
- **Database** (`src/constructs/database.ts`):
  - RDS Postgres 17 in the private subnets, attached to the `db` security group (`5432` from `app` only).
  - The instance is `publicly_accessible = false`, encrypted, on `gp3`.
  - `manage_master_user_password` makes RDS generate the master password and keep it in a Secrets Manager secret, so it never appears in code, state or outputs.
  - Outputs: `db_endpoint`, `db_port`, `db_name` and `db_secret_arn`.
  - Sizes per env: `db.t4g.micro` for `local`, `dev` and `uat`, and `db.t4g.small` for `staging` and `prod`.
  - Backups: 0 days on `local`, 1 on `dev` and `uat`, 7 on `staging` and `prod`. `prod` also has deletion protection and a final snapshot.
- **UI hosting:** a private S3 bucket behind CloudFront with Origin Access Control (OAC). CloudFront rewrites unknown paths to `index.html` so the Angular app's routing works, and forwards `/api/graphql` to the API origin with POST enabled, caching disabled, and the authorization header forwarded.
- **Observability:** CloudWatch log groups with a set retention period.
- **Tagging:** default tags `project=petfinder`, `env=<env>` and `managed-by=cdktn`.

### API compute options (decision pending)

| | ECS Fargate + ALB | Lambda + HTTP API Gateway |
| --- | --- | --- |
| NestJS changes | None, it runs as a container | Needs a serverless adapter |
| Idle cost on AWS | About $50/mo or more for the ALB, NAT and task | Close to $0 |
| Cold starts | None | Yes |
| RDS connections | Simple, long-lived pool | Needs care: VPC Lambda and RDS Proxy |
| floci | ECS tasks are real containers, and ALB is listed as "Full" | Lambda functions are real containers, and API Gateway v2 is listed as "Full" |

## Testing the Infrastructure

Infrastructure code has no automated tests. Each change is checked with `cdktn synth` and `cdktn diff`, which the PR's "How to test" section lists:

1. **Synth:** run `nx synth infra -c <env>` and read the generated JSON in `infrastructure/cdktn/cdktn.out`. For example, check that RDS isn't public, that the bucket blocks public access, and that the tags are present.
2. **Diff:** run `nx plan infra -c <env>` (`cdktn diff`) and check that it shows only the intended changes. For `dev`, it must succeed before anything is applied to AWS.

## Risks and Unknowns

| Risk | Mitigation |
| --- | --- |
| cdktn is a young community fork of an archived project | Pin versions. The generated output is plain Terraform JSON, so OpenTofu/HCL is always a fallback. |
| floci's fidelity for CloudFront, ALB routing, NAT and IAM enforcement isn't documented in detail | The first spike checks each service used. Keep a "floci gaps" list in this doc. Guard any gap with a config flag, never with a separate code path. |
| floci reports success but doesn't enforce IAM policies or security groups the way AWS does | Review policies and security groups in the synthesized JSON, and use floci for behavior. A dev AWS deploy is the final check. |
| floci's RDS endpoint uses a proxy port (7001+), not 5432 | Read the port from the stack outputs and never hardcode it. |
| floci's API is unauthenticated | Bind it to 127.0.0.1 only, and never run it on a shared network. |
| AWS costs | Use the smallest dev sizes, an `nx destroy infra -c dev` command, and AWS Budgets alerts (later ticket). |

## Tickets

These tickets are tracked as GitHub issues #6–#13, listed here in dependency order. The data model they build on is #5. The issues are the source of truth, and the copies below are for reading the plan in one place.

---

### [#6](https://github.com/nb341/petfinder/issues/6) [DevOps] Run floci locally with docker-compose
Labels: `devops`

**Summary:** Add floci to `docker-compose.yml` so the AWS infrastructure can be deployed and tested locally.

```gherkin
@infra
Feature: Local AWS emulator
  As a developer
  I want floci running locally
  So that I can deploy and test AWS infrastructure without an AWS account

  Scenario: floci starts and is reachable
    When I run "docker compose up -d floci"
    Then "http://localhost:4566/_localstack/health" responds with status 200

  Scenario: floci is not exposed beyond this machine
    When floci is running
    Then ports 4566 and 7001-7099 are bound to 127.0.0.1 only

  Scenario: Emulated resources survive a restart
    Given an S3 bucket "petfinder-smoke" exists in floci
    When I run "docker compose restart floci"
    Then the bucket "petfinder-smoke" still exists
```

---

### [#7](https://github.com/nb341/petfinder/issues/7) [DevOps] Scaffold the cdktn infra project with OpenTofu
Labels: `devops`

**Summary:** Create the `infra` Nx project using cdktn, `@cdktn/provider-aws` and OpenTofu, with `synth`, `test`, `plan`, `deploy` and `destroy` targets.

```gherkin
@infra
Feature: Infrastructure project
  As a developer
  I want the infrastructure defined in TypeScript inside the monorepo
  So that it is versioned, tested and run with the same tooling as the apps

  Scenario: Synthesize the infrastructure
    When I run "npx nx synth infra -c local"
    Then Terraform JSON is generated under "infrastructure/cdktn/cdktn.out"
    And it targets the "hashicorp/aws" provider version "~> 6.0"

  Scenario: Infra unit tests run without Docker
    Given Docker is not running
    When I run "npx nx test infra"
    Then the tests pass

  Scenario: Missing OpenTofu is reported clearly
    Given OpenTofu is not installed
    When I run "npx nx plan infra -c local"
    Then the command fails with a message to install OpenTofu
```

---

### [#8](https://github.com/nb341/petfinder/issues/8) [DevOps] Environment-aware provider and state backend
Labels: `devops`

**Summary:** Configure the provider and state per environment: floci endpoints with a local state file for `local`, and real AWS with an S3 backend for `dev` and `prod`. Add a bootstrap stack that creates the state bucket.

```gherkin
@infra
Feature: Deploy the same code locally and to AWS
  As a developer
  I want one codebase that targets floci or AWS through configuration
  So that what I test locally is what ships

  Scenario: Local deploys go to floci
    Given floci is running
    When I run "npx nx deploy infra -c local"
    Then every resource is created in floci
    And no request is sent to an AWS endpoint

  Scenario: AWS plans use real credentials and remote state
    Given I am logged in to the dev AWS account
    When I run "npx nx plan infra -c dev"
    Then the plan uses the S3 state backend with locking
    And the plan succeeds without floci running

  Scenario: Concurrent AWS deploys are blocked
    Given a deploy to "dev" is in progress
    When a second deploy to "dev" starts
    Then the second deploy fails with a state lock error

  Scenario: All resources are tagged
    When I synthesize any environment
    Then every taggable resource has tags "project=petfinder", "env" and "managed-by=cdktn"
```

---

### [#9](https://github.com/nb341/petfinder/issues/9) [DevOps] Network construct
Labels: `devops`

**Summary:** Create a VPC across 2 AZs with public and private subnets, routing, and baseline security groups.

```gherkin
@infra
Feature: Network
  As a platform owner
  I want an isolated network
  So that the database and services are not exposed to the internet

  Scenario: VPC spans two availability zones
    When I deploy the infrastructure to floci
    Then a VPC exists with 2 public and 2 private subnets across 2 availability zones

  Scenario: Private subnets have no direct internet route
    When I deploy the infrastructure to floci
    Then no private subnet route table has a route to an internet gateway
```

---

### [#10](https://github.com/nb341/petfinder/issues/10) [DevOps][Backend] RDS Postgres with managed credentials
Labels: `devops`, `backend`

**Summary:** Create RDS Postgres 17 in the private subnets, with credentials in Secrets Manager. Output the endpoint and port, and document how to point the api's `DATABASE_URL` at floci RDS.

```gherkin
@infra @api
Feature: Database
  As the api
  I want a managed Postgres database
  So that pet data is stored durably

  Scenario: Database accepts connections locally
    Given the infrastructure is deployed to floci
    When I connect with the credentials from Secrets Manager to the "db_endpoint" and "db_port" outputs
    Then the connection succeeds and "select version()" reports PostgreSQL 17

  Scenario: Database is not publicly accessible
    When I synthesize any environment
    Then the RDS instance has "publicly_accessible" set to false
    And its security group only allows port 5432 from the api security group

  Scenario: Credentials never appear in code or outputs
    When I synthesize any environment
    Then no database password appears in the Terraform JSON or the stack outputs

  Scenario: The api runs against floci RDS
    Given DATABASE_URL points at the floci RDS endpoint
    When I run "npx nx serve api"
    Then the api starts and connects to the database

  Scenario: Migrations apply to floci RDS
    Given DATABASE_URL points at the floci RDS endpoint
    When I run "npx nx migration-run api"
    Then the tables "shelters, pets, pet_photos, users, adoption_applications" exist in the RDS database

  Scenario: Data model tests pass against floci RDS
    Given TEST_DATABASE_URL points at the floci RDS endpoint
    When I run "npx nx test-integration api"
    Then every data model scenario passes
```

---

### [#11](https://github.com/nb341/petfinder/issues/11) [DevOps][Frontend] Host the ui on S3 and CloudFront
Labels: `devops`, `frontend`

**Summary:** Create a private S3 bucket with CloudFront and OAC, plus a deploy target that uploads the `apps/ui` build.

```gherkin
@infra @ui
Feature: UI hosting
  As a visitor
  I want the ui served over a CDN
  So that it loads quickly from anywhere

  Scenario: The ui is served through CloudFront
    Given the infrastructure is deployed to floci
    And the ui build is uploaded
    When I request "/" from the CloudFront distribution
    Then I receive the ui's index.html

  Scenario: Deep links load the app
    When I request "/pets/123" from the CloudFront distribution
    Then I receive the ui's index.html with status 200

  Scenario: The bucket is not publicly readable
    When I request an object directly from the S3 bucket without credentials
    Then the request is denied
```

---

### [#12](https://github.com/nb341/petfinder/issues/12) [DevOps] Infrastructure acceptance tests against floci
Labels: `devops`

**Summary:** Set up `nx e2e infra`. It deploys to a clean floci, runs the Gherkin features in `infrastructure/cdktn/features` against the real resources, and then tears everything down.

```gherkin
@infra
Feature: Infrastructure acceptance tests
  As a developer
  I want infrastructure behavior verified automatically
  So that infra changes are as safe as code changes

  Scenario: Full run against a clean emulator
    Given floci is running with no resources
    When I run "npx nx e2e infra"
    Then the stack is deployed, every infra feature passes, and the stack is destroyed

  Scenario: Failed deploys fail the run
    Given a construct is misconfigured
    When I run "npx nx e2e infra"
    Then the run fails with the OpenTofu error
    And the partially created resources are destroyed
```

---

### [#13](https://github.com/nb341/petfinder/issues/13) [DevOps][Backend] Decide and build API compute
Labels: `devops`, `backend`

**Summary:** Decide between ECS Fargate + ALB and Lambda + API Gateway, using the comparison above and a floci spike of each. Then build the chosen option. The acceptance criteria will be written once the decision is made.

```gherkin
@infra @api
Feature: API compute decision
  Scenario: Decision is recorded
    When the spike is complete
    Then "docs/infrastructure-plan.md" records the chosen option, the cost estimate and any floci gaps found
```

---

### Later

These don't have tickets yet:
- CI: synth, tests and a plan on every PR, plus floci acceptance tests in CI
- AWS Budgets alerts
- WAF
- Custom domain with ACM and Route 53
- Prod hardening: Multi-AZ RDS, backups, deletion protection
