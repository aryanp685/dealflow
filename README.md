# DealFlow 💸

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
| Payments | Razorpay webhook-verified | Plans grant only on a signed `payment.captured` webhook |

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Nothing is required in `.env.local` to run locally. Copy `.env.example` when you add payments.

1. Create an account at `/signup`
2. Click **Load sample deals** — six realistic deals appear (one overdue, one due soon, one delivered-but-not-invoiced, one paid, one USD)
3. Open **Follow-ups** — every item has a ready-to-send message with a copy button

### Verify

```bash
npm test             # 59 unit tests
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
| `RAZORPAY_KEY_ID` | For payments | `rzp_test_…` then `rzp_live_…`. Without it, links are placeholders and the UI says so. |
| `RAZORPAY_WEBHOOK_SECRET` | For payments | Without it `/api/webhooks/razorpay` returns 503 and no plan is ever granted. |
| `DEALFLOW_DB_PATH` | No | Override the SQLite file. Defaults to `./data/dealflow.db`. |
| `NEXT_PUBLIC_SITE_URL` | No | Used for `metadataBase` / OpenGraph / sitemap URLs. |

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
| `GET` | `/api/deals` | List deals + plan usage |
| `POST` | `/api/deals` | Create (enforces plan limit) |
| `GET/PATCH/DELETE` | `/api/deals/[id]` | Read / update / delete |
| `GET` | `/api/metrics` | Totals, ageing, top brands, monthly trend |
| `GET` | `/api/reminders` | Follow-up messages (`?text=1` = plain text) |
| `POST` | `/api/payments` | Razorpay Payment Link |
| `POST` | `/api/checkout` | Plan upgrade |
| `GET` | `/api/export` | CA-ready CSV (26 columns) |
| `POST` | `/api/seed` | Load six sample deals |

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

| Item | Why it matters | Effort |
|---|---|---|
| **Postgres/Supabase** | SQLite doesn't persist on Vercel's serverless FS | Port `src/lib/db.ts` — queries are already plain SQL |
| **Payment webhooks** | Right now `checkout` grants access optimistically in dev. Production must grant only on a verified Razorpay/Whop webhook, or people get Pro for free | Razorpay Subscriptions or Whop + one webhook route |
| **Resend domain verify** | `/api/cron/digest` ships a daily 08:30 IST digest via Vercel Cron; until a domain is verified at resend.com/domains (and `RESEND_FROM` set), Resend's test sender only reaches the account owner's inbox | DNS records, 10 min |
| **Password reset** | No reset flow yet — a user who forgets is locked out | 1 hr |
| **Rate limiting** | `/api/auth/login` is unthrottled, so it's brute-forceable | Add `@upstash/ratelimit` or Upstash Redis |
| **Tests for the API layer** | The 59 tests cover money/date/reminder/schema/DB logic but not the route handlers | Playwright or supertest suite |
| **Real demo content** | Landing page needs a screenshot or a 90-second Loom above the fold | 30 min |
| **Onboarding** | After signup, drop the user straight into the seeded state instead of an empty screen | 30 min |

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
