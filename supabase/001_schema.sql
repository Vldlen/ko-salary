-- КО Salary System — Database Schema
-- Run this in Supabase SQL Editor

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'director', 'rop', 'manager');
CREATE TYPE period_status AS ENUM ('draft', 'active', 'closed');
CREATE TYPE deal_status AS ENUM ('prospect', 'negotiation', 'waiting_payment', 'paid', 'cancelled');
CREATE TYPE payment_type AS ENUM ('bonus', 'deduction');

-- Companies (юрлица: ИННО, БОНДА)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Positions (должности)
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Motivation schemas (схемы мотивации)
CREATE TABLE motivation_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_salary INTEGER NOT NULL DEFAULT 0,
  valid_from DATE NOT NULL,
  valid_to DATE,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users (сотрудники)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'manager',
  company_id UUID REFERENCES companies(id),
  position_id UUID REFERENCES positions(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Periods (расчётные периоды)
CREATE TABLE periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  status period_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, year, month)
);

-- Deals (сделки)
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  mrr DECIMAL(12,2) NOT NULL DEFAULT 0,
  units INTEGER NOT NULL DEFAULT 0,
  status deal_status NOT NULL DEFAULT 'prospect',
  equipment_margin DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_forecast BOOLEAN NOT NULL DEFAULT false,
  forecast_revenue DECIMAL(12,2),
  forecast_close_date DATE,
  notes TEXT,
  amo_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Meetings (встречи — ежедневный трекинг)
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  scheduled INTEGER NOT NULL DEFAULT 0,
  new_completed INTEGER NOT NULL DEFAULT 0,
  repeat_completed INTEGER NOT NULL DEFAULT 0,
  mentor INTEGER NOT NULL DEFAULT 0,
  next_day INTEGER NOT NULL DEFAULT 0,
  rescheduled INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Salary results (рассчитанные ЗП)
CREATE TABLE salary_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  kpi_quality DECIMAL(12,2) NOT NULL DEFAULT 0,
  kpi_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  margin_bonus DECIMAL(12,2) NOT NULL DEFAULT 0,
  extra_bonus DECIMAL(12,2) NOT NULL DEFAULT 0,
  deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  forecast_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period_id)
);

-- One-time payments (разовые выплаты/вычеты)
CREATE TABLE one_time_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  type payment_type NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_deals_user_period ON deals(user_id, period_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_meetings_user_date ON meetings(user_id, date);
CREATE INDEX idx_salary_user_period ON salary_results(user_id, period_id);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_periods_company ON periods(company_id, year, month);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
