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
