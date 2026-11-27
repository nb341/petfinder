# Local services

Everything here is for running things on your machine. None of it is used by the AWS environments.

- `docker-compose.yml`: Postgres 17 (built from `postgres/Dockerfile`, with PostGIS, pgvector and btree_gist) for day-to-day api development, and [floci](https://floci.io/aws/), a local AWS emulator. With `--profile apps` it also runs the `api` and `ui` images from the root `Dockerfile`, with the ui on `http://localhost:8080`.
- `nginx/api-proxy.conf`: proxies `/api` to the api container. The ui calls relative URLs like `/api/pets` on its own origin. In AWS the load balancer sends `/api` to the api and everything else to nginx. Compose has no load balancer, so this snippet plays that role. It isn't in the ui image, which only serves static files.
- `floci.ts`: the only code that knows about floci (its endpoints, test credentials and local state). The stacks use it only when `INFRA_ENV=local`.
- `config.ts`: settings for the `local` env, which is dev's config pointed at floci.
- `scripts/`: `dev.sh`, `local-up.sh`, `setup-aws.sh` and `local-reset.sh` back the root `npm run dev`, `local:up` and `local:reset` scripts (see the root README). `setup-aws.sh` creates the S3 bucket, Cognito pool, client and demo user the apps use, and writes their ids to the git-ignored `.env.aws`.

Run `docker compose` commands from this folder. Compose reads the repo's root `.env`.

## floci

floci emulates AWS on `http://localhost:4566`. Use it now and then to try cdktn changes without an AWS account. AWS changes are verified against AWS itself, with synth and diff.

| Task | Command |
| --- | --- |
| Start | `docker compose up -d floci` |
| Health | `curl http://localhost:4566/_localstack/health` |
| Logs | `docker compose logs -f floci` |
| Stop | `docker compose stop floci` |
| Wipe emulated resources | `docker compose rm -sf floci && rm -rf .floci` |
| Smoke test | `./scripts/floci-smoke.sh` |
| cdktn against floci (from `infrastructure/`) | `npm run bootstrap:local`, then `synth:local`, `diff:local`, `deploy:local`, `destroy:local` |

- **Image:** pinned to `floci/floci:2.5.0`. Bump it on purpose, never use `latest`.
- **Ports:** `4566` (AWS API) and `7001-7099` (RDS proxies), bound to `127.0.0.1` only because floci's API is unauthenticated.
- **Credentials:** any values work. Use `test` / `test` in region `us-east-1`.
- **Persistence:** emulator data lives in `.floci/`, and cdktn state for the `local` stacks lives in `.state/`. Both are git-ignored.
- **Docker socket:** mounted so floci can run RDS, ECS and Lambda as real containers. On Docker Desktop, turn on Settings → Advanced → "Allow the default Docker socket to be used". Without it, an RDS instance reaches `available` but nothing listens behind it.
- **Smoke test:** `features/local-emulator.feature` describes floci's expected behavior, and `scripts/floci-smoke.sh` checks it with only `curl` and `docker`.

### Known floci gaps

- `db_endpoint` is floci's internal Docker IP. From your machine, connect to `localhost:<db_port>` instead. `db_port` is a proxy port, `7001` and up.
- floci reports `referenced_security_group_id` as `000000000000/sg-…`, so `diff:local` always shows one harmless update on `db-from-app`.

### Point the api at floci RDS

After `npm run deploy:local`, read the generated password from Secrets Manager:

```bash
cd infrastructure/cdktn.out/stacks/local-application
PORT=$(tofu output -raw db_port)
SECRET=$(tofu output -raw db_secret_arn)
curl -s --aws-sigv4 "aws:amz:us-east-1:secretsmanager" --user test:test \
  -H 'X-Amz-Target: secretsmanager.GetSecretValue' -H 'Content-Type: application/x-amz-json-1.1' \
  -d "{\"SecretId\":\"$SECRET\"}" http://localhost:4566/ | jq -r '.SecretString | fromjson | .password | @uri'
```

Then set `DATABASE_URL=postgresql://petfinder:<password>@localhost:<PORT>/petfinder` in the root `.env` and run the api as usual. To switch back to the Postgres container, restore the `localhost:5432` URLs from `.env.example`.
