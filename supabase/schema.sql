
create table if not exists users (
  id              integer generated always as identity primary key,
  name            text    not null,
  email           text    not null unique,
  upi_id          text,
  auto_followups  integer not null default 0,
  password_hash   text    not null,
  plan            text    not null default 'free'
                  check (plan in ('free','creator','pro')),
  plan_expires_at double precision,
  session_version integer not null default 1,
  created_at      text    not null
                  default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);


create table if not exists payments (
  id                  integer generated always as identity primary key,
  provider            text    not null default 'razorpay',
  provider_payment_id text    not null,
  user_id             integer not null references users (id) on delete cascade,
  plan                text    not null,
  billing             text    not null default 'monthly',
  amount              double precision not null,
  currency            text    not null default 'INR',
  created_at          text    not null
                      default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  unique (provider, provider_payment_id)
);

create index if not exists idx_payments_user on payments (user_id);

create table if not exists deals (
  id             integer generated always as identity primary key,
  creator_id     integer not null references users (id) on delete cascade,

  brand          text not null,
  brand_contact  text,
  brand_email    text,
  brand_whatsapp text,

  title          text not null,
  platform       text not null default 'instagram',
  status         text not null default 'negotiating'
                 check (status in ('negotiating','agreed','delivering','delivered','invoiced','paid','cancelled')),

  deal_value     double precision not null default 0,
  currency       text not null default 'INR',
  advance_pct    double precision not null default 0,

  agreed_on        text,
  deliver_by       text,
  delivered_on     text,
  invoice_number   text,
  invoice_sent_on  text,
  invoice_due_on   text,
  paid_on          text,

  payment_status text not null default 'not_invoiced'
                 check (payment_status in ('not_invoiced','advance_paid','invoiced','overdue','paid','cancelled')),

  payment_terms_days integer not null default 15,
  escalation_contact text,

  gst_applicable integer not null default 0,
  tds_pct        double precision not null default 0,
  notes          text,

  created_at text not null
             default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  updated_at text not null
             default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

create table if not exists password_resets (
  token_hash text    primary key,
  user_id    integer not null references users (id) on delete cascade,
  expires_at double precision not null,
  used_at    double precision,
  created_at text    not null
             default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

create table if not exists licenses (
  license_key text    not null primary key,
  user_id     integer not null unique references users (id) on delete cascade,
  buyer_email text    not null,
  product_link text   not null,
  redeemed_at text    not null
              default to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

create index if not exists idx_licenses_user  on licenses (user_id);
create index if not exists idx_resets_user   on password_resets (user_id);
create index if not exists idx_deals_creator on deals (creator_id);
create index if not exists idx_deals_status  on deals (status);
create index if not exists idx_deals_paystat on deals (payment_status);
create index if not exists idx_deals_due     on deals (invoice_due_on);

alter table users          enable row level security;
alter table payments       enable row level security;
alter table deals          enable row level security;
alter table password_resets enable row level security;
alter table licenses       enable row level security;

create table if not exists auto_sends (
  id              integer generated always as identity primary key,
  creator_id      integer not null references users (id) on delete cascade,
  deal_id         integer not null references deals (id) on delete cascade,
  kind            text    not null,
  sent_on         text    not null,
  created_at      timestamptz not null default now(),
  unique (creator_id, deal_id, kind)
);

create table if not exists manager_links (
  manager_id      integer not null references users (id) on delete cascade,
  creator_id      integer not null references users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (manager_id, creator_id)
);

create table if not exists manager_codes (
  code_hash       text primary key,
  creator_id      integer not null references users (id) on delete cascade,
  expires_at      bigint not null,
  created_at      timestamptz not null default now()
);
