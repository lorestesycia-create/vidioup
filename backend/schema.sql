-- VidioUp V1 database schema (PostgreSQL)
create table users (
  id uuid primary key,
  email text unique not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table wallets (
  user_id uuid primary key references users(id),
  available bigint not null default 0 check (available >= 0),
  reserved bigint not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now()
);
create table ledger_transactions (
  id uuid primary key,
  user_id uuid not null references users(id),
  kind text not null,
  amount bigint not null,
  origin text not null,
  reference_id text,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create table videos (
  id uuid primary key,
  owner_id uuid not null references users(id),
  youtube_url text not null,
  title text,
  category text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create table campaigns (
  id uuid primary key,
  user_id uuid not null references users(id),
  video_id uuid not null references videos(id),
  mode text not null check (mode in ('basic','featured','boost')),
  budget bigint not null check (budget >= 100),
  reserved_remaining bigint not null default 0,
  consumed bigint not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
create table campaign_events (
  id uuid primary key,
  campaign_id uuid not null references campaigns(id),
  event_type text not null,
  cost bigint not null default 0,
  event_key text unique not null,
  created_at timestamptz not null default now()
);
create table purchases (
  id uuid primary key,
  user_id uuid not null references users(id),
  product_id text not null,
  purchase_token text unique not null,
  coins bigint not null,
  status text not null,
  created_at timestamptz not null default now()
);
create table rewarded_events (
  id uuid primary key,
  user_id uuid not null references users(id),
  ad_event_id text unique not null,
  coins bigint not null,
  status text not null,
  created_at timestamptz not null default now()
);
create table reports (
  id uuid primary key,
  reporter_id uuid not null references users(id),
  target_type text not null,
  target_id text not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
