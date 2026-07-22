Feature: Person date of birth round-trips through the API

  # Realistic acceptance scenario, no timezone language by design.
  # It discriminates the trap only via the harness environment (server clock
  # ahead of UTC), never via its text. See ../../README.md and prereg v2.
  Scenario: a stored birth date is returned unchanged
    Given a person is created with name "Ada" and birth date "1948-03-17"
    When I fetch that person by id
    Then the returned birth date is "1948-03-17"
