---
name: pr-acceptance-criteria
description: Write Gherkin (Given/When/Then) acceptance criteria for a pull request. Use whenever creating a PR, drafting or updating a PR description, or when the user asks for acceptance criteria, Gherkin scenarios, or BDD-style criteria for a change in this repo.
---

# PR Acceptance Criteria (Gherkin)

Every pull request in this repo has an **Acceptance Criteria** section written in Gherkin. The criteria describe the behavior the change delivers, so a reviewer can verify it without reading the code.

## Workflow

1. **Understand the change.** Read what the branch actually does. Don't rely on the branch name or commit messages alone.
   ```bash
   git log --oneline main..HEAD
   git diff main...HEAD --stat
   git diff main...HEAD
   ```
2. **Identify the behaviors.** List what someone can now observe or do that they couldn't before. That person is an end user for `apps/ui`, an API client for `apps/api`, and a developer for tooling and infra such as Docker, Nx config or CI.
3. **Write one `Feature` per area of behavior** and give each behavior its own `Scenario`. Cover:
   - the happy path
   - important edge cases, such as empty or boundary input
   - error and failure cases, such as invalid input, missing auth or a service being down
4. **Put the criteria in the PR body** under `## Acceptance Criteria`, in a fenced ```` ```gherkin ```` block. Use the template below.
5. **Check every scenario against the diff.** Don't write criteria for behavior the PR doesn't implement. Put planned work under "Not in this PR".

## Gherkin Rules

- **Declarative, not imperative.** Describe *what* happens, not each click or line of code.
  - Good: `When I search for dogs near "Toronto"`
  - Bad: `When I click the search box and type "dog" and press Enter`
- **One behavior per scenario.** Each scenario should test exactly one outcome.
- **Given** sets up the starting state, **When** is the single action, and **Then** is the observable outcome. Use `And` and `But` for extra steps of the same kind.
- Keep each scenario to about 3–7 steps. If it's longer, split it.
- Use `Background:` for setup shared by every scenario in a feature.
- Use `Scenario Outline:` with `Examples:` when the same behavior is checked with several inputs.
- Use concrete, realistic values, such as `"Rex"`, `404`, or `"/api/pets"`, not "some value".
- Leave implementation details (class names, ORM calls, internal functions) out of the steps. Keep observable contracts such as HTTP status codes, routes, CLI commands and visible UI text.
- Use domain language from the app: pets, shelters, adopters and listings.
- Tags are optional. Use `@ui`, `@api`, `@infra` or `@e2e` to show where a scenario applies.

## PR Body Template

````markdown
## Summary
- <what changed and why, 1–4 bullets>

## Acceptance Criteria
```gherkin
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

## How to test
<commands or steps a reviewer can run>

## Not in this PR
- <out-of-scope or follow-up work>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
````

## Examples

### Infra / developer-facing change

```gherkin
@infra
Feature: Local Postgres database
  As a developer
  I want to run Postgres locally with one command
  So that the api has a database to develop against

  Background:
    Given Docker Desktop is running
    And I have copied ".env.example" to ".env"

  Scenario: Start the database
    When I run "docker compose up -d"
    Then the "petfinder-postgres" container reports "healthy"
    And Postgres accepts connections on "localhost:5432"

  Scenario: Data survives a restart
    Given a table contains 1 row
    When I run "docker compose restart postgres"
    Then the table still contains 1 row

  Scenario: Wiping local data
    When I run "docker compose down -v"
    Then the "postgres-data" volume is removed
```

### API change

```gherkin
@api
Feature: List pets
  As an adopter
  I want to browse available pets
  So that I can find one to adopt

  Scenario: Pets are returned
    Given 3 pets are available for adoption
    When I send GET "/api/pets"
    Then the response status is 200
    And the response contains 3 pets

  Scenario Outline: Filter by species
    Given available pets include dogs and cats
    When I send GET "/api/pets?species=<species>"
    Then every returned pet has species "<species>"

    Examples:
      | species |
      | dog     |
      | cat     |

  Scenario: Invalid species
    When I send GET "/api/pets?species=dragon"
    Then the response status is 400
```

### UI change

```gherkin
@ui
Feature: Pet details page
  Scenario: Viewing a pet
    Given a pet named "Rex" exists
    When I open the details page for "Rex"
    Then I see the name "Rex", photo, age, and breed

  Scenario: Pet not found
    When I open the details page for a pet that does not exist
    Then I see the message "This pet could not be found"
```
