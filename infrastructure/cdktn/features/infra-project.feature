@infra
Feature: Infrastructure project
  As a developer
  I want the infrastructure defined in TypeScript inside the monorepo
  So that it is versioned, tested and run with the same tooling as the apps

  Scenario: Synthesize the infrastructure
    When I synthesize the "local" environment
    Then Terraform JSON is generated for the stack "petfinder-local"
    And it targets the "hashicorp/aws" provider version "~> 6.0"

  Scenario: Missing OpenTofu is reported clearly
    Given OpenTofu is not installed
    When I run the OpenTofu preflight check
    Then the command fails with a message to install OpenTofu
