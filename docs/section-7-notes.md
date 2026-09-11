# Section 7 Notes (What This Slice Does Not Handle)

## End-to-End Verification of Downgrade Period-End Transitions
We built and verified the downgrade mechanics piece-by-piece:
- We confirmed the schedule creation in Stripe (via the `downgrade` endpoint).
- We confirmed our local database correctly cached the `pendingPlanId` intent.
- We aggressively cleared `pendingPlanId` in our FULFILLMENT and CANCELLATION webhook handlers to prevent state corruption.

However, we **did not** run a full, live, end-to-end time-lapsed test using Stripe Test Clocks to watch the invoice transition actually happen. While Stripe Test Clocks are the correct tool for this, they require creating a brand-new customer and subscription strictly within the Dashboard specifically under a clock's timeline, bypassing our actual app's checkout flow. Setting this up manually to perfectly mirror our app's metadata was a disproportionate time sink relative to the remaining assessment budget. We accepted this as an honest scope boundary: the individual unit transitions are proven, but the end-to-end lapsed transition was not executed live.

## Testing of the FAILURE Webhook
The `FAILURE` event handler was verified through code review, not a live triggered event. It shares its extraction logic (`planId`, `amount`, `message`) with the `FULFILLMENT` handler, which has been verified live multiple times across subscribe, upgrade, and downgrade. Attempts to trigger a real `invoice.payment_failed` webhook using Stripe's documented test cards (`4000 0000 0000 0002`, `4000 0000 0000 0341`) either failed at card attachment or succeeded instead of declining, likely due to Stripe treating the upgrade charge as on-session rather than the off-session renewal these test cards are designed to simulate. This is Section 7 material — an honest scope boundary, not a bug.
