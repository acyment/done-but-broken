Feature: widgets

  Scenario: Creating a Widget returns the stored entity
    When I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
    Then the response status is 201
    And the response body equals {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
    When I send a GET request to "/widgets/widget-spec-1"
    Then the response status is 200
    And the response body equals {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}

  Scenario: Creating a Widget without name is rejected
    When I send a POST request to "/widgets" with body {"id":"widget-spec-1","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
    Then the response status is 400
    And the response field "error.code" equals "validation_error"
    And the response field "error.message" is a string

  Scenario: Creating a Widget with a non-decimal price is rejected
    When I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":"1.5","in_stock":false,"category_id":"category-seed-1"}
    Then the response status is 400
    And the response field "error.code" equals "validation_error"
    And the response field "error.message" is a string

  Scenario: Creating a Widget with a non-bool in_stock is rejected
    When I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":"yes","category_id":"category-seed-1"}
    Then the response status is 400
    And the response field "error.code" equals "validation_error"
    And the response field "error.message" is a string

  Scenario: Creating a Widget with an invalid price is rejected
    When I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":-1,"in_stock":false,"category_id":"category-seed-1"}
    Then the response status is 400
    And the response field "error.code" equals "validation_error"
    And the response field "error.message" is a string

  Scenario: Fetching a missing Widget returns not found
    When I send a GET request to "/widgets/widget-spec-missing"
    Then the response status is 404
    And the response field "error.code" equals "not_found"
    And the response field "error.message" is a string

  Scenario: Updating a Widget persists the change
    When I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
    Then the response status is 201
    When I send a PUT request to "/widgets/widget-spec-1" with body {"id":"widget-spec-1","name":"Sample name 6","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
    Then the response status is 200
    And the response body equals {"id":"widget-spec-1","name":"Sample name 6","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
    When I send a GET request to "/widgets/widget-spec-1"
    Then the response status is 200
    And the response body equals {"id":"widget-spec-1","name":"Sample name 6","price":5.5,"in_stock":false,"category_id":"category-seed-1"}

  Scenario: Deleting a Widget removes it
    When I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
    Then the response status is 201
    When I send a DELETE request to "/widgets/widget-spec-1"
    Then the response status is 204
    When I send a GET request to "/widgets/widget-spec-1"
    Then the response status is 404
    And the response field "error.code" equals "not_found"

  Scenario: Creating a Widget increases the list count
    When I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
    Then the response status is 201
    When I send a GET request to "/widgets"
    Then the response status is 200
    And the response list has length 3

  Scenario: Filtering widgets by category_id returns only matching rows
    When I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
    Then the response status is 201
    When I send a GET request to "/widgets?category_id=category-seed-1"
    Then the response status is 200
    And the response list has length 2

  Scenario: Creating a Widget increases the reported count
    When I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
    Then the response status is 201
    When I send a GET request to "/widgets/stats"
    Then the response status is 200
    And the response field "count" equals 3
