Feature: mixed

  Scenario: Bolded keywords with colons and star bullets
    Given a seeded store
    When I send a GET request to "/widgets"
    Then the response status is 200
    And the response list has length 2
    But the response has no field "error"

  Scenario: Three-hash scenario header still parses
    When lowercase keyword casing is normalized
    Then mixed case binds too

  Scenario: Empty scenario

  Scenario: Interleaved prose is skipped
    When I send a DELETE request to "/widgets/widget-spec-1"
    Then the response status is 204

  Scenario: Whitespace   trimming   in titles
    When spaced   step   text   is   trimmed
