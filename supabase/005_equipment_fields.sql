-- Add equipment sell/buy price fields, keep equipment_margin as computed
-- Run this in Supabase SQL Editor

ALTER TABLE deals ADD COLUMN equipment_sell_price DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE deals ADD COLUMN equipment_buy_price DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Migrate existing margin data: assume it was already the final margin
-- Set sell_price = margin / 0.9 (reverse calc), buy_price = 0
UPDATE deals
SET equipment_sell_price = CASE
  WHEN equipment_margin > 0 THEN ROUND(equipment_margin / 0.9, 2)
  ELSE 0
END
WHERE equipment_margin > 0;
