@api
Feature: API root
  As an API client
  I want a root endpoint
  So that I can confirm the API is running

  Scenario: Client calls the API root
    When I send GET "/api"
    Then the response status is 200
    And the response body is:
      """
      { "message": "Hello API" }
      """
