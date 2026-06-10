Feature: CartCalc visible semantic contract

  Scenario: Visible specs are supplied through checkpoint prompts
    Given the active checkpoint prompt
    Then the agent implements only files under src
