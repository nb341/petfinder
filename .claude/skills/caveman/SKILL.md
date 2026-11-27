---
name: caveman
description: Explain a petfinder pull request in caveman speak (short words, short sentences, no fluff). Use when the user asks to explain, summarize or ELI5 a PR, branch or diff "caveman style", or types /caveman with a PR number or branch.
---

# Caveman PR Explainer

Explain one pull request so anyone can understand it in 30 seconds. **Only read and explain.** Don't edit files, comment on GitHub or post anything. Print the explanation in the terminal.

## 1. Find the Target

| Argument | What to read |
| --- | --- |
| PR number, for example `17` | `gh pr view 17 --json number,title,body,baseRefName,headRefName,files` and `gh pr diff 17` |
| Branch name | `gh pr view <branch> --json ...` if it has a PR, else `git diff main...<branch>` |
| Nothing | The current branch's PR (`gh pr view --json ...`), else `git diff main...HEAD` |

- **Read the real diff.** The title, body and commit messages give the *why*. The diff gives the *what*, so don't explain from the PR body alone.
- **Stacked PRs:** `gh pr diff` already compares against the PR's base, for example #17 against `feature/floci-local`. When you use `git diff`, use the base branch, not `main`.
- **Large diffs:** skip lockfiles and generated files (`package-lock.json`, `*.gen.*`, `cdktn.out/`). If package versions changed, mention that they did.
- **Ticket:** if the body says `Closes #N`, read `gh issue view N` for the why.

## 2. Caveman Rules

- Short words. Sentences of about 3–8 words. Drop "the", "a" and filler.
- Present tense. Talk about things, not people: "infra now TypeScript", not "Narindra added...".
- **Never caveman-ify exact names.** Keep files, commands, packages, labels and ticket numbers exact, in backticks: `npx nx synth infra -c local`, `#7`.
- Only say what the diff shows. If you're unsure, say "not sure" and don't guess.
- The voice is the only joke. No extra jokes or emoji.

## 3. Output

```markdown
## PR #<n>: <title>

**Big idea:** <one caveman line>

**What change:**
- **<area>:** <caveman line>
- ...  (3–6 bullets; areas: ui, api, infra, docs, tooling)

**Why:** <1–2 lines, from the ticket or PR body>

**Danger rocks:**
- <risk, breaking change, new package, migration, manual step>
(or "No danger rocks.")

**How test:**
<the commands from the PR's "How to test" section, verbatim in a code block>
```

If there's no PR, use the branch name as the heading. If the PR has no "How to test" section, list the obvious checks, such as `npx nx affected -t lint test`.

## Example (PR #17)

```markdown
## PR #17: feat(infrastructure): scaffold cdktn infra project with OpenTofu

**Big idea:** Infra now TypeScript. `nx synth infra` make Terraform JSON.

**What change:**
- **infra:** New Nx project `infra` in `infrastructure/cdktn/`.
- **infra:** Five targets: `synth`, `test`, `plan`, `deploy`, `destroy`.
- **infra:** Five envs: `local`, `dev`, `uat`, `staging`, `prod`. Default `local`.
- **infra:** No `tofu`? `plan` stop. Say `brew install opentofu`.
- **docs:** READMEs and plan doc point to `infrastructure/cdktn`.

**Why:** Ticket `#7`. Need infra code before network, database, ui hosting.

**Danger rocks:**
- New packages: `cdktn`, `cdktn-cli`, `@cdktn/provider-aws`, `constructs`.
- Bindings pin aws `6.71.0`. Stack override to `~> 6.0`.
- Stacked on `#16`. Merge `#16` first.

**How test:**
    npx nx run-many -t lint test synth -p infra
    npx nx plan infra -c local
```
