# billing Specification

## Purpose
Subscription billing engine: subscriptions, invoices, payments, and the audit trail.

## Requirements

### Requirement: Subscription creation and lifecycle
The engine SHALL create subscriptions from subscription_created events, starting trialing when the trial flag is set and active otherwise, and SHALL only move subscriptions along the documented lifecycle trialing to active to past_due to canceled.

#### Scenario: Active subscription created
- **GIVEN** a subscription_created event without the trial flag
- **WHEN** the subscription view is queried
- **THEN** the subscription status is active with the plan and period from the event

#### Scenario: Trial subscription activated
- **GIVEN** a subscription created with the trial flag and a subscription_activated event
- **WHEN** the subscription view is queried
- **THEN** the subscription status is active

### Requirement: Audit log sequence numbers
The engine SHALL append exactly one audit entry per applied event to that event's aggregate, with sequence numbers starting at 1 and gap-free per aggregate.

#### Scenario: Two events on one aggregate
- **GIVEN** a subscription with two applied events
- **WHEN** the audit log for the subscription is queried
- **THEN** the entries carry sequence numbers 1 and 2 in application order

### Requirement: Invoice generation and totals
The engine SHALL generate an invoice from an invoice_generated event with a plan line at the subscription's current plan price plus one line per usage entry, rounding each usage amount half-even at line level, and the invoice total SHALL equal the sum of the rounded line amounts.

#### Scenario: Plan plus usage invoice
- **GIVEN** an active subscription and an invoice_generated event with one usage entry
- **WHEN** the invoice view is queried
- **THEN** the invoice has a plan line and a usage line and the total equals the sum of the rounded line amounts

#### Scenario: Usage rounding ties to even
- **GIVEN** a usage entry whose raw amount lands exactly on a half cent
- **WHEN** the line amount is computed
- **THEN** the amount is rounded half-even to the nearest even cent

### Requirement: Idempotent payment capture
The engine SHALL apply payment_captured events by adding to the invoice's captured amount, marking the invoice paid when captured equals the total, and SHALL treat a duplicate event id as a complete no-op with no state change and no audit entry.

#### Scenario: Full capture marks invoice paid
- **GIVEN** an open invoice and a payment_captured event for the full total
- **WHEN** the invoice view is queried
- **THEN** the invoice status is paid

#### Scenario: Duplicate capture is a no-op
- **GIVEN** the same payment_captured event delivered twice
- **WHEN** the invoice view and audit log are queried
- **THEN** the captured amount counts the event once and the audit log has a single capture entry

### Requirement: Byte-stable v1 invoice serialization
The engine SHALL serialize invoices in the legacy v1 format as a pure string builder with frozen field order v, invoice, subscription, status, lines, subtotal, discount when positive, total, omitting zero-valued optional fields, and the byte output for previously serializable invoices SHALL never change.

#### Scenario: Open invoice serializes byte-stably
- **GIVEN** an open invoice with a plan line
- **WHEN** serialize_v1 is queried
- **THEN** the output is the exact legacy byte string with the frozen field order
