---
name: infrastructure-changes
description: How to build and verify petfinder infrastructure changes without writing tests. Use whenever you change anything in infrastructure/ (cdktn config, modules, stacks, scripts), the Dockerfile or docker compose, or plan, review or open a PR for that work. It overrides the bdd-tdd skill for infrastructure.
---

# Infrastructure Changes

**Don't write tests for infrastructure.** This includes unit, config, snapshot, synth and floci tests, plus Gherkin features and step definitions. The bdd-tdd skill doesn't apply to `infrastructure/`, the `Dockerfile` or compose files.

Verify every change with **`cdktn synth` and `cdktn diff`** only.

## Verify

Run these from `infrastructure/`:

1. **Typecheck:** `npm run typecheck`.
2. **Synth:** `npm run synth:<env>`, or `npm run synth:registry` for the shared registry.
   - Read the generated JSON in `cdktn.out/stacks/<stack>/cdk.tf.json`.
   - Check what the change is meant to do. For example: security group sources and ports, `publicly_accessible`, encryption, deletion protection in prod, tags, state keys.
   - Synth needs `INFRA_AWS_ACCOUNT_ID`. If the root `.env` has none, prefix the command with a placeholder: `INFRA_AWS_ACCOUNT_ID=123456789012 npm run synth:dev`.
3. **Diff:** `npm run diff:<env>`. It should show only the intended creates, updates and destroys, with no unexpected replacements.
   - `diff` needs AWS credentials. If none are available, compare synth output from before and after the change instead: resources added, changed and removed per stack. Say in the PR that `diff` wasn't run.
4. **Existing tests:** if `tests/` still has tests, run `npm test` so they keep passing. Don't add new ones.

Don't deploy to floci or curl deployed resources unless the user asks.

## PR "How to test"

List only these commands:
- `npm run typecheck`
- `npm run synth:<env>`, with the specific things to check in the JSON
- `npm run diff:<env>`, with the expected counts, for example "13 to add, 0 to change, 0 to destroy"

Also state what you couldn't run, such as `diff` without credentials.
