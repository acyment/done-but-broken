# mixed Specification

Steps before any scenario header are ignored:
- **WHEN** this step has no scenario

## Purpose
Adversarial parse-shape fixture for the openspec-gherkin converter cross-test.

## Requirements

### Requirement: Mixed keyword shapes
The service SHALL tolerate every parse shape the converter accepts.

#### Scenario: Bolded keywords with colons and star bullets
* **GIVEN**: a seeded store
- **WHEN** : I send a GET request to "/widgets"
* **THEN**  the response status is 200
- **AND** the response list has length 2
- **BUT** the response has no field "error"

### Scenario: Three-hash scenario header still parses
   - **when** lowercase keyword casing is normalized
- **Then** mixed case binds too

#### Scenario: Empty scenario

#### Scenario: Interleaved prose is skipped
This free-prose line is not a step.
- plain bullet without bold keyword is not a step
- **WHEN** I send a DELETE request to "/widgets/widget-spec-1"
some trailing prose
- **THEN** the response status is 204

#### Scenario: Whitespace   trimming   in titles
  - **WHEN**   spaced   step   text   is   trimmed
