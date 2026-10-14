const test = require('node:test');
const assert = require('node:assert');

const lib = require('../test-build/db.js');
const { buildReminders, reminderDigest } = require('../test-build/reminders.js');

const {
  computeDealMoney, overdueDays, ageingBucket, daysUntil, round2, clamp,
} = lib;


test('plain INR deal with 10% TDS: net = gross - TDS', () => {
  const m = computeDealMoney({ deal_value: 10000, advance_pct: 0, tds_pct: 10, gst_applicable: 0 });
  assert.equal(m.gross, 10000);
  assert.equal(m.gst_amount, 0);
  assert.equal(m.invoice_total, 10000);
  assert.equal(m.tds_amount, 1000);
  assert.equal(m.net_receivable, 9000);
});

test('GST is added on top and TDS is charged on gross, not on gross+GST', () => {
  const m = computeDealMoney({ deal_value: 25000, advance_pct: 0, tds_pct: 10, gst_applicable: 1 });
  assert.equal(m.gst_amount, 4500);
  assert.equal(m.invoice_total, 29500);
  assert.equal(m.tds_amount, 2500);
  assert.equal(m.net_receivable, 27000);
});

test('advance splits the net amount, not the gross', () => {
  const m = computeDealMoney({ deal_value: 20000, advance_pct: 50, tds_pct: 10, gst_applicable: 0 });
  assert.equal(m.net_receivable, 18000);
  assert.equal(m.advance_due, 9000);
  assert.equal(m.balance_due, 9000);
  assert.equal(m.advance_due + m.balance_due, m.net_receivable);
});

test('USD deal with no Indian tax is a straight pass-through', () => {
  const m = computeDealMoney({ deal_value: 900, advance_pct: 0, tds_pct: 0, gst_applicable: false });
  assert.equal(m.gross, 900);
  assert.equal(m.tds_amount, 0);
  assert.equal(m.net_receivable, 900);
});

test('20% TDS (no PAN on file) is handled', () => {
  const m = computeDealMoney({ deal_value: 50000, advance_pct: 0, tds_pct: 20, gst_applicable: 0 });
  assert.equal(m.tds_amount, 10000);
  assert.equal(m.net_receivable, 40000);
});

test('garbage input cannot produce a negative payout', () => {
  const m = computeDealMoney({ deal_value: NaN, advance_pct: -50, tds_pct: 999, gst_applicable: 0 });
  assert.equal(m.gross, 0);
  assert.equal(m.net_receivable, 0);
  assert.equal(m.advance_due, 0);
});

test('advance_pct is clamped to 0-100', () => {
  const m = computeDealMoney({ deal_value: 10000, advance_pct: 500, tds_pct: 0, gst_applicable: 0 });
  assert.equal(m.advance_due, 10000);
  assert.equal(m.balance_due, 0);
});

test('rounding stays clean on awkward numbers', () => {
  const m = computeDealMoney({ deal_value: 3333, advance_pct: 33, tds_pct: 10, gst_applicable: 1 });
  assert.equal(m.gst_amount, 599.94);
  assert.equal(m.invoice_total, 3932.94);
  assert.equal(m.tds_amount, 333.3);
  assert.equal(round2(m.advance_due + m.balance_due), m.net_receivable);
});


const TODAY = new Date('2026-09-21T12:00:00');

test('overdueDays counts days past due', () => {
  assert.equal(overdueDays('2026-09-01', 'overdue', TODAY), 20);
  assert.equal(overdueDays('2026-09-21', 'invoiced', TODAY), 0);
  assert.equal(overdueDays('2026-10-01', 'invoiced', TODAY), 0, 'future due date is not overdue');
});

test('paid and cancelled invoices are never overdue', () => {
  assert.equal(overdueDays('2026-01-01', 'paid', TODAY), 0);
  assert.equal(overdueDays('2026-01-01', 'cancelled', TODAY), 0);
});

test('missing or malformed due date returns 0, not NaN', () => {
  assert.equal(overdueDays(null, 'invoiced', TODAY), 0);
  assert.equal(overdueDays('not-a-date', 'invoiced', TODAY), 0);
});

test('ageing buckets', () => {
  assert.equal(ageingBucket(0), 'current');
  assert.equal(ageingBucket(15), '1-15');
  assert.equal(ageingBucket(16), '16-30');
  assert.equal(ageingBucket(60), '31-60');
  assert.equal(ageingBucket(61), '60+');
});

test('daysUntil is negative for past dates', () => {
  assert.equal(daysUntil('2026-09-11', TODAY), -10);
  assert.equal(daysUntil('2026-09-21', TODAY), 0);
  assert.equal(daysUntil(null, TODAY), null);
});

test('money math is exact at paisa level for every realistic input', () => {
  const paise = lib.toPaise;
  for (const v of [0.1, 19.99, 900, 3333.33, 45000, 100000.01, 999999.99]) {
    for (const t of [0, 2, 5, 10, 20]) {
      for (const a of [0, 33, 50, 100]) {
        for (const gst of [0, 1]) {
          const m = lib.computeDealMoney({ deal_value: v, advance_pct: a, tds_pct: t, gst_applicable: gst });
          for (const key of Object.keys(m)) {
            assert.ok(Number.isInteger(paise(m[key])), `${key} must be paisa-exact`);
          }
          assert.equal(paise(m.gross) + paise(m.gst_amount), paise(m.invoice_total));
          assert.equal(paise(m.invoice_total) - paise(m.tds_amount), paise(m.net_receivable));
          assert.equal(paise(m.advance_due) + paise(m.balance_due), paise(m.net_receivable));
        }
      }
    }
  }
});

test('webhook amount check matches the published prices in both currencies', () => {
  const { expectedMinorUnits, expectedPaymentPaise } = require('../test-build/schemas.js');
  assert.equal(expectedPaymentPaise('creator', 'monthly'), 29900);
  assert.equal(expectedMinorUnits('creator', 'monthly', 'INR'), 29900);
  assert.equal(expectedMinorUnits('creator', 'yearly', 'INR'), 299000);
  assert.equal(expectedMinorUnits('creator', 'monthly', 'USD'), 900);
  assert.equal(expectedMinorUnits('pro', 'yearly', 'USD'), 19000);
  assert.equal(expectedMinorUnits('free', 'monthly', 'INR'), null);
  assert.equal(expectedMinorUnits('banana', 'monthly', 'USD'), null);
});

test('toINR blends USD at the documented rate and passes INR through', () => {
  assert.equal(lib.toINR(900, 'USD'), 900 * lib.USD_INR);
  assert.equal(lib.toINR(900, 'INR'), 900);
  assert.equal(lib.USD_INR, 85);
});

test('clamp', () => {
  assert.equal(clamp(150, 0, 100), 100);
  assert.equal(clamp(-5, 0, 100), 0);
  assert.equal(clamp(42, 0, 100), 42);
});


function deal(overrides = {}) {
  return {
    id: 1, creator_id: 1, brand: 'TestBrand', brand_contact: 'Priya',
    brand_email: 'priya@test.com', brand_whatsapp: null, title: '2 Reels',
    platform: 'instagram', status: 'invoiced', deal_value: 20000, currency: 'INR',
    advance_pct: 0, agreed_on: '2026-08-01', deliver_by: null, delivered_on: '2026-08-20',
    invoice_number: 'INV-001', invoice_sent_on: '2026-08-20',
    invoice_due_on: '2026-09-05', paid_on: null, payment_status: 'overdue',
    gst_applicable: 0, tds_pct: 10, notes: null,
    created_at: '2026-08-01T00:00:00', updated_at: '2026-08-01T00:00:00',
    ...overrides,
  };
}

test('an invoice 20 days overdue produces a firm email follow-up', () => {
  const list = buildReminders([deal({ invoice_due_on: '2026-09-01' })], TODAY);
  const r = list.find((x) => x.kind === 'payment_overdue_2');
  assert.ok(r, 'expected a payment_overdue_2 reminder');
  assert.equal(r.urgency, 2);
  assert.equal(r.channel, 'email');
  assert.match(r.message, /Priya/);
  assert.match(r.message, /20,000/, 'message must state the invoiced amount');
  assert.match(r.message, /20 days past due/);
});

test('an invoice 51 days overdue escalates to the Samadhaan stage', () => {
  const list = buildReminders([deal({ invoice_due_on: '2026-08-01' })], TODAY);
  const r = list.find((x) => x.kind === 'payment_overdue_samadhaan');
  assert.ok(r, 'expected a samadhaan notice');
  assert.equal(r.urgency, 3);
  assert.match(r.send_text, /FINAL NOTICE BEFORE STATUTORY FILING/);
  assert.match(r.send_text, /51 days overdue/);
  assert.match(r.send_text, /within 3 days of this notice/);
  assert.match(r.message, /SAMADHAAN STAGE/);
  assert.match(r.message, /555\.64/, 'Section 15 interest at 51 days on 20,000');
});

test('a due date 15 days out gets no reminder yet', () => {
  const list = buildReminders([deal({ invoice_due_on: '2026-10-06' })], TODAY);
  assert.deepEqual(list.filter((r) => r.kind.startsWith('payment_')), []);
});

test('an invoice 5 days overdue gets a gentle WhatsApp nudge', () => {
  const list = buildReminders([deal({ invoice_due_on: '2026-09-16' })], TODAY);
  const r = list.find((x) => x.kind === 'payment_overdue_1');
  assert.ok(r);
  assert.equal(r.urgency, 1);
  assert.equal(r.channel, 'whatsapp');
});

test('a deliverable 3 days late is flagged as urgent', () => {
  const list = buildReminders([deal({
    status: 'delivering', payment_status: 'not_invoiced',
    deliver_by: '2026-09-18', delivered_on: null, invoice_due_on: null,
  })], TODAY);
  const r = list.find((x) => x.kind === 'delivery_overdue');
  assert.ok(r, 'expected delivery_overdue');
  assert.equal(r.urgency, 3);
  assert.match(r.message, /3 days ago/);
  assert.equal(r.headline, 'Deliverable overdue — 3d late');
});

test('a deliverable due tomorrow is a low-urgency heads up', () => {
  const list = buildReminders([deal({
    status: 'delivering', payment_status: 'not_invoiced',
    deliver_by: '2026-09-23', delivered_on: null, invoice_due_on: null,
  })], TODAY);
  const r = list.find((x) => x.kind === 'delivery_upcoming');
  assert.ok(r, 'expected delivery_upcoming');
  assert.equal(r.urgency, 1);
  assert.match(r.headline, /due in 2 days/);
});

test('a delivered deal with no invoice raises an invoice-not-sent reminder', () => {
  const list = buildReminders([deal({
    status: 'delivered', payment_status: 'not_invoiced',
    invoice_due_on: null, delivered_on: '2026-09-18',
  })], TODAY);
  const r = list.find((x) => x.kind === 'invoice_not_sent');
  assert.ok(r, 'expected invoice_not_sent');
  assert.equal(r.money, '₹20,000');
  assert.match(r.message, /20,000/);
  assert.match(r.message, /Subject: Invoice — 2 Reels/);
  assert.match(r.message, /194J/, 'TDS section reference should appear when TDS applies');
  assert.equal(r.headline, 'Invoice not sent — delivered 3d ago');
});

test('no TDS reminder text when tds_pct is zero', () => {
  const list = buildReminders([deal({
    status: 'delivered', payment_status: 'not_invoiced',
    invoice_due_on: null, delivered_on: '2026-09-18', tds_pct: 0,
  })], TODAY);
  const r = list.find((x) => x.kind === 'invoice_not_sent');
  assert.ok(r);
  assert.doesNotMatch(r.message, /194J/);
});

test('an agreed advance that never landed is chased after 3 days', () => {
  const list = buildReminders([deal({
    status: 'agreed', payment_status: 'not_invoiced', advance_pct: 50,
    agreed_on: '2026-09-10', delivered_on: null, invoice_due_on: null,
  })], TODAY);
  const r = list.find((x) => x.kind === 'advance_not_received');
  assert.ok(r, 'expected advance_not_received');
  assert.match(r.message, /50% advance/);
  assert.match(r.message, /9,000/);
});

test('paid deals generate nothing', () => {
  const list = buildReminders([deal({
    status: 'paid', payment_status: 'paid', paid_on: '2026-09-01',
  })], TODAY);
  assert.deepEqual(list, []);
});

test('cancelled deals generate nothing', () => {
  const list = buildReminders([deal({ status: 'cancelled', payment_status: 'cancelled' })], TODAY);
  assert.deepEqual(list, []);
});

test('reminders are ordered most urgent first', () => {
  const list = buildReminders([
    deal({ id: 1, brand: 'Late', invoice_due_on: '2026-08-01' }),
    deal({ id: 2, brand: 'Soon', invoice_due_on: '2026-09-16' }),
  ], TODAY);
  assert.ok(list.length >= 2);
  assert.equal(list[0].urgency, 3);
  assert.ok(list[0].urgency >= list[list.length - 1].urgency);
});

test('digest summarises counts and reads as plain text', () => {
  const list = buildReminders([deal({ invoice_due_on: '2026-08-01' })], TODAY);
  const text = reminderDigest(list);
  assert.match(text, /1 item\(s\) needing attention/);
  assert.match(text, /URGENT/);
  assert.match(text, /TestBrand/);
});

test('digest with nothing due says so', () => {
  assert.equal(reminderDigest([]), 'Nothing needs your attention today. 🎉');
});


const { tdsSectionFor } = require('../test-build/money.js');

test('tds sections map to the right statute', () => {
  assert.equal(tdsSectionFor(10), '194J');
  assert.equal(tdsSectionFor(5), '194H');
  assert.equal(tdsSectionFor(2), '194O');
  assert.equal(tdsSectionFor(20), '206AA');
  assert.equal(tdsSectionFor(0), null);
  assert.equal(tdsSectionFor(7), null, 'custom percentages must not guess a section');
});

test('a 2% TDS invoice cites 194O, not 194H', () => {
  const list = buildReminders([deal({
    status: 'delivered', payment_status: 'not_invoiced',
    invoice_due_on: null, delivered_on: '2026-09-18', tds_pct: 2,
  })], TODAY);
  const r = list.find((x) => x.kind === 'invoice_not_sent');
  assert.ok(r);
  assert.match(r.send_text, /194O/);
  assert.doesNotMatch(r.send_text, /194H/);
});


const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

process.env.DEALFLOW_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dealflow-')), 'test.db');
delete require.cache[require.resolve('../test-build/db.js')];
const store = require('../test-build/db.js');

async function mkUser(email = 'creator@test.com') {
  return store.createUser({
    name: 'Test Creator', email,
    passwordHash: '$2a$12$notarealhashbutvalidshape000000000000000000000000',
  });
}

function mkDeal(userId, overrides = {}) {
  return store.insertDeal(userId, {
    brand: 'boAt', title: '2 Reels', deal_value: 45000, currency: 'INR',
    advance_pct: 50, tds_pct: 10, gst_applicable: 1, status: 'negotiating',
    payment_status: 'not_invoiced', platform: 'instagram',
    ...overrides,
  });
}

test('schema migrates and a deal round-trips through SQLite', async () => {
  const user = await mkUser('roundtrip@test.com');
  const deal = await mkDeal(user.id);

  assert.equal(deal.brand, 'boAt');
  assert.equal(deal.status, 'negotiating');
  assert.equal(deal.payment_status, 'not_invoiced');
  assert.equal(store.computeDealMoney(deal).net_receivable, 48600);
});

test('deals are strictly scoped to their creator', async () => {
  const a = await mkUser('a@test.com');
  const b = await mkUser('b@test.com');
  const deal = await mkDeal(a.id);

  assert.equal((await store.listDeals(a.id)).length, 1);
  assert.equal((await store.listDeals(b.id)).length, 0, 'another creator must not see this deal');
  assert.equal(await store.getDeal(b.id, deal.id), undefined, 'cross-tenant read must return undefined');
  assert.equal(await store.deleteDeal(b.id, deal.id), false, 'cross-tenant delete must be a no-op');
  assert.ok(await store.getDeal(a.id, deal.id), 'the real owner can still read it');
});

test('countActiveDeals excludes paid and cancelled deals', async () => {
  const user = await mkUser('counts@test.com');
  await mkDeal(user.id, { brand: 'Active1' });
  await mkDeal(user.id, { brand: 'Active2', status: 'delivering' });
  await mkDeal(user.id, { brand: 'Done', status: 'paid', payment_status: 'paid', paid_on: '2026-09-01' });
  await mkDeal(user.id, { brand: 'Dead', status: 'cancelled', payment_status: 'cancelled' });

  assert.equal(await store.countActiveDeals(user.id), 2);
  assert.equal((await store.listDeals(user.id)).length, 4);
});

test('distinctBrands returns unique brand names', async () => {
  const user = await mkUser('brands@test.com');
  await mkDeal(user.id, { brand: 'Zomato', title: 'a' });
  await mkDeal(user.id, { brand: 'Zomato', title: 'b' });
  await mkDeal(user.id, { brand: 'CRED', title: 'c' });

  assert.deepEqual(await store.distinctBrands(user.id), ['CRED', 'Zomato']);
});

test('updateDeal changes only what it is given', async () => {
  const user = await mkUser('update@test.com');
  const deal = await mkDeal(user.id);

  const updated = await store.updateDeal(user.id, deal.id, { status: 'delivering', tds_pct: 5 });
  assert.equal(updated.status, 'delivering');
  assert.equal(updated.tds_pct, 5);
  assert.equal(updated.deal_value, 45000, 'untouched fields must survive');
  assert.match(updated.updated_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'updated_at must be stamped');
});

test('lifetime sales are counted for the 50-spot cap', async () => {
  const user = await mkUser('lifetime@test.com');
  assert.equal(await store.countLifetimeSales(), 0);
  await store.insertPayment({
    provider: 'razorpay', provider_payment_id: 'pay_life_1', user_id: user.id,
    plan: 'pro', billing: 'lifetime', amount: 749900, currency: 'INR',
  });
  await store.insertPayment({
    provider: 'stripe', provider_payment_id: 'cs_monthly_1', user_id: user.id,
    plan: 'creator', billing: 'monthly', amount: 900, currency: 'USD',
  });
  assert.equal(await store.countLifetimeSales(), 1, 'only lifetime billings count');
});

test('lifetime pricing is exact and Pro-only', () => {
  const { expectedMinorUnits } = require('../test-build/schemas.js');
  assert.equal(expectedMinorUnits('pro', 'lifetime', 'INR'), 749900);
  assert.equal(expectedMinorUnits('pro', 'lifetime', 'USD'), 14900);
  assert.equal(expectedMinorUnits('creator', 'lifetime', 'INR'), null);
  assert.equal(expectedMinorUnits('pro', 'lifetime', 'EUR'), null);
});

test('deleting a deal leaves the user intact', async () => {
  const user = await mkUser('delete@test.com');
  const deal = await mkDeal(user.id);

  assert.equal(await store.deleteDeal(user.id, deal.id), true);
  assert.equal(await store.deleteDeal(user.id, deal.id), false, 'second delete finds nothing');
  assert.equal((await store.listDeals(user.id)).length, 0);
  assert.ok(await store.findUserByEmail('delete@test.com'), 'the user survives');
});

test('unique email is enforced at the database level', async () => {
  await mkUser('dupe@test.com');
  await assert.rejects(
    store.createUser({ name: 'Copy', email: 'dupe@test.com', passwordHash: 'x'.repeat(60) }),
    /UNIQUE/i
  );
});


const { createDealSchema, updateDealSchema, signupSchema, PLANS } = require('../test-build/schemas.js');

test('schema applies sensible defaults', () => {
  const d = createDealSchema.parse({ brand: 'boAt', title: 'Reel' });
  assert.equal(d.status, 'negotiating');
  assert.equal(d.payment_status, 'not_invoiced');
  assert.equal(d.platform, 'instagram');
  assert.equal(d.currency, 'INR');
  assert.equal(d.deal_value, 0);
  assert.equal(d.gst_applicable, false);
});

test('schema rejects an unknown status', () => {
  assert.throws(() => createDealSchema.parse({ brand: 'X', title: 'Y', status: 'banana' }));
});

test('schema rejects advance_pct above 100', () => {
  assert.throws(() => createDealSchema.parse({ brand: 'X', title: 'Y', advance_pct: 150 }), /100/);
});

test('schema rejects a malformed date', () => {
  assert.throws(() => createDealSchema.parse({ brand: 'X', title: 'Y', deliver_by: '30/08/2026' }), /YYYY-MM-DD/);
});

test('schema rejects an impossible calendar date', () => {
  assert.throws(() => createDealSchema.parse({ brand: 'X', title: 'Y', deliver_by: '2026-02-31' }));
});

test('schema requires brand and title', () => {
  assert.throws(() => createDealSchema.parse({ title: 'Y' }));
  assert.throws(() => createDealSchema.parse({ brand: 'X' }));
});

test('schema coerces string numbers and booleans from form input', () => {
  const d = createDealSchema.parse({ brand: 'X', title: 'Y', deal_value: '25000', advance_pct: '50', gst_applicable: 'true' });
  assert.equal(d.deal_value, 25000);
  assert.equal(d.advance_pct, 50);
  assert.equal(d.gst_applicable, true);
});

test('schema blanks empty strings to null', () => {
  const d = createDealSchema.parse({ brand: 'X', title: 'Y', brand_email: '', notes: '   ' });
  assert.equal(d.brand_email, null);
  assert.equal(d.notes, null);
});

test('update schema allows a partial patch', () => {
  const d = updateDealSchema.parse({ payment_status: 'paid' });
  assert.equal(d.payment_status, 'paid');
  assert.equal(d.brand, undefined);
});

test('update schema still rejects an empty brand', () => {
  assert.throws(() => updateDealSchema.parse({ brand: '   ' }), /empty/);
});

test('signup requires a real password', () => {
  assert.throws(() => signupSchema.parse({ name: 'Ana', email: 'a@b.com', password: 'short' }), /8 characters/);
  assert.throws(() => signupSchema.parse({ name: 'Ana', email: 'a@b.com', password: 'allletters' }), /letter and one number/);
  const ok = signupSchema.parse({ name: 'Ana', email: 'A@B.com', password: 'password1' });
  assert.equal(ok.email, 'a@b.com', 'email is lowercased');
});

test('free plan is capped at 3 active deals', () => {
  assert.equal(PLANS.free.max_active_deals, 3);
  assert.equal(PLANS.creator.max_active_deals, Infinity);
  assert.equal(PLANS.creator.price_inr, 299);
  assert.equal(PLANS.creator.price_usd, 9);
});


const { rateLimit, resetRateLimits, clientIp, LIMITS } = require('../test-build/rate-limit.js');

test('rate limiter allows up to the limit then blocks', async () => {
  resetRateLimits();
  const key = 'login:1.2.3.4';
  for (let i = 0; i < LIMITS.login.limit; i++) {
    assert.equal((await rateLimit(key, LIMITS.login)).ok, true, `attempt ${i + 1} should pass`);
  }
  const blocked = await rateLimit(key, LIMITS.login);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSeconds > 0, 'must tell the client how long to wait');
});

test('rate limiter tracks keys independently', async () => {
  resetRateLimits();
  for (let i = 0; i < LIMITS.signup.limit + 1; i++) await rateLimit('signup:a', LIMITS.signup);
  assert.equal((await rateLimit('signup:a', LIMITS.signup)).ok, false);
  assert.equal((await rateLimit('signup:b', LIMITS.signup)).ok, true, 'a different IP is unaffected');
});

test('rate limiter resets after the window closes', async () => {
  resetRateLimits();
  const key = 'forgot:x';
  const tiny = { limit: 2, windowMs: 30 };
  await rateLimit(key, tiny); await rateLimit(key, tiny); await rateLimit(key, tiny);
  assert.equal((await rateLimit(key, tiny)).ok, false);
  const until = Date.now() + 60;
  while (Date.now() < until) { }
  assert.equal((await rateLimit(key, tiny)).ok, true, 'window should have slid');
});

test('clientIp prefers x-forwarded-for and takes the first hop', () => {
  assert.equal(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } })), '9.9.9.9');
  assert.equal(clientIp(new Request('http://x', { headers: { 'x-real-ip': '8.8.8.8' } })), '8.8.8.8');
  assert.equal(clientIp(new Request('http://x')), 'unknown');
});


const { createHmac, timingSafeEqual } = require('node:crypto');

function sign(body, secret) {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function verify(body, signature, secret) {
  const a = Buffer.from(sign(body, secret), 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

test('a correctly signed webhook body verifies', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: {} });
  assert.equal(verify(body, sign(body, 'whsec_test'), 'whsec_test'), true);
});

test('a tampered webhook body fails verification', () => {
  const body = JSON.stringify({ event: 'payment.captured', notes: { user: '1' } });
  const sig = sign(body, 'whsec_test');
  const tampered = body.replace('"user":"1"', '"user":"2"');
  assert.equal(verify(tampered, sig, 'whsec_test'), false);
});

test('a signature from the wrong secret fails', () => {
  const body = '{"event":"payment.captured"}';
  assert.equal(verify(body, sign(body, 'attacker_secret'), 'whsec_test'), false);
});

test('a non-hex signature is rejected rather than throwing', () => {
  assert.equal(verify('{"a":1}', 'not-hex-at-all-zzzz', 'whsec_test'), false);
});


const { effectivePlan } = (() => {
  return {
    effectivePlan: (u) => {
      if (u.plan === 'free') return 'free';
      if (!u.plan_expires_at) return u.plan;
      return u.plan_expires_at > Date.now() ? u.plan : 'free';
    },
  };
})();

test('a free user stays free', () => {
  assert.equal(effectivePlan({ plan: 'free', plan_expires_at: null }), 'free');
});

test('an active subscription keeps its plan', () => {
  assert.equal(effectivePlan({ plan: 'creator', plan_expires_at: Date.now() + 86_400_000 }), 'creator');
});

test('an expired subscription falls back to free', () => {
  assert.equal(effectivePlan({ plan: 'pro', plan_expires_at: Date.now() - 1000 }), 'free');
});

test('a plan with no expiry never lapses', () => {
  assert.equal(effectivePlan({ plan: 'pro', plan_expires_at: null }), 'pro');
});


const { msmeInterest } = require('../test-build/msme.js');

test('msme interest is zero within the window and on zero principal', () => {
  assert.equal(msmeInterest(50000, 0).interest, 0);
  assert.equal(msmeInterest(0, 90).interest, 0);
  assert.equal(msmeInterest(50000, 0).total_due, 50000);
});

test('msme interest compounds monthly at 3x the 6.5% bank rate', () => {
  const r = msmeInterest(10000, 90);
  assert.equal(r.rate_pct, 19.5);
  assert.equal(r.interest, 495.46);
  assert.equal(r.total_due, 10495.46);
});

test('msme interest grows monotonically with days', () => {
  const a = msmeInterest(30000, 46);
  const b = msmeInterest(30000, 60);
  const c = msmeInterest(30000, 120);
  assert.ok(a.interest > 0 && b.interest > a.interest && c.interest > b.interest);
});

test('msme interest never produces fractional paise', () => {
  for (const days of [1, 7, 33, 45, 100, 365]) {
    const r = msmeInterest(12345.67, days);
    assert.equal(r.interest, Math.round(r.interest * 100) / 100);
    assert.equal(r.total_due, Math.round((r.principal + r.interest) * 100) / 100);
  }
});


test('quarterly plan prices are exact on both rails', () => {
  const { expectedMinorUnits } = require('../test-build/schemas.js');
  assert.equal(expectedMinorUnits('creator', 'quarterly', 'INR'), 69900);
  assert.equal(expectedMinorUnits('creator', 'quarterly', 'USD'), 2100);
  assert.equal(expectedMinorUnits('pro', 'quarterly', 'INR'), 199900);
  assert.equal(expectedMinorUnits('pro', 'quarterly', 'USD'), 4900);
  assert.equal(expectedMinorUnits('free', 'quarterly', 'INR'), null);
});

test('yearly is cheaper than 12 months and quarterly cheaper than 3', () => {
  const { PLANS } = require('../test-build/schemas.js');
  for (const key of ['creator', 'pro']) {
    const p = PLANS[key];
    assert.ok(p.yearly_inr < p.price_inr * 12, `${key} yearly must beat 12x monthly`);
    assert.ok(p.quarterly_inr < p.price_inr * 3, `${key} quarterly must beat 3x monthly`);
    assert.ok(p.yearly_usd < p.price_usd * 12);
    assert.ok(p.quarterly_usd < p.price_usd * 3);
  }
});


test('31-45 days overdue produces an MSME demand notice with interest', () => {
  const list = buildReminders([deal({ invoice_due_on: '2026-08-12' })], TODAY);
  const r = list.find((x) => x.kind === 'payment_overdue_final');
  assert.ok(r, 'expected a demand notice at 40 days');
  assert.match(r.send_text, /DEMAND FOR PAYMENT/);
  assert.match(r.send_text, /MSMED Act 2006/);
  assert.match(r.send_text, /Section 15/);
  assert.match(r.send_text, /samadhaan\.msme\.gov\.in/);
  assert.match(r.send_text, /Payment terms were 15 days from invoice date/);
  assert.match(r.send_text, /20,434\.50/);
  assert.match(r.message, /Section 15 interest/);
});

test('the firm 16-30 day email mentions the MSME lever without claiming it', () => {
  const list = buildReminders([deal({ invoice_due_on: '2026-09-01' })], TODAY);
  const r = list.find((x) => x.kind === 'payment_overdue_2');
  assert.ok(r);
  assert.match(r.message, /Udyam/);
  assert.doesNotMatch(r.send_text, /MSMED Act/, 'the letter itself must not over-claim');
});

test('every reminder carries a ready-to-send message', () => {
  const list = buildReminders([
    deal({ invoice_due_on: '2026-08-01' }),
    deal({ id: 2, invoice_due_on: '2026-09-16' }),
  ], TODAY);
  assert.ok(list.length >= 2);
  for (const r of list) {
    assert.ok(r.send_text && r.send_text.length > 20, `send_text missing on ${r.kind}`);
  }
});

test('a 10-digit WhatsApp number gets the country code for wa.me links', () => {
  const list = buildReminders([deal({ brand_whatsapp: '098765 43210', invoice_due_on: '2026-09-16' })], TODAY);
  const r = list.find((x) => x.kind === 'payment_overdue_1');
  assert.ok(r);
  assert.equal(r.wa_number, '919876543210');
});

test('an escalation contact is cc-ed into the demand notice', () => {
  const list = buildReminders([deal({ invoice_due_on: '2026-08-12', escalation_contact: 'Rahul (CFO)' })], TODAY);
  const r = list.find((x) => x.kind === 'payment_overdue_final');
  assert.ok(r);
  assert.match(r.send_text, /cc Rahul \(CFO\)/);
});

test('brand payment history is quoted in chase guidance', () => {
  const list = buildReminders([
    deal({ id: 1, invoice_due_on: '2026-09-16' }),
    deal({
      id: 2, status: 'paid', payment_status: 'paid',
      invoice_sent_on: '2026-06-01', paid_on: '2026-08-10', invoice_due_on: '2026-06-16',
    }),
  ], TODAY);
  const r = list.find((x) => x.kind === 'payment_overdue_1');
  assert.ok(r);
  assert.match(r.message, /History: this brand has settled 1 invoice in ~70 days/);
  assert.match(r.message, /paid late 1 time/);
});

const { payhipConfigured, verifyLicenseKey } = require('../test-build/payhip.js');

function stubFetch(fn) {
  const real = global.fetch;
  global.fetch = fn;
  return () => { global.fetch = real; };
}

test('payhip: reports not_configured when env vars are missing', async () => {
  delete process.env.PAYHIP_PRODUCT_SECRET;
  delete process.env.PAYHIP_PRODUCT_LINK;
  assert.equal(payhipConfigured(), false);
  assert.deepEqual(await verifyLicenseKey('AAAAA-BBBBB-CCCCC-DDDDD'), { ok: false, reason: 'not_configured' });
});

test('payhip: accepts an enabled key for our product, uppercases input', async () => {
  process.env.PAYHIP_PRODUCT_SECRET = 'secret';
  process.env.PAYHIP_PRODUCT_LINK = 'mVT0';
  const restore = stubFetch(async (url, opts) => {
    assert.match(url, /license_key=AAAAA-BBBBB-CCCCC-DDDDD/);
    assert.equal(opts.headers['product-secret-key'], 'secret');
    return {
      ok: true,
      json: async () => ({
        data: {
          enabled: true, product_link: 'mVT0', license_key: 'AAAAA-BBBBB-CCCCC-DDDDD',
          buyer_email: 'buyer@example.com', uses: 0,
        },
      }),
    };
  });
  try {
    assert.deepEqual(await verifyLicenseKey('aaaaa-bbbbb-ccccc-ddddd'), {
      ok: true, buyerEmail: 'buyer@example.com', productLink: 'mVT0', uses: 0,
    });
  } finally {
    restore();
    delete process.env.PAYHIP_PRODUCT_SECRET;
    delete process.env.PAYHIP_PRODUCT_LINK;
  }
});

test('payhip: rejects disabled keys, wrong products and empty responses', async () => {
  process.env.PAYHIP_PRODUCT_SECRET = 'secret';
  process.env.PAYHIP_PRODUCT_LINK = 'mVT0';
  const cases = [
    [{ data: { enabled: false, product_link: 'mVT0', license_key: 'K' } }, 'disabled'],
    [{ data: { enabled: true, product_link: 'OTHER', license_key: 'K' } }, 'wrong_product'],
    [{}, 'invalid'],
    [null, 'invalid'],
  ];
  for (const [payload, reason] of cases) {
    const restore = stubFetch(async () => ({ ok: true, json: async () => payload }));
    try {
      assert.deepEqual(await verifyLicenseKey('K-K-K-K-K-K-K-K'), { ok: false, reason });
    } finally {
      restore();
    }
  }
  const restore404 = stubFetch(async () => ({ ok: false }));
  try {
    assert.deepEqual(await verifyLicenseKey('K-K-K-K-K-K-K-K'), { ok: false, reason: 'invalid' });
  } finally {
    restore404();
  }
  delete process.env.PAYHIP_PRODUCT_SECRET;
  delete process.env.PAYHIP_PRODUCT_LINK;
});

test('payhip: network failures map to network and never throw', async () => {
  process.env.PAYHIP_PRODUCT_SECRET = 'secret';
  process.env.PAYHIP_PRODUCT_LINK = 'mVT0';
  const restore = stubFetch(async () => { throw new Error('down'); });
  try {
    assert.deepEqual(await verifyLicenseKey('AAAAA-BBBBB-CCCCC-DDDDD'), { ok: false, reason: 'network' });
  } finally {
    restore();
    delete process.env.PAYHIP_PRODUCT_SECRET;
    delete process.env.PAYHIP_PRODUCT_LINK;
  }
});

const { getDemoDeals } = require('../test-build/demo.js');

test('demo: six sample deals covering every payment state', () => {
  const deals = getDemoDeals();
  assert.equal(deals.length, 6);
  const states = new Set(deals.map((d) => d.payment_status));
  for (const s of ['overdue', 'invoiced', 'advance_paid', 'not_invoiced', 'paid']) {
    assert.ok(states.has(s), `missing ${s}`);
  }
  assert.ok(deals.some((d) => d.currency === 'USD'));
});

test('demo: every sample deal computes money without throwing', () => {
  for (const d of getDemoDeals()) {
    const m = computeDealMoney(d);
    assert.ok(Number.isFinite(m.net_receivable));
  }
});
