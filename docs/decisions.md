# Decision Log

Every non-obvious choice made in this repository, recorded when it was made.

**Why this file exists:** Section 5 of `DOCUMENTATION.md` requires four answers
per concept, and the fourth is *what I chose against, and why*. That question is
unanswerable a week later if the choice was made silently. This file is filled in
at the moment of the decision so that writing Section 5 is a reformatting job,
not an archaeology job.

**The rule:** the agent proposes options and never chooses. I choose, and the
"why" below is written in my own words. An agent-written "why" is worth nothing
at the defence.

---

## Template — copy this for each decision

```
## [Decision name — use the same name as the Section 5 concept where possible]

- **Date:**
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):**
- **What breaks without it (concrete, name the failure, no "so it's secure"):**
- **What I chose:**
- **What I chose against:**
- **Why (the real reason, including "it was the one I could reason about"):**
- **Where it lives:** `path/to/file.ts`
- **Tunable values set, and why those numbers:**
- **Was this choice forced? If so, by what:**
```

Those fields map onto Section 5's four questions directly:

| Field here | Section 5 question |
|---|---|
| What it is | 1. What it is |
| What breaks without it | 2. Why it is needed |
| What I chose + where it lives + tunables | 3. How I implemented it |
| What I chose against + why | 4. What I chose against, and why |

---

## Decisions

<!--
Append below, newest at the bottom. Do not delete entries when you change your
mind — add a new entry that supersedes the old one and say so. A reversed
decision is good Section 6 material.
-->

## Prisma 8 CLI Migrations

- **Date:** 2026-09-08
- **What it is (my words):** The approach used to manage database schema changes in development.
- **What breaks without it:** We would not be able to sync our code's schema with the actual database, causing Prisma queries to fail.
- **What I chose:** Prisma 8's tracked migration approach (`npx prisma migration plan --name init` followed by `npx prisma db migrate`).
- **What I chose against:** `npx prisma db update` (the equivalent of `db push`).
- **Why:** To maintain a history of migrations rather than just pushing schema changes directly, and to align with the new Prisma 8 pre-release CLI command structure used in `auth-slice`.
- **Where it lives:** `prisma.config.ts` and `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** N/A
- **Was this choice forced? If so, by what:** Yes, by the use of Prisma 8 pre-release which replaced the old `migrate dev` command with `migration plan` and `db migrate`.

## Payment Provider

- **Date:** 2026-09-08
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** Stripe
- **What I chose against:** Flutterwave and LemonSqueezy
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** To be implemented in `lib/payments/`
- **Tunable values set, and why those numbers:** 
- **Was this choice forced? If so, by what:** 

## Entitlement Model

- **Date:** 2026-09-08
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** Stored status column + `periodEnd` on the `Subscription` table
- **What I chose against:** Event-sourced / derived from the log
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** N/A
- **Was this choice forced? If so, by what:** 

## Money Column Type

- **Date:** 2026-09-08
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** `INTEGER` (minor units)
- **What I chose against:** `BIGINT`
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** N/A
- **Was this choice forced? If so, by what:** 

## Currency Storage

- **Date:** 2026-09-08
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** Single app-wide constant in code
- **What I chose against:** Currency column per row in the database
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** Codebase constant (no schema column)
- **Tunable values set, and why those numbers:** N/A
- **Was this choice forced? If so, by what:** 

## Payment Log Shape

- **Date:** 2026-09-08
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** One unified table (`PaymentEvent`) with an `eventType` enum
- **What I chose against:** Separate tables for each event type (initiations, fulfillments, failures)
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** N/A
- **Was this choice forced? If so, by what:** 

## Webhook Idempotency Key

- **Date:** 2026-09-08
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** The provider's reference (Stripe Event ID)
- **What I chose against:** A custom generated UUID
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** `prisma/schema.prisma` (`PaymentEvent.stripeEventId`)
- **Tunable values set, and why those numbers:** N/A
- **Was this choice forced? If so, by what:** 

## Cancel Semantics

- **Date:** 2026-09-08
- **What it is (my words, 2–3 sentences, as if to someone who has never heard the term):** 
- **What breaks without it (concrete, name the failure, no "so it's secure"):** 
- **What I chose:** `cancelAtPeriodEnd` flag checked at read-time
- **What I chose against:** A scheduled cron job that deletes the subscription
- **Why (the real reason, including "it was the one I could reason about"):** 
- **Where it lives:** `prisma/schema.prisma`
- **Tunable values set, and why those numbers:** N/A
- **Was this choice forced? If so, by what:** 
