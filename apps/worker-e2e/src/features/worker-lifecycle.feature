@worker
Feature: Worker lifecycle
  As the platform operator
  I want the worker to start and stop cleanly
  So that ECS can deploy and replace it without losing work

  Scenario: The worker starts
    When I start the worker
    Then it logs "Worker started" within 10 seconds

  Scenario: The worker shuts down gracefully
    Given the worker is running
    When it receives SIGTERM
    Then it logs "Worker stopped (SIGTERM)"
    And it exits within 10 seconds
