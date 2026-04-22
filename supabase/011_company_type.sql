-- 011: company_type column + индекс motivation_schemas
--
-- Мотивация: хватит определять ИННО/БОНДА по `name.includes('БОНД')`.
-- Один переименованный юрлицо — и вся логика расчёта ломается.
-- Вводим явную колонку `company_type` в companies.
--
-- После применения этой миграции фронт должен читать company.company_type
-- вместо парсинга company.name.

-- ============================================================
-- 1. Enum для типа компании
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_type') THEN
    CREATE TYPE company_type AS ENUM ('inno', 'bonda');
  END IF;
END $$;

-- ============================================================
-- 2. Колонка company_type в companies
-- ============================================================
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS company_type company_type;

-- ============================================================
-- 3. Backfill существующих записей по текущему именованию
-- ============================================================
UPDATE companies
SET company_type = 'bonda'
WHERE company_type IS NULL
  AND upper(name) LIKE '%БОНД%';

UPDATE companies
SET company_type = 'inno'
WHERE company_type IS NULL
  AND (upper(name) LIKE '%ИНН%' OR upper(name) LIKE '%INNO%');

-- Страховка: если что-то не распозналось, пометим как 'inno' (безопаснее — расчёт по ИННО-схеме не трогает БОНДА-продукты).
-- Если в проде останутся NULL — лучше явно увидеть и поправить руками.
-- Поэтому NOT NULL пока НЕ ставим, только логируем предупреждение.
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM companies WHERE company_type IS NULL;
  IF null_count > 0 THEN
    RAISE WARNING 'companies.company_type is NULL for % rows — проверь и заполни вручную', null_count;
  END IF;
END $$;

-- ============================================================
-- 4. Индекс на motivation_schemas для поиска актуальной схемы
--    Запросы вида: WHERE position_id = ? AND valid_from <= now() AND (valid_to IS NULL OR valid_to >= now())
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_motivation_schemas_position_valid
  ON motivation_schemas(position_id, valid_from, valid_to);

-- ============================================================
-- 5. Дополнительные индексы под частые выборки (не критично, но дёшево)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_deals_period_user_status
  ON deals(period_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_deals_paid_at
  ON deals(paid_at) WHERE paid_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_period_user
  ON meetings(period_id, user_id);
