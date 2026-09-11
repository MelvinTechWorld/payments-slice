# Payments Slice

A complete subscription and payment slice built with Next.js (App Router), Prisma, PostgreSQL, and Stripe.

This repository demonstrates a fully functional billing lifecycle including:
- Subscribing to monthly or yearly plans (Stripe Checkout)
- Upgrading mid-cycle with prorated credit calculation
- Downgrading with changes taking effect at period-end
- Canceling while retaining access for the remainder of the paid period
- Webhook-driven entitlement and an append-only, idempotent payment event log

## Documentation

For the full architectural write-up, data model schema, step-by-step flow, and detailed design decisions, please read [DOCUMENTATION.md](./DOCUMENTATION.md) at the root of this repository.

## Quick Start

### Prerequisites
- Node.js (v20+)
- PostgreSQL (e.g. Neon, Supabase)
- Stripe CLI

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Copy `.env.example` to `.env` and fill in your real keys:
   - `DATABASE_URL`
   - `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Test mode keys)
   - `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_YEARLY`
   - `STRIPE_WEBHOOK_SECRET` (From the Stripe CLI, see step 4)
   - `EMAIL_API_KEY` (Reused from auth-slice)

3. **Database Migration**
   ```bash
   npx prisma db push
   ```

4. **Start Stripe Webhook Forwarding**
   In a new terminal window, start the Stripe CLI to listen for webhooks and forward them to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   *(Copy the webhook signing secret printed in the console to your `.env` file as `STRIPE_WEBHOOK_SECRET`)*

5. **Start the Development Server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`.
