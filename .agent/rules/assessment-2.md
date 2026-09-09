# Assessment 2 — The Payment and Subscription Slice (working rules)

Full spec: `.agent/rules/brief-full.md`, section "ASSESSMENT 2".
Time budget: **20–26 hours. The largest of the four.**

---

## Scope, in one line

One paid plan, sold monthly and yearly, in test mode. Subscribe, upgrade with
proration, downgrade at period end, cancel with access retained. Every event
logged.

**The thing being sold is a plan flag on a user record.** There are no features
behind the paywall. Do not build any.

Auth is reused from Assessment 1. This must be stated in `DOCUMENTATION.md`
Section 1 — reuse is fine, hiding it is not.

---

## Build order

1. **Schema first.** `subscriptions`, `payment_events` (the log),
   `plans`/`prices` if needed. Raise the decision points below first.
2. **Money handling module.** Minor units in, minor units out, currency
   alongside. Never let a float touch a monetary value anywhere in the codebase.
3. **The payment log, before any payment code.** Append-only. Every write goes
   through one function.
4. **Checkout initiation** — logs an `initiation` row, hands off to the
   provider, rate limited.
5. **Webhook endpoint** — signature verification *before* any parsing or
   processing, then idempotency check on the provider reference, then log, then
   act.
6. **Server-side verification + entitlement grant.** Entitlement is granted here
   and **nowhere else**.
7. **Return view.** This view reads state. It grants nothing.
8. **Billing view** — plan, status, renewal date, cancel control.
9. **Upgrade with proration.** Calculate, show the number to the user, log it.
10. **Downgrade** applied at period end.
11. **Cancel** with confirmation step and optional reason prompt.
12. **Error handling sweep** — no blank page or 404 anywhere in the payment
    path, including provider timeout, declined card, abandoned checkout, and
    back-button-after-payment.
13. **Evidence capture.**
14. `DOCUMENTATION.md`.

---

## Decision points — raise these with me before coding

| Decision | Alternatives you must present |
|---|---|
| Payment provider | Whichever two are realistic for my region and stack |
| Money column type | `INTEGER` vs `BIGINT`, and the overflow ceiling of each |
| Currency storage | Column per row vs single app-wide constant |
| Entitlement model | Derived from the append-only log vs stored status column |
| Payment log shape | One table with a `type` column vs separate tables |
| Idempotency key | Provider reference vs your own generated key |
| Duplicate payment behaviour | Extend the period vs reject vs refund-and-log |
| Proration basis | Daily proration vs seconds vs provider-computed |
| Proration rounding | Round up, down, or to nearest — and who eats the cent |
| Downgrade timing | Scheduled row vs flag checked at renewal |
| Cancel semantics | `cancel_at_period_end` flag vs scheduled job |
| Webhook retry handling | What happens on the provider's 3rd retry |
| Rate limit on checkout | Window, limit, and status code |

**The entitlement model is the highest-value decision here.** The Excellent band
requires the log to be append-only with entitlement *derived* from it rather
than stored and mutated. Present both, and be explicit about the cost of each.

---

## Anti-patterns — do not do these

- **Storing amounts as decimals or floats.** Anywhere. Including in a variable
  that is "just for display".
- **Granting entitlement on the success/return URL.** If a user can visit that
  URL directly and get a subscription, the slice fails. Entitlement is granted
  only after server-side verification of the provider's own record.
- **Cancelling with immediate cutoff** after taking payment for the period.
- **Skipping the payment log** because the subscription table shows a status.
  The status is the present. The log is the history. The history is what gets
  produced in a dispute.
- **Testing only the happy path.** The duplicate webhook must be fired
  deliberately and the second one must be recorded and ignored.
- Storing card details, PANs, CVVs, or anything resembling them. Ever.
- Processing a webhook body before verifying its signature.

---

## Evidence checklist

**Database evidence is mandatory throughout this assessment. Claims without
screenshots do not count.** Capture into `/evidence/`.

- [ ] **Subscription record before and after an upgrade**, showing the interval
      changed and the period end moved. Two screenshots, same row.
      → capture at step 9
- [ ] **Payment log for one complete transaction**, every stage as its own row,
      timestamps visible: initiation → verification → fulfilment.
      → capture at step 6
- [ ] **Proration calculation written out with real numbers**: days remaining,
      credit applied, amount charged, and the resulting log entries. Not a
      formula — actual figures from an actual upgrade.
      → capture at step 9
- [ ] **The same webhook fired twice**, showing the second recorded and ignored.
      Include the request you replayed and both log rows.
      → capture at step 5
- [ ] **A cancelled subscription** showing access retained and the period end
      date.
      → capture at step 11

Additionally worth capturing for the Excellent band:

- [ ] **The duplicate-payment case**: pay twice for an active plan, and show
      what the database looks like afterwards.

---

## Section 5 concepts — I must cover all nine

Minor units and why money is never a decimal · The payment lifecycle
(initiation, verification, fulfilment) and why they are three separate things ·
The payment log and what it proves in a dispute · Idempotency in payments ·
Webhook signature verification · Proration, with my actual calculation shown in
numbers · Cancellation and period-end access, including the legal reasoning ·
Why I do not store cards, naming PCI scope · Rate limiting on payment endpoints

---

## Defence questions — I will be asked these out loud

1. Show me the exact line where entitlement is granted, and tell me what happens
   if I reach that code path directly in my browser.
2. A customer disputes a charge from three months ago. What do you show them,
   and where does it come from?
3. Walk me through your proration arithmetic for an upgrade on day 12 of a
   30-day cycle.
4. I pay for yearly twice in one minute. What does your database look like
   afterwards?

Question 3 will be asked with those exact numbers. Work the arithmetic for day
12 of 30 specifically and have it written down.
