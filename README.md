# DealFlow 💸

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/aryanp685/dealflow)

**Stop losing money on brand deals.** Track every deal, deadline and invoice — then let DealFlow write the follow-up when a brand sits on your payment.

Built to sell at **₹299/mo (India)** and **$9/mo (global)**. The gap: creator-side deal tools at this price essentially don't exist — Upfluence, CreatorIQ and Traackr are built for *brands* managing creator rosters and start at $400–800/mo.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router (Turbopack) | Server Components for the marketing page, route handlers for the API |
| Data | TanStack Query v5 | Caching, optimistic updates, no refetch flicker (`staleTime: 30s`) |
| Animation | Motion (`LazyMotion` + `domAnimation`) | ~15 kB instead of the full ~120 kB bundle |
| Validation | Zod v4 | Every request body is parsed at the boundary — bad input never reaches SQL |
| Auth | bcryptjs + jose (JWT, httpOnly cookie) | Edge-compatible, swappable for Supabase Auth / NextAuth |
| Database | SQLite (dev) / Supabase Postgres (prod) | `DATABASE_URL` switches drivers; schema in `supabase/schema.sql` |
| Utilities | clsx | Conditional class names |
| Rate limiting | Upstash Redis (sliding window) | Shared across serverless instances; in-memory fallback locally |
| Payments | Razorpay + Stripe, webhook-verified | Plans grant only on a signed webhook with the exact plan amount; nothing is granted at checkout |

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Nothing is required in `.env.local` to run locally. Copy `.env.example` when you add payments. A public demo with sample deals lives at `/demo` — no signup needed.

1. Create an account at `/signup`
2. Click **Load sample deals** — six realistic deals appear (one overdue, one due soon, one delivered-but-not-invoiced, one paid, one USD)
3. Open **Follow-ups** — every item has a ready-to-send message with a copy button

### Verify

```bash
npm test             # 78 unit tests
npx next build       # production build + full typecheck
```

The tests compile `src/lib/*` with `tsc` and run against the **real compiled output**, so they execute the shipped logic rather than a copy of it.

---

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | **Production** | Signs the session JWT. `openssl rand -base64 32`. The app refuses to boot in production without it. |
| `DATABASE_URL` | **Production** | Supabase "Transaction pooler" string + `?sslmode=require`. Without it, local SQLite. Run `supabase/schema.sql` once first. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Recommended | Rate limiting across serverless instances. Without them, in-memory fallback. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | For INR payments | `rzp_test_…` then `rzp_live_…`. Without them, links are placeholders and the UI says so. |
| `RAZORPAY_WEBHOOK_SECRET` | For INR payments | Without it `/api/webhooks/razorpay` returns 503 and no plan is ever granted. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | For USD payments | Without them the Stripe rail is disabled (`/api/webhooks/stripe` returns 503). |
| `RESEND_API_KEY` | For emails | Daily digest + password-reset emails. Without it the digest reports dry-run and reset returns 503 in production. |
| `RESEND_FROM` | For emails | Address on a verified domain. Without it, Resend's test sender only reaches the account owner's inbox. |
| `CRON_SECRET` | For the digest cron | Vercel sends it as `Authorization: Bearer` on cron runs. Without it `/api/cron/digest` answers 401 to everyone. |
| `DEALFLOW_DB_PATH` | No | Override the SQLite file. Defaults to `./data/dealflow.db`. |
| `NEXT_PUBLIC_SITE_URL` | No | Used for `metadataBase` / OpenGraph / sitemap URLs. |

---

## Deploy to Vercel

1. Click **Deploy with Vercel** above (or `vercel` from this repo)
2. Add env vars from `.env.example` — at minimum `AUTH_SECRET` and `DATABASE_URL`
3. Run `supabase/schema.sql` once on your Supabase project, then deploy

The daily digest cron (`/api/cron/digest`, 08:30 IST) is configured in `vercel.json` and runs automatically.

---

## Selling on Payhip

Buyers purchase on Payhip, get a license key instantly, then sign up on your
deployed app and paste the key on the **Pricing** tab to unlock Pro forever.
One key works on one account; refunded keys are auto-disabled by Payhip and the
app downgrades those accounts back to free on the next license check.

Seller setup (one time):

1. Payhip → new product → type **Software**, price in INR (₹499 launch works)
2. On the product page enable **license keys** (auto-generate per order)
3. Copy the **product secret key** and **product link** from that page
4. Vercel → project → Settings → Environment Variables → set
   `PAYHIP_PRODUCT_SECRET` and `PAYHIP_PRODUCT_LINK`, then redeploy
5. In the Payhip product description, tell buyers: sign up at
   `YOUR-SITE/app`, open **Pricing**, paste the key from the Payhip receipt

---

## Routes

| Route | What it is |
|---|---|
| `/` | Marketing landing page — Server Component, 1.8 kB of JS, indexable |
| `/signup`, `/login` | Auth |
| `/app` | The product: Overview, Deals, Follow-ups, Pricing |

### API

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | Create account, set session cookie |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/auth/session` | Current user |
| `POST` | `/api/auth/forgot-password` | Reset email (Resend; dev link in non-prod) |
| `POST` | `/api/auth/reset-password` | Set new password, kill all sessions |
| `GET` | `/api/deals` | List deals + plan usage |
| `POST` | `/api/deals` | Create (enforces plan limit) |
| `GET/PATCH/DELETE` | `/api/deals/[id]` | Read / update / delete |
| `GET` | `/api/metrics` | Totals, ageing, top brands, monthly trend |
| `GET` | `/api/reminders` | Follow-up messages (`?text=1` = plain text) |
| `POST` | `/api/payments` | Razorpay Payment Link (+ optional logged deal) |
| `POST` | `/api/checkout` | Plan upgrade (Stripe or Razorpay link, grants nothing) |
| `GET` | `/api/export` | CA-ready CSV (26 columns; `?format=zoho`) |
| `POST` | `/api/seed` | Load six sample deals (once per account) |
| `POST` | `/api/webhooks/razorpay` | Verify + grant plan (INR) |
| `POST` | `/api/webhooks/stripe` | Verify + grant plan (USD) |
| `GET` | `/api/cron/digest` | Daily 08:30 IST digest (Vercel Cron, `CRON_SECRET`) |

Everything except `/api/auth/*` returns **401** without a valid session.

---

## Architecture notes

**One source of truth for money.** `src/lib/money.ts` is imported by route handlers, the reminder generator, *and* the client form preview. It has no dependencies and no side effects, so the figure shown in the form can never disagree with the one the API stores.

**Two drivers, one facade.** `src/lib/db.ts` picks SQLite or Postgres from `DATABASE_URL`; both implement the same async interface, so local dev and Vercel run identical code paths.

**Every query is tenant-scoped.** `listDeals`, `getDeal`, `insertDeal`, `updateDeal` and `deleteDeal` all take a `creatorId` and filter on it. There is no unscoped query path in the codebase, which is what makes multi-user safe — a cross-tenant read returns `404`, not another user's data.

**Plan limits are enforced server-side.** `POST /api/deals` counts active deals and returns `402 plan_limit` when the free tier is full. A client-side check alone would let anyone POST straight to the API.

**Status transitions stamp dates.** `PATCH` sets `delivered_on` / `paid_on` / `invoice_sent_on` automatically, so the creator isn't doing double bookkeeping. Explicit dates in the same request always win.

---

## Money math

```
gross            = deal_value
gst_amount       = gross × 18%          (only if gst_applicable)
invoice_total    = gross + gst_amount
tds_amount       = gross × tds_pct      (on gross, never on gross+GST)
net_receivable   = invoice_total − tds_amount
advance_due      = net_receivable × advance_pct
balance_due      = net_receivable − advance_due
```

TDS sections in the dropdown: **194J** 10% professional fees (most brand deals), **194H** 5% commission, **194O** 2% e-commerce, **206AA** 20% when the brand has no PAN on file.

USD deals blend into the INR headline totals at a fixed ₹85/$ (`USD_INR` in `src/lib/money.ts`); the dashboard says so when you have USD deals, and the CSV export always keeps the original currency.

---

## What's still open before launch

Already shipped: Postgres/Supabase driver, Razorpay + Stripe webhooks (grant-only-on-verified-payment), rate limiting, password reset with session invalidation, lifetime deal with a 50-spot cap.

| Item | Why it matters | Effort |
|---|---|---|
| **Resend domain verify** | Until a domain is verified at resend.com/domains (and `RESEND_FROM` set), Resend's test sender only reaches the account owner's inbox | DNS records, 10 min |
| **OAuth (Google)** | Creators expect one-click signup; email+password only = friction | Supabase Auth / NextAuth, 2–3 hrs |
| **Tests for the API layer** | The 78 tests cover money/date/reminder/schema/DB logic but not the route handlers | Playwright or supertest suite |
| **Onboarding auto-seed** | After signup, drop the user straight into the seeded state instead of an empty screen | 30 min |
| **Launch video** | A 90-second Loom above the fold on the landing page | 30 min |
| **Analytics** | Know the signup → seed → paid funnel (PostHog, privacy-friendly) | 1 hr |
| **Delete account** | Self-serve data deletion (GDPR peace of mind) | 1 hr |

---

## Business checklist

- [ ] **Validate first** — DM 10 creators: *"Main brand deal tracker bana raha hoon — invoice follow-up me problem aati hai? Kitna pay karoge?"* Don't build more until 3 say yes.
- [ ] **Razorpay account** — PAN + bank, 2–5 day approval. UPI is 0% MDR under ₹2,000.
- [ ] **Whop account** — 3% fee, native Discord integration (auto-role on purchase). Best for the $9/$19 global tiers.
- [ ] **Discord server** — `#vouches` is the #1 conversion factor on Discord. Give the first 10 users free access for a screenshot.
- [ ] **Launch offer** — first 50 get ₹7,499 lifetime at 40% off. That's your first ₹1.5L.
- [ ] **GST** — registration only becomes mandatory above ₹20 lakh/year of services. Exports of services are zero-rated.

---

Built as the first of two products. The second — a review collector for local businesses — reuses this stack.

Live at https://dealflow-lyart-eight.vercel.app

---

## License

Source-available, not open-source. See [LICENSE](LICENSE).
