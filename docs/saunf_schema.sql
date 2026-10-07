-- ============================================================
-- Saunf Meal Subscription — PostgreSQL Schema
-- Version: Phase 1
-- All monetary values are stored as INTEGER in paise (₹1 = 100 paise).
-- All timestamps are TIMESTAMPTZ and the application uses Asia/Kolkata.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUM TYPES ──────────────────────────────────────────────────

CREATE TYPE meal_selection_state AS ENUM ('PENDING', 'PRESENT', 'ABSENT');

CREATE TYPE selection_source AS ENUM (
  'CUSTOMER_VOTE',
  'CUSTOMER_FOLLOWUP',
  'CUSTOMER_WEB',
  'OWNER',
  'SYSTEM'
);

CREATE TYPE ledger_entry_type AS ENUM (
  'PLAN_CREDIT',
  'MEAL_CONSUMED',
  'CARRYOVER_CREDIT',
  'CARRYOVER_APPLIED',
  'REVERSAL',
  'ADJUSTMENT'
);

CREATE TYPE invoice_status AS ENUM (
  'DRAFT',
  'PENDING_PAYMENT',
  'PAID',
  'OVERDUE',
  'CANCELLED'
);

CREATE TYPE subscription_status AS ENUM (
  'ACTIVE',
  'PAUSED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE user_role AS ENUM ('OWNER', 'STAFF', 'CUSTOMER');

CREATE TYPE whatsapp_message_status AS ENUM (
  'QUEUED',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED'
);

-- ─── CUSTOMERS ───────────────────────────────────────────────────

CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,        -- E.164 format, e.g. +919876543210
  address       TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  wa_opted_in   BOOLEAN NOT NULL DEFAULT FALSE,
  wa_consent_at TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers (phone);
CREATE INDEX idx_customers_active ON customers (is_active) WHERE is_active = TRUE;

-- ─── ADMIN USERS ─────────────────────────────────────────────────

CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT UNIQUE,
  password_hash TEXT,                        -- nullable if OTP-only auth
  role          user_role NOT NULL DEFAULT 'STAFF',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PLANS ───────────────────────────────────────────────────────

CREATE TABLE plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,               -- e.g. "Monthly Thali – 30 meals"
  meals_per_month INTEGER NOT NULL DEFAULT 30,
  price_paise     INTEGER NOT NULL,            -- total plan price in paise
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_meals_positive CHECK (meals_per_month > 0),
  CONSTRAINT chk_price_positive CHECK (price_paise > 0)
);

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────────

CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  plan_id       UUID NOT NULL REFERENCES plans(id),
  status        subscription_status NOT NULL DEFAULT 'ACTIVE',
  start_date    DATE NOT NULL,
  end_date      DATE,                        -- NULL means ongoing
  billing_day   INTEGER NOT NULL DEFAULT 1,  -- day of month for invoicing
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_billing_day CHECK (billing_day BETWEEN 1 AND 28)
);

CREATE INDEX idx_subscriptions_customer ON subscriptions (customer_id);
CREATE INDEX idx_subscriptions_active ON subscriptions (status) WHERE status = 'ACTIVE';

-- ─── MENU ITEMS (dish catalogue) ─────────────────────────────────

CREATE TABLE menu_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                 -- e.g. "Paneer Butter Masala"
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── DAILY MENUS ─────────────────────────────────────────────────

CREATE TABLE daily_menus (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_date       DATE NOT NULL UNIQUE,
  send_time       TIMESTAMPTZ,               -- when to send WhatsApp messages
  cutoff_time     TIMESTAMPTZ,               -- after this, customers can't change votes
  is_locked       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE after cutoff
  created_by      UUID REFERENCES admin_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_menus_date ON daily_menus (menu_date);

-- ─── DAILY MENU ITEMS (which dishes are offered on a date) ───────

CREATE TABLE daily_menu_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_menu_id  UUID NOT NULL REFERENCES daily_menus(id) ON DELETE CASCADE,
  menu_item_id   UUID NOT NULL REFERENCES menu_items(id),
  display_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (daily_menu_id, menu_item_id)
);

CREATE INDEX idx_daily_menu_items_menu ON daily_menu_items (daily_menu_id);

-- ─── MEAL SELECTIONS ─────────────────────────────────────────────
-- One row per customer per day. The core state machine.

CREATE TABLE meal_selections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  daily_menu_id   UUID NOT NULL REFERENCES daily_menus(id),
  menu_date       DATE NOT NULL,
  state           meal_selection_state NOT NULL DEFAULT 'PENDING',
  menu_item_id    UUID REFERENCES menu_items(id),  -- NULL when PENDING or ABSENT
  source          selection_source NOT NULL DEFAULT 'SYSTEM',
  resolved_at     TIMESTAMPTZ,               -- when state left PENDING
  resolved_by     UUID,                      -- admin_user id if OWNER resolved
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, menu_date)
);

CREATE INDEX idx_meal_selections_date ON meal_selections (menu_date);
CREATE INDEX idx_meal_selections_state ON meal_selections (state);
CREATE INDEX idx_meal_selections_customer_date ON meal_selections (customer_id, menu_date);
CREATE INDEX idx_meal_selections_pending ON meal_selections (menu_date, state) WHERE state = 'PENDING';

-- ─── SELECTION AUDIT ─────────────────────────────────────────────
-- Every state change is recorded here for full traceability.

CREATE TABLE selection_audit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_selection_id UUID NOT NULL REFERENCES meal_selections(id),
  previous_state    meal_selection_state,
  new_state         meal_selection_state NOT NULL,
  previous_item_id  UUID REFERENCES menu_items(id),
  new_item_id       UUID REFERENCES menu_items(id),
  source            selection_source NOT NULL,
  actor_id          UUID,                    -- customer or admin_user UUID
  actor_type        TEXT,                    -- 'customer' or 'admin'
  reason            TEXT,                    -- required for owner overrides
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_selection_audit_selection ON selection_audit (meal_selection_id);
CREATE INDEX idx_selection_audit_date ON selection_audit (created_at);

-- ─── MEAL LEDGER ─────────────────────────────────────────────────
-- Append-only financial ledger. Balances are always computed from entries.
-- Never update or delete rows. Corrections use REVERSAL entries.

CREATE TABLE meal_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID NOT NULL REFERENCES customers(id),
  subscription_id   UUID REFERENCES subscriptions(id),
  entry_type        ledger_entry_type NOT NULL,
  meals             INTEGER NOT NULL,        -- positive = credit, negative = debit
  amount_paise      INTEGER NOT NULL DEFAULT 0,  -- monetary impact in paise
  reference_id      UUID,                    -- links to meal_selection, invoice, etc.
  reference_type    TEXT,                    -- 'meal_selection', 'invoice', 'adjustment'
  note              TEXT,
  created_by        UUID,                    -- admin_user id for manual entries
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meal_ledger_customer ON meal_ledger (customer_id);
CREATE INDEX idx_meal_ledger_subscription ON meal_ledger (subscription_id);
CREATE INDEX idx_meal_ledger_type ON meal_ledger (entry_type);
CREATE INDEX idx_meal_ledger_created ON meal_ledger (created_at);

-- ─── INVOICES ────────────────────────────────────────────────────

CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES customers(id),
  subscription_id     UUID NOT NULL REFERENCES subscriptions(id),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  meals_in_plan       INTEGER NOT NULL,
  per_meal_paise      INTEGER NOT NULL,
  carryover_applied   INTEGER NOT NULL DEFAULT 0,  -- meals carried over from previous
  meals_charged       INTEGER NOT NULL,            -- meals_in_plan - carryover_applied
  amount_due_paise    INTEGER NOT NULL,
  pending_days_count  INTEGER NOT NULL DEFAULT 0,  -- unresolved days at generation time
  status              invoice_status NOT NULL DEFAULT 'DRAFT',
  razorpay_link_id    TEXT,
  razorpay_payment_id TEXT,
  paid_at             TIMESTAMPTZ,
  override_reason     TEXT,                        -- if generated with pending days
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_customer ON invoices (customer_id);
CREATE INDEX idx_invoices_status ON invoices (status);
CREATE INDEX idx_invoices_period ON invoices (period_start, period_end);

-- ─── WHATSAPP MESSAGES (outbound and inbound log) ────────────────

CREATE TABLE whatsapp_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id   TEXT UNIQUE,               -- WhatsApp's message ID for idempotency
  customer_id     UUID REFERENCES customers(id),
  direction       TEXT NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),
  template_name   TEXT,
  message_body    TEXT,
  button_payload  TEXT,                      -- for inbound quick-reply captures
  status          whatsapp_message_status NOT NULL DEFAULT 'QUEUED',
  error_code      TEXT,
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_messages_customer ON whatsapp_messages (customer_id);
CREATE INDEX idx_wa_messages_wa_id ON whatsapp_messages (wa_message_id);
CREATE INDEX idx_wa_messages_status ON whatsapp_messages (status);

-- ─── PAYMENTS (Razorpay event log) ───────────────────────────────

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID REFERENCES invoices(id),
  razorpay_event_id   TEXT UNIQUE,           -- for idempotency
  razorpay_payment_id TEXT,
  razorpay_link_id    TEXT,
  amount_paise        INTEGER NOT NULL,
  status              TEXT NOT NULL,          -- e.g. 'captured', 'failed', 'refunded'
  method              TEXT,                   -- 'upi', 'card', 'netbanking', etc.
  raw_payload         JSONB,                  -- full webhook payload for debugging
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments (invoice_id);
CREATE INDEX idx_payments_event ON payments (razorpay_event_id);

-- ─── HOLIDAYS ────────────────────────────────────────────────────

CREATE TABLE holidays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  reason      TEXT NOT NULL,
  created_by  UUID REFERENCES admin_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_holidays_date ON holidays (holiday_date);

-- ─── OTP CODES ───────────────────────────────────────────────────

CREATE TABLE otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  code        TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  is_used     BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_codes (phone, is_used, expires_at);

-- ─── HELPER FUNCTION: update updated_at on row change ────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_daily_menus_updated_at BEFORE UPDATE ON daily_menus FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_meal_selections_updated_at BEFORE UPDATE ON meal_selections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_wa_messages_updated_at BEFORE UPDATE ON whatsapp_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── VIEW: Customer meal balance ─────────────────────────────────
-- Convenience view that computes current balance from the ledger.

CREATE VIEW customer_meal_balance AS
SELECT
  customer_id,
  SUM(meals) AS total_meal_balance,
  SUM(CASE WHEN entry_type = 'CARRYOVER_CREDIT' THEN meals ELSE 0 END)
    + SUM(CASE WHEN entry_type = 'CARRYOVER_APPLIED' THEN meals ELSE 0 END) AS carryover_balance,
  SUM(CASE WHEN entry_type = 'PLAN_CREDIT' THEN meals ELSE 0 END)
    + SUM(CASE WHEN entry_type = 'MEAL_CONSUMED' THEN meals ELSE 0 END) AS meals_remaining
FROM meal_ledger
GROUP BY customer_id;
