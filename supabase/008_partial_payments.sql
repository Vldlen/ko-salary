-- 008: Частичная оплата сделок
-- Добавляет поля для отслеживания оплаченных сумм по каждому компоненту
-- и новый статус 'partial' для частично оплаченных сделок

-- 1. Добавляем статус 'partial' в enum
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'partial' AFTER 'waiting_payment';

-- 2. ИННО: оплаченные суммы по компонентам
ALTER TABLE deals ADD COLUMN IF NOT EXISTS paid_license DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS paid_impl DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS paid_content DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS paid_equipment DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 3. БОНДА: оплаченная сумма (одно поле, т.к. один продукт на сделку)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 4. Миграция существующих данных: у оплаченных сделок заполняем paid_* = полная сумма
UPDATE deals SET
  paid_license = revenue,
  paid_impl = COALESCE(impl_revenue, 0),
  paid_content = COALESCE(content_revenue, 0),
  paid_equipment = COALESCE(
    CASE WHEN equipment_sell_price > 0
      THEN equipment_sell_price * 0.9 - equipment_buy_price
      ELSE equipment_margin END,
    0
  ),
  paid_amount = revenue
WHERE status = 'paid';
