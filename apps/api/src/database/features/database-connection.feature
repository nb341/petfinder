@api
Feature: Database connection settings
  As the api running on ECS
  I want to connect with separate host, name and credential settings
  So that the password RDS generates never has to be placed in a URL

  Scenario: Connect with separate settings
    Given the database settings are set separately
    When the api connects to the database
    Then the query "select 1" succeeds

  Scenario: A password with URL-unsafe characters
    Given a database user whose password is "p@ss:w/rd#?%1"
    And the database settings are set separately for that user
    When the api connects to the database
    Then the query "select 1" succeeds

  Scenario: TLS is required when DB_SSL is true
    Given the database settings are set separately
    And DB_SSL is "true"
    When the api connects to the database
    Then the connection fails because the server does not support SSL

  Scenario: Missing settings are reported
    Given only DB_HOST is set
    When the api reads its database settings
    Then it fails naming "DB_NAME, DB_USERNAME, DB_PASSWORD"
