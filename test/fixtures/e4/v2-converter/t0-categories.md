# categories Specification

## Purpose
This specification pins the observable HTTP behavior of the Category endpoints served by this application.

## Requirements

### Requirement: Creating a Category
The service SHALL create a Category from a valid POST body and reject invalid create requests.

#### Scenario: Creating a Category returns the stored entity
- **WHEN** I send a POST request to "/categories" with body {"id":"category-spec-1","name":"Sample name 5"}
- **THEN** the response status is 201
- **AND** the response body equals {"id":"category-spec-1","name":"Sample name 5"}
- **WHEN** I send a GET request to "/categories/category-spec-1"
- **THEN** the response status is 200
- **AND** the response body equals {"id":"category-spec-1","name":"Sample name 5"}

#### Scenario: Creating a Category without name is rejected
- **WHEN** I send a POST request to "/categories" with body {"id":"category-spec-1"}
- **THEN** the response status is 400
- **AND** the response field "error.code" equals "validation_error"
- **AND** the response field "error.message" is a string

### Requirement: Fetching a Category
The service SHALL return an existing Category by id and report not found for a missing id.

#### Scenario: Fetching a missing Category returns not found
- **WHEN** I send a GET request to "/categories/category-spec-missing"
- **THEN** the response status is 404
- **AND** the response field "error.code" equals "not_found"
- **AND** the response field "error.message" is a string

### Requirement: Updating a Category
The service SHALL persist valid updates submitted for an existing Category.

#### Scenario: Updating a Category persists the change
- **WHEN** I send a POST request to "/categories" with body {"id":"category-spec-1","name":"Sample name 5"}
- **THEN** the response status is 201
- **WHEN** I send a PUT request to "/categories/category-spec-1" with body {"id":"category-spec-1","name":"Sample name 6"}
- **THEN** the response status is 200
- **AND** the response body equals {"id":"category-spec-1","name":"Sample name 6"}
- **WHEN** I send a GET request to "/categories/category-spec-1"
- **THEN** the response status is 200
- **AND** the response body equals {"id":"category-spec-1","name":"Sample name 6"}

### Requirement: Deleting a Category
The service SHALL remove an existing Category and stop serving it.

#### Scenario: Deleting a Category removes it
- **WHEN** I send a POST request to "/categories" with body {"id":"category-spec-1","name":"Sample name 5"}
- **THEN** the response status is 201
- **WHEN** I send a DELETE request to "/categories/category-spec-1"
- **THEN** the response status is 204
- **WHEN** I send a GET request to "/categories/category-spec-1"
- **THEN** the response status is 404
- **AND** the response field "error.code" equals "not_found"

### Requirement: Listing Category records
The service SHALL list stored Category records.

#### Scenario: Creating a Category increases the list count
- **WHEN** I send a POST request to "/categories" with body {"id":"category-spec-1","name":"Sample name 5"}
- **THEN** the response status is 201
- **WHEN** I send a GET request to "/categories"
- **THEN** the response status is 200
- **AND** the response list has length 3
