-- Тип продукта для сделок БОНДА
CREATE TYPE product_type AS ENUM ('findir', 'bonda_bi', 'one_time_service');

-- Период подписки
CREATE TYPE subscription_period AS ENUM ('month', 'quarter', 'half_year', 'year');

-- Новые поля в deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS product_type product_type;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS subscription_period subscription_period;

-- Таблица KPI-записей (чекапы, встречи с наставником)
-- Менеджер вносит вручную каждую запись
CREATE TABLE IF NOT EXISTS kpi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  client_name TEXT NOT NULL,
  amo_link TEXT,
  product TEXT,           -- "Чек-Ап", "ФД", etc.
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE kpi_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_entries_all" ON kpi_entries FOR ALL USING (true);

-- KPI-галочки от руководителя (аттестация, конверсия)
CREATE TABLE IF NOT EXISTS kpi_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES periods(id),
  kpi_type TEXT NOT NULL,     -- 'attestation', 'conversion_approved'
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period_id, kpi_type)
);

ALTER TABLE kpi_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_approvals_all" ON kpi_approvals FOR ALL USING (true);
