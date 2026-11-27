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

**Prerequisite:** `brew install opentofu`. You need it for `plan`, `deploy` and `destroy`, but not for `synth`.

Pick an environment with `-c local|dev|uat|staging|prod`. The default is `local`, which targets floci.

| Task | Command |
| --- | --- |
| Generate Terraform JSON into `cdktn/cdktn.out` | `npx nx synth infra -c local` |
| Preview changes | `npx nx plan infra -c local` |
| Apply | `npx nx deploy infra -c local` |
| Tear down | `npx nx destroy infra -c local` |
| Create the state bucket | `npx nx bootstrap infra -c dev` |

- `cdktn/cdktf.json` keeps the CDKTF file name, because cdktn still reads that name. Its `targetVersions` declares only OpenTofu, so cdktn runs `tofu` and not `terraform`.
- Local state lives in `cdktn/.state/`, which is git-ignored, along with the rest of cdktn's recommended ignores in `cdktn/.gitignore`.

### Environments

| Env | Target | State | Credentials |
| --- | --- | --- | --- |
| `local` | floci on `localhost:4566` | `cdktn/.state/local.tfstate` | `test` / `test` |
| `dev`, `uat`, `staging`, `prod` | AWS `us-east-1`, one account | S3 `petfinder-tfstate-<account id>`, key `petfinder/<env>.tfstate`, locked with `use_lockfile` | AWS profile `petfinder-<env>` |

Every resource gets the default tags `project=petfinder`, `env=<env>` and `managed-by=cdktn`.

### First-time AWS setup

1. Set `INFRA_AWS_ACCOUNT_ID` in the root `.env`. See `.env.example`.
2. Create the AWS profiles `petfinder-dev`, `petfinder-uat`, `petfinder-staging` and `petfinder-prod` (for example with `aws configure sso`), then log in: `aws sso login --profile petfinder-dev`.
3. Create the state bucket once per account with `npx nx bootstrap infra -c dev`. Its own state is kept in `cdktn/.state/bootstrap-aws.tfstate`, so back that file up.
4. Run `npx nx plan infra -c dev`.

### Network

Each env gets a VPC across `us-east-1a` and `us-east-1b`, with 2 public and 2 private `/24` subnets. Only the public route table has a route to the internet gateway.
- **CIDRs:** `local` 10.0.0.0/16, `dev` 10.10, `uat` 10.20, `staging` 10.30, `prod` 10.40.
- **NAT:** set `nat: 'single'` for an env in `cdktn/src/config/index.ts` to give its private subnets outbound internet, at about $33 a month on AWS. Every env is `none` for now.
- **Security groups:** `app` (for API compute) and `db` (`5432` only from `app`).
- **Outputs:** `vpc_id`, `public_subnet_ids`, `private_subnet_ids`, `app_security_group_id` and `db_security_group_id`.

To check the network on floci after `npx nx deploy infra -c local`, read it back with signed `curl` requests. No AWS CLI is needed:

```bash
ec2() { curl -s --aws-sigv4 "aws:amz:us-east-1:ec2" --user test:test -d "Version=2016-11-15&$1" http://localhost:4566/; }
VPC=$(cd cdktn/cdktn.out/stacks/petfinder-local && tofu output -raw vpc_id)
ec2 "Action=DescribeSubnets&Filter.1.Name=vpc-id&Filter.1.Value.1=$VPC"       # 4 subnets, 2 AZs
ec2 "Action=DescribeRouteTables&Filter.1.Name=vpc-id&Filter.1.Value.1=$VPC"   # igw route only on the public table
ec2 "Action=DescribeSecurityGroups&Filter.1.Name=vpc-id&Filter.1.Value.1=$VPC"
```

### Checking it by hand on floci

1. Run `npx nx bootstrap infra -c local`, then `npx nx deploy infra -c local`.
2. Check the state bucket exists with `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4566/petfinder-tfstate-000000000000`, which should print `200`.
3. Check the bucket rules in `cdktn/cdktn.out/stacks/petfinder-bootstrap/cdk.tf.json`: versioning `Enabled`, `AES256`, all four public access blocks, and the TLS-only policy.
4. Check the tags with `jq '.provider.aws[0].default_tags' cdktn/cdktn.out/stacks/petfinder-local/cdk.tf.json`.
