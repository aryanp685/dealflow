import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { DbDriver } from './db-types';
import { normalizeValue } from './db-types';


let _db: Database.Database | null = null;

export function handle(): Database.Database {
  if (process.env.VERCEL) {
    throw new Error('DATABASE_URL must be set when running on Vercel — SQLite does not persist on serverless.');
  }
  if (_db) return _db;
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = process.env.DEALFLOW_DB_PATH || path.join(dataDir, 'dealflow.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

export function resetDbHandle() {
  if (_db) {
    try { _db.close(); } catch { }
    _db = null;
  }
}

function migrate(database: Database.Database) {
  for (const stmt of [
    'ALTER TABLE payments RENAME COLUMN razorpay_payment_id TO provider_payment_id',
    "ALTER TABLE payments ADD COLUMN provider TEXT NOT NULL DEFAULT 'razorpay'",
    'ALTER TABLE deals ADD COLUMN payment_terms_days INTEGER NOT NULL DEFAULT 15',
    'ALTER TABLE deals ADD COLUMN escalation_contact TEXT',
    'ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE users ADD COLUMN upi_id TEXT',
  ]) {
    try { database.exec(stmt); } catch { }
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      plan          TEXT    NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free','creator','pro')),
      plan_expires_at INTEGER,
      session_version INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      upi_id        TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      provider            TEXT    NOT NULL DEFAULT 'razorpay',
      provider_payment_id TEXT    NOT NULL,
      user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan                TEXT    NOT NULL,
      billing             TEXT    NOT NULL DEFAULT 'monthly',
      amount              REAL    NOT NULL,
      currency            TEXT    NOT NULL DEFAULT 'INR',
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (provider, provider_payment_id)
    );

    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

    CREATE TABLE IF NOT EXISTS deals (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      brand              TEXT NOT NULL,
      brand_contact      TEXT,
      brand_email        TEXT,
      brand_whatsapp     TEXT,

      title              TEXT NOT NULL,
      platform           TEXT NOT NULL DEFAULT 'instagram',
      status             TEXT NOT NULL DEFAULT 'negotiating'
                         CHECK (status IN ('negotiating','agreed','delivering','delivered','invoiced','paid','cancelled')),

      deal_value         REAL    NOT NULL DEFAULT 0,
      currency           TEXT    NOT NULL DEFAULT 'INR',
      advance_pct        REAL    NOT NULL DEFAULT 0,

      agreed_on          TEXT,
      deliver_by         TEXT,
      delivered_on       TEXT,
      invoice_number     TEXT,
      invoice_sent_on    TEXT,
      invoice_due_on     TEXT,
      paid_on            TEXT,

      payment_status     TEXT NOT NULL DEFAULT 'not_invoiced'
                         CHECK (payment_status IN ('not_invoiced','advance_paid','invoiced','overdue','paid','cancelled')),

      payment_terms_days INTEGER NOT NULL DEFAULT 15,
      escalation_contact TEXT,

      gst_applicable     INTEGER NOT NULL DEFAULT 0,
      tds_pct            REAL    NOT NULL DEFAULT 0,
      notes              TEXT,

      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash  TEXT    PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at  INTEGER NOT NULL,
      used_at     INTEGER,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS licenses (
      license_key TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      buyer_email TEXT    NOT NULL,
      product_link TEXT   NOT NULL,
      redeemed_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id);

    CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);

    CREATE INDEX IF NOT EXISTS idx_deals_creator ON deals(creator_id);
    CREATE INDEX IF NOT EXISTS idx_deals_status  ON deals(status);
    CREATE INDEX IF NOT EXISTS idx_deals_paystat ON deals(payment_status);
    CREATE INDEX IF NOT EXISTS idx_deals_due     ON deals(invoice_due_on);
  `);
}

const DEAL_COLS = [
  'brand', 'brand_contact', 'brand_email', 'brand_whatsapp', 'title', 'platform',
  'status', 'deal_value', 'currency', 'advance_pct', 'agreed_on', 'deliver_by',
  'delivered_on', 'invoice_number', 'invoice_sent_on', 'invoice_due_on', 'paid_on',
  'payment_status', 'payment_terms_days', 'escalation_contact', 'gst_applicable', 'tds_pct', 'notes',
];

export const driver: DbDriver = {
  async listUsers() {
    return handle().prepare('SELECT id, name, email, upi_id FROM users ORDER BY id').all() as never;
  },

  async listDeals(creatorId) {
    return handle()
      .prepare('SELECT * FROM deals WHERE creator_id = ? ORDER BY created_at DESC, id DESC')
      .all(creatorId) as never;
  },

  async getDeal(creatorId, dealId) {
    return handle()
      .prepare('SELECT * FROM deals WHERE id = ? AND creator_id = ?')
      .get(dealId, creatorId) as never;
  },

  async insertDeal(creatorId, fields) {
    const info = handle()
      .prepare(
        `INSERT INTO deals (creator_id, ${DEAL_COLS.join(', ')})
         VALUES (@creator_id, ${DEAL_COLS.map((c) => `@${c}`).join(', ')})`
      )
      .run({
        creator_id: creatorId,
        ...Object.fromEntries(DEAL_COLS.map((c) => [c, normalizeValue(fields[c] ?? (c === 'payment_terms_days' ? 15 : null))])),
      });
    return this.getDeal(creatorId, Number(info.lastInsertRowid)) as never;
  },

  async updateDeal(creatorId, dealId, updates) {
    const keys = Object.keys(updates);
    if (keys.length > 0) {
      const setSql = keys.map((k) => `${k} = @${k}`).join(', ');
      handle()
        .prepare(`UPDATE deals SET ${setSql}, updated_at = datetime('now') WHERE id = @__id AND creator_id = @__cid`)
        .run({
          ...Object.fromEntries(keys.map((k) => [k, normalizeValue(updates[k])])),
          __id: dealId,
          __cid: creatorId,
        });
    }
    return this.getDeal(creatorId, dealId);
  },

  async deleteDeal(creatorId, dealId) {
    return handle().prepare('DELETE FROM deals WHERE id = ? AND creator_id = ?').run(dealId, creatorId).changes > 0;
  },

  async countActiveDeals(creatorId) {
    const row = handle()
      .prepare(
        `SELECT COUNT(*) AS c FROM deals
         WHERE creator_id = ? AND status NOT IN ('paid','cancelled') AND payment_status <> 'paid'`
      )
      .get(creatorId) as { c: number };
    return row.c;
  },

  async distinctBrands(creatorId) {
    return (
      handle()
        .prepare('SELECT DISTINCT brand FROM deals WHERE creator_id = ? ORDER BY brand')
        .all(creatorId) as { brand: string }[]
    ).map((r) => r.brand);
  },

  async findUserByEmail(email) {
    return handle()
      .prepare('SELECT id, name, email, upi_id, password_hash, plan, plan_expires_at, session_version, created_at FROM users WHERE email = ?')
      .get(email.toLowerCase()) as never;
  },

  async findUserById(id) {
    return handle()
      .prepare('SELECT id, name, email, upi_id, plan, plan_expires_at, session_version, created_at FROM users WHERE id = ?')
      .get(id) as never;
  },

  async createUser(input) {
    const info = handle()
      .prepare('INSERT INTO users (name, email, password_hash, plan) VALUES (?, ?, ?, ?)')
      .run(input.name, input.email.toLowerCase(), input.passwordHash, 'free');
    return this.findUserById(Number(info.lastInsertRowid)) as never;
  },

  async updatePassword(userId, passwordHash) {
    handle().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  },

  async bumpSessionVersion(userId) {
    handle().prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?').run(userId);
  },

  async countLifetimeSales() {
    const row = handle()
      .prepare(`SELECT COUNT(*) AS c FROM payments WHERE billing = 'lifetime'`)
      .get() as { c: number };
    return row.c;
  },

  async getPlanInfo(userId) {
    return handle()
      .prepare('SELECT plan, plan_expires_at FROM users WHERE id = ?')
      .get(userId) as never;
  },

  async grantPlan(userId, plan, planExpiresAt) {
    handle().prepare('UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?').run(plan, planExpiresAt, userId);
  },

  async updateUpiId(userId, upiId) {
    handle().prepare('UPDATE users SET upi_id = ? WHERE id = ?').run(upiId, userId);
  },

  async invalidateLiveResets(userId, usedAt) {
    handle()
      .prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
      .run(usedAt, userId);
  },

  async insertReset(tokenHash, userId, expiresAt) {
    handle()
      .prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(tokenHash, userId, expiresAt);
  },

  async getReset(tokenHash) {
    return handle()
      .prepare('SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?')
      .get(tokenHash) as never;
  },

  async markResetUsed(tokenHash, usedAt) {
    handle().prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').run(usedAt, tokenHash);
  },

  async findPayment(provider, paymentId) {
    return handle()
      .prepare('SELECT id FROM payments WHERE provider = ? AND provider_payment_id = ?')
      .get(provider, paymentId) as never;
  },

  async insertPayment(p) {
    handle()
      .prepare(
        `INSERT INTO payments (provider, provider_payment_id, user_id, plan, billing, amount, currency, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(p.provider, p.provider_payment_id, p.user_id, p.plan, p.billing, p.amount, p.currency);
  },

  async getLicenseByKey(key) {
    return handle()
      .prepare('SELECT license_key, user_id, buyer_email, product_link, redeemed_at FROM licenses WHERE license_key = ?')
      .get(key) as never;
  },

  async getLicenseByUserId(userId) {
    return handle()
      .prepare('SELECT license_key, user_id, buyer_email, product_link, redeemed_at FROM licenses WHERE user_id = ?')
      .get(userId) as never;
  },

  async insertLicense(row) {
    handle()
      .prepare('INSERT INTO licenses (license_key, user_id, buyer_email, product_link) VALUES (?, ?, ?, ?)')
      .run(row.license_key, row.user_id, row.buyer_email, row.product_link);
  },
};
