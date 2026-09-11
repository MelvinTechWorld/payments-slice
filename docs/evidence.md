# Evidence Log

Every piece of captured proof required by the brief, logged when captured.

**Why this file exists:** the briefs require database screenshots, curl output,
and measurement tables that cannot be reconstructed after the fact. Assessment 2
states outright that *claims without screenshots do not count*. Assessment 4's
baseline query counts are gone forever once the code is optimised.

**Where files go:** `/evidence/` in the repository root. Reference them from
`DOCUMENTATION.md` with relative paths so they render on GitHub.

**Naming:** `NN-short-description.png` — e.g. `01-users-table-hash.png`. Number
them in the order the brief lists them so a reviewer can follow along.

---

## Captured

| # | File | What it shows | Which requirement it satisfies | Date |
|---|---|---|---|---|
| 01 | `01-payment-log-complete.png` | Database log of a single checkout session showing `INITIATION`, `VERIFICATION`, and `FULFILLMENT` events with timestamps. | Payment log for one complete transaction | 2026-09-10 |
| 02a | `02a-proration-calculation-console.png` | Terminal/console output breakdown of the actual numbers (days remaining, $6.00 credit, $94.00 charge). | Proration calculation with real numbers | 2026-09-10 |
| 02b | `02b-proration-calculation-db.png` | The corresponding `PaymentEvent` rows showing the resulting log entries for the upgrade. | Proration calculation with real numbers | 2026-09-10 |
| 03a | `03a-webhook-idempotency-terminal.png` | Terminal output showing `stripe events resend` and the 200 OK `"duplicate event ignored"` response. | The same webhook fired twice | 2026-09-10 |
| 03b | `03b-webhook-idempotency-db.png` | Database screenshot proving a second duplicate row was NOT inserted. | The same webhook fired twice | 2026-09-10 |
| 04a | `04a-cancelled-subscription-db.png` | Database screenshot showing a `canceled` subscription with `cancelAtPeriodEnd: true` and the future `currentPeriodEnd` intact. | A cancelled subscription | 2026-09-10 |
| 04b | `04b-cancelled-subscription-ui.png` | UI dashboard confirmation showing the active-but-canceling status to the user. | A cancelled subscription | 2026-09-10 |
| 05a | `05a-duplicate-payment-subscription.png` | Database screenshot showing only one active subscription with its `currentPeriodEnd` extended cleanly. | The duplicate-payment case | 2026-09-10 |
| 05b | `05b-duplicate-payment-events.png` | Database screenshot showing six rows (two full lifecycles) in `PaymentEvent` representing the race condition. | The duplicate-payment case | 2026-09-10 |

---

## Curl commands used

Record the exact command and the exact response. Both are graded.

### [Name of the thing being tested]

```bash
# Command:


# Response:


# What this proves:

```

---

## Outstanding

Anything on the assessment's evidence checklist not yet captured. This list must
be empty before submission.

- [ ]
