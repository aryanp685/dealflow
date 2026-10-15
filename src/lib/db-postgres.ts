import postgres from 'postgres';
import type { DbDriver } from './db-types';
import { normalizeValue } from './db-types';


let _sql: ReturnType<typeof postgres> | null = null;

function sql() {
  _sql ??= postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 3,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return _sql;
}

const NOW = "to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')";

const DEAL_COLS = [
  'brand', 'brand_contact', 'brand_email', 'brand_whatsapp', 'title', 'platform',
  'status', 'deal_value', 'currency', 'advance_pct', 'agreed_on', 'deliver_by',
  'delivered_on', 'invoice_number', 'invoice_sent_on', 'invoice_due_on', 'paid_on',
  'payment_status', 'payment_terms_days', 'escalation_contact', 'gst_applicable', 'tds_pct', 'notes',
];

export const driver: DbDriver = {
  async listUsers() {
    const rows = await sql()`SELECT id, name, email, upi_id FROM users ORDER BY id`;
    return rows as never;
  },

  async listDeals(creatorId) {
    const rows = await sql()`SELECT * FROM deals WHERE creator_id = ${creatorId} ORDER BY created_at DESC, id DESC`;
    return rows as never;
  },

  async getDeal(creatorId, dealId) {
    const rows = await sql()`SELECT * FROM deals WHERE id = ${dealId} AND creator_id = ${creatorId}`;
    return rows[0] as never;
  },

  async insertDeal(creatorId, fields) {
    const values = DEAL_COLS.map((c) => normalizeValue(fields[c] ?? (c === 'payment_terms_days' ? 15 : null))) as (string | number | null)[];
    const cols = `creator_id, ${DEAL_COLS.join(', ')}`;
    const placeholders = DEAL_COLS.map((_, i) => `$${i + 2}`).join(', ');
    const rows = await sql().unsafe(
      `INSERT INTO deals (${cols}) VALUES ($1, ${placeholders}) RETURNING *`,
      [creatorId, ...values]
    );
    return rows[0] as never;
  },

  async updateDeal(creatorId, dealId, updates) {
    const keys = Object.keys(updates);
    if (keys.length > 0) {
      const params = keys.map((k) => normalizeValue(updates[k])) as (string | number | null)[];
      const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      await sql().unsafe(
        `UPDATE deals SET ${setSql}, updated_at = ${NOW}
         WHERE id = $${keys.length + 1} AND creator_id = $${keys.length + 2}`,
        [...params, dealId, creatorId]
      );
    }
    return this.getDeal(creatorId, dealId);
  },

  async deleteDeal(creatorId, dealId) {
    const rows = await sql()`DELETE FROM deals WHERE id = ${dealId} AND creator_id = ${creatorId}`;
    return rows.count > 0;
  },

  async countActiveDeals(creatorId) {
    const rows = await sql()`
      SELECT COUNT(*)::int AS c FROM deals
      WHERE creator_id = ${creatorId} AND status NOT IN ('paid','cancelled') AND payment_status <> 'paid'`;
    return rows[0].c as number;
  },

  async distinctBrands(creatorId) {
    const rows = await sql()`SELECT DISTINCT brand FROM deals WHERE creator_id = ${creatorId} ORDER BY brand`;
    return rows.map((r) => r.brand as string);
  },

  async findUserByEmail(email) {
    const rows =
      await sql()`SELECT id, name, email, upi_id, password_hash, plan, plan_expires_at, session_version, created_at FROM users WHERE email = ${email.toLowerCase()}`;
    return rows[0] as never;
  },

  async findUserById(id) {
    const rows =
      await sql()`SELECT id, name, email, upi_id, plan, plan_expires_at, session_version, created_at FROM users WHERE id = ${id}`;
    return rows[0] as never;
  },

  async createUser(input) {
    const rows =
      await sql()`INSERT INTO users (name, email, password_hash, plan)
                  VALUES (${input.name}, ${input.email.toLowerCase()}, ${input.passwordHash}, 'free')
                  RETURNING id, name, email, plan, plan_expires_at, session_version, created_at`;
    return rows[0] as never;
  },

  async updatePassword(userId, passwordHash) {
    await sql()`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
  },

  async bumpSessionVersion(userId) {
    await sql()`UPDATE users SET session_version = session_version + 1 WHERE id = ${userId}`;
  },

  async countLifetimeSales() {
    const rows = await sql()`SELECT COUNT(*)::int AS c FROM payments WHERE billing = 'lifetime'`;
    return rows[0].c as number;
  },

  async getPlanInfo(userId) {
    const rows = await sql()`SELECT plan, plan_expires_at FROM users WHERE id = ${userId}`;
    return rows[0] as never;
  },

  async grantPlan(userId, plan, planExpiresAt) {
    await sql()`UPDATE users SET plan = ${plan}, plan_expires_at = ${planExpiresAt} WHERE id = ${userId}`;
  },

  async updateUpiId(userId, upiId) {
    await sql()`UPDATE users SET upi_id = ${upiId} WHERE id = ${userId}`;
  },

  async invalidateLiveResets(userId, usedAt) {
    await sql()`UPDATE password_resets SET used_at = ${usedAt} WHERE user_id = ${userId} AND used_at IS NULL`;
  },

  async insertReset(tokenHash, userId, expiresAt) {
    await sql()`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${userId}, ${expiresAt})`;
  },

  async getReset(tokenHash) {
    const rows =
      await sql()`SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ${tokenHash}`;
    return rows[0] as never;
  },

  async markResetUsed(tokenHash, usedAt) {
    await sql()`UPDATE password_resets SET used_at = ${usedAt} WHERE token_hash = ${tokenHash}`;
  },

  async findPayment(provider, paymentId) {
    const rows =
      await sql()`SELECT id FROM payments WHERE provider = ${provider} AND provider_payment_id = ${paymentId}`;
    return rows[0] as never;
  },

  async insertPayment(p) {
    await sql().unsafe(
      `INSERT INTO payments (provider, provider_payment_id, user_id, plan, billing, amount, currency, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ${NOW})`,
      [p.provider, p.provider_payment_id, p.user_id, p.plan, p.billing, p.amount, p.currency]
    );
  },

  async getLicenseByKey(key) {
    const rows =
      await sql()`SELECT license_key, user_id, buyer_email, product_link, redeemed_at FROM licenses WHERE license_key = ${key}`;
    return rows[0] as never;
  },

  async getLicenseByUserId(userId) {
    const rows =
      await sql()`SELECT license_key, user_id, buyer_email, product_link, redeemed_at FROM licenses WHERE user_id = ${userId}`;
    return rows[0] as never;
  },

  async insertLicense(row) {
    await sql()`INSERT INTO licenses (license_key, user_id, buyer_email, product_link)
                VALUES (${row.license_key}, ${row.user_id}, ${row.buyer_email}, ${row.product_link})`;
  },
};

let _ready: Promise<void> | null = null;

export function ready(): Promise<void> {
  _ready ??= migrate().then(
    () => undefined,
    () => undefined
  );
  return _ready;
}

async function migrate(): Promise<void> {
  const stmts = [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS upi_id TEXT',
    'ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 15',
    'ALTER TABLE deals ADD COLUMN IF NOT EXISTS escalation_contact TEXT',
    'ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT \'razorpay\'',
    'ALTER TABLE payments ADD COLUMN IF NOT EXISTS billing TEXT NOT NULL DEFAULT \'monthly\'',
    'ALTER TABLE payments RENAME COLUMN razorpay_payment_id TO provider_payment_id',
    `CREATE TABLE IF NOT EXISTS licenses (
      license_key TEXT NOT NULL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      buyer_email TEXT NOT NULL,
      product_link TEXT NOT NULL,
      redeemed_at TEXT NOT NULL DEFAULT (to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'))
    )`,
    'CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id)',
  ];
  for (const s of stmts) {
    try {
      await sql().unsafe(s);
    } catch {
    }
  }
}
