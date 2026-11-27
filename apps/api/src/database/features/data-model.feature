@api
Feature: Data model
  As the petfinder api
  I want shelters, pets, users and adoption applications stored with enforced rules
  So that the data stays consistent no matter which endpoint writes it

  Background:
    Given an empty database with all migrations applied

  Scenario: Migrations create the schema
    Then the tables "shelters, pets, pet_photos, users, adoption_applications" exist

  Scenario: A new pet is available by default
    Given a shelter "Happy Paws"
    When I add a dog named "Rex" to "Happy Paws"
    Then "Rex" has status "available"

  Scenario: A pet must belong to a shelter
    When I add a dog named "Stray" without a shelter
    Then the save is rejected

  Scenario: Removing a shelter removes its pets and their photos
    Given a shelter "Happy Paws" with a dog named "Rex" that has 2 photos
    When I delete the shelter "Happy Paws"
    Then no pets or photos remain

  Scenario: User emails are unique regardless of case
    Given a user with email "sam@example.com"
    When I add another user with email "SAM@example.com"
    Then the save is rejected

  Scenario: A new adoption application is submitted by default
    Given a shelter "Happy Paws" with a dog named "Rex"
    And an adopter "sam@example.com"
    When "sam@example.com" applies to adopt "Rex"
    Then the application has status "submitted"

  Scenario: An adopter can apply only once per pet
    Given a shelter "Happy Paws" with a dog named "Rex"
    And an adopter "sam@example.com" who has applied to adopt "Rex"
    When "sam@example.com" applies to adopt "Rex"
    Then the save is rejected

  Scenario: A pet with adoption applications cannot be deleted
    Given a shelter "Happy Paws" with a dog named "Rex"
    And an adopter "sam@example.com" who has applied to adopt "Rex"
    When I delete the pet "Rex"
    Then the delete is rejected

  Scenario: Migrations can be reverted
    When I revert all migrations
    Then the tables "shelters, pets, pet_photos, users, adoption_applications" do not exist
