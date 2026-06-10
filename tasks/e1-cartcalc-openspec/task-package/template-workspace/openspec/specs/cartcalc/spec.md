# cartcalc Specification

## Purpose
Cart subtotal and total calculation rules for the storefront.

## Requirements

### Requirement: Line and cart subtotals
The cart SHALL compute line subtotals as unit price times quantity and cart subtotals as the sum of line subtotals.

#### Scenario: Mug line subtotal
- **GIVEN** a line item with unit price 250 cents and quantity 2
- **WHEN** the line subtotal is computed
- **THEN** the result is 500 cents

#### Scenario: Mixed cart subtotal
- **GIVEN** a cart with a 250-cent mug times 2 and a 100-cent sticker times 3
- **WHEN** the cart subtotal is computed
- **THEN** the result is 800 cents

#### Scenario: Total without discount
- **GIVEN** a cart with no discount configured
- **WHEN** the total is computed
- **THEN** the total equals the cart subtotal
