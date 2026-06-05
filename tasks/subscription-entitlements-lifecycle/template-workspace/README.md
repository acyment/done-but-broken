# subscription-entitlements-lifecycle template workspace

This is the reference candidate workspace for `subscription-entitlements-lifecycle-v0`.

It exposes the public API contract used by the visible feedback assets and hidden oracle:

- `applyEvent(state, event): State`
- `canAccessFeature(state, feature, now): boolean`
- `getBillingStatus(state, now): BillingStatus`
- `getInvoiceSummary(state): InvoiceSummary`
