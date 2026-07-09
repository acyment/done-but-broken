Feature: categories

  Scenario: Creating a Category returns the stored entity
    When I send a POST request to "/categories" with body {"id":"category-spec-1","name":"Sample name 5"}
    Then the response status is 201
    And the response body equals {"id":"category-spec-1","name":"Sample name 5"}
    When I send a GET request to "/categories/category-spec-1"
    Then the response status is 200
    And the response body equals {"id":"category-spec-1","name":"Sample name 5"}

  Scenario: Creating a Category without name is rejected
    When I send a POST request to "/categories" with body {"id":"category-spec-1"}
    Then the response status is 400
    And the response field "error.code" equals "validation_error"
    And the response field "error.message" is a string

  Scenario: Fetching a missing Category returns not found
    When I send a GET request to "/categories/category-spec-missing"
    Then the response status is 404
    And the response field "error.code" equals "not_found"
    And the response field "error.message" is a string

  Scenario: Updating a Category persists the change
    When I send a POST request to "/categories" with body {"id":"category-spec-1","name":"Sample name 5"}
    Then the response status is 201
    When I send a PUT request to "/categories/category-spec-1" with body {"id":"category-spec-1","name":"Sample name 6"}
    Then the response status is 200
    And the response body equals {"id":"category-spec-1","name":"Sample name 6"}
    When I send a GET request to "/categories/category-spec-1"
    Then the response status is 200
    And the response body equals {"id":"category-spec-1","name":"Sample name 6"}

  Scenario: Deleting a Category removes it
    When I send a POST request to "/categories" with body {"id":"category-spec-1","name":"Sample name 5"}
    Then the response status is 201
    When I send a DELETE request to "/categories/category-spec-1"
    Then the response status is 204
    When I send a GET request to "/categories/category-spec-1"
    Then the response status is 404
    And the response field "error.code" equals "not_found"

  Scenario: Creating a Category increases the list count
    When I send a POST request to "/categories" with body {"id":"category-spec-1","name":"Sample name 5"}
    Then the response status is 201
    When I send a GET request to "/categories"
    Then the response status is 200
    And the response list has length 3
