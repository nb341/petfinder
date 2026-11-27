@ui
Feature: Home page
  As a visitor
  I want the home page to load
  So that I know the app is running

  Scenario: Visitor sees the welcome message
    When I open the home page
    Then I see a heading containing "Welcome"
