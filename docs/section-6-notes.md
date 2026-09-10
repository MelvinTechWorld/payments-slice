# Section 6 Notes (What Went Wrong)

## Prisma 8 Temporal Issue on Timestamps

**The Error:**
During testing of the auth flow (signup/signin), the application threw a 500 Internal Server Error with the specific code `RUNTIME.TEMPORAL_UNAVAILABLE`. 
The error message stated: *"Temporal-backed codecs read and write their values through the global Temporal API, which this runtime does not provide."*

**What Caused It:**
When recreating the `schema.prisma` for this slice, the timestamp columns (e.g., `createdAt`, `expiresAt`) were defined with the standard Prisma 7 type `DateTime`. 
However, under the experimental Prisma 8 (Prisma Next) runtime, `DateTime` strictly maps to the upcoming native JavaScript `Temporal` API. Because Node.js does not yet enable Temporal globally by default, the Prisma client crashed when attempting to instantiate the date objects coming back from the Postgres database. 

In the previous `auth-slice`, this wasn't an issue because the schema had correctly used the experimental string-mapping type (e.g., `TimestamptzString`) instead of `DateTime`.

**What Fixed It:**
Rather than pulling in a heavyweight polyfill (`@js-temporal/polyfill`) which would have also required rewriting application logic to handle `Temporal.Instant` objects instead of ISO strings, the fix was to change all `DateTime` references in `schema.prisma` to `DateTimeString`. 
This tells Prisma 8 to read and write PostgreSQL's native text representation for timestamps, which maps cleanly to standard JavaScript ISO strings and perfectly matches the existing application code.

## Stripe 2026 API: Proration Invoice Line Items Bug

**The Symptom:**
After completing a subscription upgrade (from monthly to yearly) with `proration_behavior: 'always_invoice'`, the Stripe API returned a successful `invoice.paid` webhook. However, the database showed that the subscription remained on the `monthly` plan, and its `currentPeriodEnd` was not extended. Meanwhile, the payment log recorded an unusual charge amount (e.g., $90.00, representing the net difference of $100 minus a $10 credit).

**The Investigation:**
By pulling the raw event payload directly from Stripe via the CLI (`stripe events list --type invoice.paid`), the structure of the proration invoice was revealed. A single proration invoice actually contains *multiple* line items:
1. A negative credit line for the unused time on the old plan.
2. A positive charge line for the remaining time on the new plan.

**The Cause:**
The `parseWebhook` logic in `stripe.ts` was blindly picking the first line item in the array (`const lineItem = invoice.lines?.data?.[0];`). Because the first line item in a proration invoice is the *credit*, the webhook extracted the `planId` and `period.end` of the *old* (monthly) plan! It then ran successfully, "updating" the subscription row back to the exact monthly plan and old end date it already had.

**The Fix:**
The webhook logic was updated to search the `invoice.lines.data` array for the specific line item whose price ID matches the intended new plan (via `expectedPlanId` extracted from the subscription's metadata). A defensive check was also added: if no matching line item is found, the webhook now throws an explicit error and returns a 400 instead of silently applying the wrong plan data.
