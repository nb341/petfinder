# Infrastructure

`cdktn/` is the Nx project `infra`, which defines the AWS infrastructure in TypeScript. `docker-compose.yml` here is the single compose file for local services: `postgres` and `floci`. See the root [README](../README.md#local-services-docker) for Postgres, and [the infrastructure plan](../docs/infrastructure-plan.md) for where this is heading.

## floci

floci emulates AWS on `http://localhost:4566`. Run these commands from this folder:

| Task | Command |
| --- | --- |
| Start | `docker compose up -d floci` |
| Health | `curl http://localhost:4566/_localstack/health` |
| Logs | `docker compose logs -f floci` |
| Stop | `docker compose stop floci` |
| Wipe emulated resources | `docker compose rm -sf floci && rm -rf .floci` |
| Smoke test | `./scripts/floci-smoke.sh` |

- **Image:** pinned to `floci/floci:2.5.0`. Bump it on purpose, never use `latest`.
- **Ports:** `4566` (AWS API) and `7001-7099` (RDS proxies), bound to `127.0.0.1` only because floci's API is unauthenticated.
- **Credentials:** any values work. Use `test` / `test` in region `us-east-1`.
- **Persistence:** state lives in `.floci/`, which is git-ignored, so resources survive restarts.
- **Docker socket:** mounted so floci can run RDS, ECS and Lambda as real containers.

## Acceptance criteria

`features/local-emulator.feature` describes the expected behavior. `scripts/floci-smoke.sh` checks each scenario with only `curl` and `docker`. It starts floci if it isn't running, and it restarts floci during the persistence check.

## cdktn (Nx project `infra`)

The AWS infrastructure is written in TypeScript with [cdktn](https://cdktn.io) and `@cdktn/provider-aws` (hashicorp/aws `~> 6.0`), and run with OpenTofu.

**Prerequisite:** `brew install opentofu`. You need it for `plan`, `deploy` and `destroy`, but not for `synth` or `test`.

Pick an environment with `-c local|dev|uat|staging|prod`. The default is `local`, which targets floci.

| Task | Command |
| --- | --- |
| Generate Terraform JSON into `cdktn/cdktn.out` | `npx nx synth infra -c local` |
| Unit and feature tests (no Docker or OpenTofu needed) | `npx nx test infra` |
| Preview changes | `npx nx plan infra -c local` |
| Apply | `npx nx deploy infra -c local` |
| Tear down | `npx nx destroy infra -c local` |

- `cdktn/cdktf.json` keeps the CDKTF file name, because cdktn still reads that name. Its `targetVersions` declares only OpenTofu, so cdktn runs `tofu` and not `terraform`.
- Local state lives in `cdktn/.state/`, which is git-ignored. Floci endpoints, the S3 backend for AWS environments and default tags come in #8.
