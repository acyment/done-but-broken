# widgets Specification

## Purpose
This specification pins the observable HTTP behavior of the Widget endpoints served by this application.

## Requirements

### Requirement: Creating a Widget
The service SHALL create a Widget from a valid POST body and reject invalid create requests.

#### Scenario: Creating a Widget returns the stored entity
- **WHEN** I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
- **THEN** the response status is 201
- **AND** the response body equals {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
- **WHEN** I send a GET request to "/widgets/widget-spec-1"
- **THEN** the response status is 200
- **AND** the response body equals {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}

#### Scenario: Creating a Widget without name is rejected
- **WHEN** I send a POST request to "/widgets" with body {"id":"widget-spec-1","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
- **THEN** the response status is 400
- **AND** the response field "error.code" equals "validation_error"
- **AND** the response field "error.message" is a string

#### Scenario: Creating a Widget with a non-decimal price is rejected
- **WHEN** I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":"1.5","in_stock":false,"category_id":"category-seed-1"}
- **THEN** the response status is 400
- **AND** the response field "error.code" equals "validation_error"
- **AND** the response field "error.message" is a string

#### Scenario: Creating a Widget with a non-bool in_stock is rejected
- **WHEN** I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":"yes","category_id":"category-seed-1"}
- **THEN** the response status is 400
- **AND** the response field "error.code" equals "validation_error"
- **AND** the response field "error.message" is a string

#### Scenario: Creating a Widget with an invalid price is rejected
- **WHEN** I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":-1,"in_stock":false,"category_id":"category-seed-1"}
- **THEN** the response status is 400
- **AND** the response field "error.code" equals "validation_error"
- **AND** the response field "error.message" is a string

### Requirement: Fetching a Widget
The service SHALL return an existing Widget by id and report not found for a missing id.

#### Scenario: Fetching a missing Widget returns not found
- **WHEN** I send a GET request to "/widgets/widget-spec-missing"
- **THEN** the response status is 404
- **AND** the response field "error.code" equals "not_found"
- **AND** the response field "error.message" is a string

### Requirement: Updating a Widget
The service SHALL persist valid updates submitted for an existing Widget.

#### Scenario: Updating a Widget persists the change
- **WHEN** I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
- **THEN** the response status is 201
- **WHEN** I send a PUT request to "/widgets/widget-spec-1" with body {"id":"widget-spec-1","name":"Sample name 6","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
- **THEN** the response status is 200
- **AND** the response body equals {"id":"widget-spec-1","name":"Sample name 6","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
- **WHEN** I send a GET request to "/widgets/widget-spec-1"
- **THEN** the response status is 200
- **AND** the response body equals {"id":"widget-spec-1","name":"Sample name 6","price":5.5,"in_stock":false,"category_id":"category-seed-1"}

### Requirement: Deleting a Widget
The service SHALL remove an existing Widget and stop serving it.

#### Scenario: Deleting a Widget removes it
- **WHEN** I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
- **THEN** the response status is 201
- **WHEN** I send a DELETE request to "/widgets/widget-spec-1"
- **THEN** the response status is 204
- **WHEN** I send a GET request to "/widgets/widget-spec-1"
- **THEN** the response status is 404
- **AND** the response field "error.code" equals "not_found"

### Requirement: Listing Widget records
The service SHALL list stored Widget records.

#### Scenario: Creating a Widget increases the list count
- **WHEN** I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
- **THEN** the response status is 201
- **WHEN** I send a GET request to "/widgets"
- **THEN** the response status is 200
- **AND** the response list has length 3

#### Scenario: Filtering widgets by category_id returns only matching rows
- **WHEN** I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
- **THEN** the response status is 201
- **WHEN** I send a GET request to "/widgets?category_id=category-seed-1"
- **THEN** the response status is 200
- **AND** the response list has length 2

### Requirement: Reporting Widget statistics
The service SHALL report summary statistics over stored Widget records.

#### Scenario: Creating a Widget increases the reported count
- **WHEN** I send a POST request to "/widgets" with body {"id":"widget-spec-1","name":"Sample name 5","price":5.5,"in_stock":false,"category_id":"category-seed-1"}
- **THEN** the response status is 201
- **WHEN** I send a GET request to "/widgets/stats"
- **THEN** the response status is 200
- **AND** the response field "count" equals 3
