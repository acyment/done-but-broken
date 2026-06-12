# dispatch Specification

## Purpose
Order dispatch engine: order lifecycle, the partner export/import API, and the operations status digest.

## Requirements

### Requirement: Order lifecycle status
The engine SHALL derive each order's status from its events: cancelled orders are cancelled; unpaid orders are awaiting_payment; paid orders with every line shipped are shipped; all other paid orders are processing.

#### Scenario: Paid order awaiting shipment
- **GIVEN** an order_created event followed by payment_received
- **WHEN** the order status is queried
- **THEN** the status is processing

#### Scenario: Fully shipped order
- **GIVEN** a paid order with a line_shipped event for every line
- **WHEN** the order status is queried
- **THEN** the status is shipped

### Requirement: Order export
The engine SHALL export an order as a JSON document with a fixed field order, omitting empty or false values, including the order id, its status, the total in integer cents, and one entry per line.

#### Scenario: Exported order shows shipped lines
- **GIVEN** a paid order with one shipped line
- **WHEN** the order export is queried
- **THEN** the exported document marks that line shipped:true and omits the flag on unshipped lines

### Requirement: Order import round-trip
The engine SHALL re-import an exported order and reproduce the order's data, and SHALL reject documents whose status value is unknown.

#### Scenario: Round-trip preserves order data
- **GIVEN** any order
- **WHEN** the order is exported and the export is re-imported
- **THEN** the re-imported order carries the same id, status, total, and lines

### Requirement: Status digest
The engine SHALL report a digest of all orders bucketed by status, with buckets listed in lifecycle order and empty buckets omitted.

#### Scenario: Digest groups orders by status
- **GIVEN** orders in two different statuses
- **WHEN** the status digest is queried
- **THEN** exactly two buckets appear, in lifecycle order, each with its order count
