# Section 7 Notes (What This Slice Does Not Handle)

## End-to-End Verification of Downgrade Period-End Transitions
We built and verified the downgrade mechanics piece-by-piece:
- We confirmed the schedule creation in Stripe (via the `downgrade` endpoint).
- We confirmed our local database correctly cached the `pendingPlanId` intent.
- We aggressively cleared `pendingPlanId` in our FULFILLMENT and CANCELLATION webhook handlers to prevent state corruption.

However, we **did not** run a full, live, end-to-end time-lapsed test using Stripe Test Clocks to watch the invoice transition actually happen. While Stripe Test Clocks are the correct tool for this, they require creating a brand-new customer and subscription strictly within the Dashboard specifically under a clock's timeline, bypassing our actual app's checkout flow. Setting this up manually to perfectly mirror our app's metadata was a disproportionate time sink relative to the remaining assessment budget. We accepted this as an honest scope boundary: the individual unit transitions are proven, but the end-to-end lapsed transition was not executed live.
