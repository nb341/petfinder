---
name: create-ticket
description: Create GitHub issues (tickets) for petfinder with the correct area labels and Gherkin acceptance criteria. Use whenever the user asks to create, write, draft, file, or break work into tickets, issues, stories, or tasks, or to label existing issues or PRs.
---

# Create Ticket

Every ticket is a GitHub issue in `nb341/petfinder`. Each one has:
1. **at least one area label**
2. **Gherkin acceptance criteria**

## Labels

| Label | Use for |
| --- | --- |
| `frontend` | Angular `apps/ui`: pages, components, styling, client state |
| `backend` | NestJS `apps/api`: endpoints, services, DB access, validation |
| `devops` | Docker, Nx config, CI/CD, floci/AWS, tooling, dev workflow, test infra |
| `performance` | Speed, load time, bundle size, query efficiency, caching |

- Apply **every** label that fits. For example, a slow API endpoint gets `backend` and `performance`.
- `performance` is always combined with an area label.
- Add `bug` for defects and `enhancement` for new features when that helps.
- Use the same rules to label PRs: `gh pr edit <n> --add-label <labels>`.

## Writing the Ticket

- **Title:** short and outcome-focused, prefixed with the main area, for example `[Backend] List available pets`.
- **One ticket, one deliverable behavior.** If the acceptance criteria need more than about 5 scenarios or span unrelated behaviors, split the ticket. A full-stack feature usually becomes one `backend` ticket and one `frontend` ticket. Link them under Notes.
- **Acceptance criteria:** follow the Gherkin rules in the `pr-acceptance-criteria` skill (declarative steps, one behavior per scenario, concrete values). Cover the happy path, edge cases and error cases. The scenarios should be usable as the ticket's `.feature` file in the `bdd-tdd` workflow.
- Tag the feature with `@ui`, `@api`, `@infra` or `@performance`.
- **Performance tickets** need measurable thresholds, for example "responds within 200 ms at the 95th percentile" or "initial bundle under 500 kB", never "is fast".
- Use only what the user asked for. List open questions under Notes instead of inventing requirements.

## Body Format

This matches the issue templates in `.github/ISSUE_TEMPLATE/`.

````markdown
### Summary
<what is needed and why, 1–3 sentences>

### Acceptance Criteria
```gherkin
@api
Feature: <capability>
  As a <role>
  I want <goal>
  So that <benefit>

  Scenario: <happy path>
    Given <context>
    When <action>
    Then <observable outcome>

  Scenario: <edge or error case>
    Given <context>
    When <action>
    Then <observable outcome>
```

### Notes
<out of scope, dependencies, related tickets, open questions>
````

## Creating It

1. Draft the ticket(s) and show them to the user before creating them, unless the user already said to create them directly.
2. Create each one with `gh`, passing the body through a heredoc:
   ```bash
   gh issue create --title "[Backend] List available pets" --label backend --body "$(cat <<'EOF'
   ...
   EOF
   )"
   ```
3. Report each issue URL and its labels.
