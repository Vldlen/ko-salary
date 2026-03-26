-- Simplify deal statuses: no_invoice, waiting_payment, paid
-- Run this in Supabase SQL Editor

-- 1. Update existing deals to new statuses
UPDATE deals SET status = 'waiting_payment' WHERE status = 'negotiation';
UPDATE deals SET status = 'no_invoice' WHERE status = 'prospect';
-- cancelled deals → no_invoice (or delete them if preferred)
UPDATE deals SET status = 'no_invoice' WHERE status = 'cancelled';

-- 2. Recreate the enum with new values
ALTER TYPE deal_status RENAME TO deal_status_old;

CREATE TYPE deal_status AS ENUM ('no_invoice', 'waiting_payment', 'paid');

ALTER TABLE deals
  ALTER COLUMN status TYPE deal_status USING status::text::deal_status;

ALTER TABLE deals
  ALTER COLUMN status SET DEFAULT 'no_invoice';

DROP TYPE deal_status_old;
