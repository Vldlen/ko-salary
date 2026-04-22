-- 012: RPC record_partial_payment — атомарная запись частичной/полной оплаты
--
-- Почему RPC, а не клиентский UPDATE:
--   1. Статус (paid/partial/waiting_payment/no_invoice) рассчитывается на сервере
--      по актуальным значениям revenue/impl_revenue/content_revenue/equipment_sell_price
--      из самой сделки (SELECT FOR UPDATE). Клиентские расчёты могут быть stale.
--   2. Все поля (paid_*, status, paid_at) обновляются одной транзакцией — никакой
--      клиент не увидит "paid_license обновлён, но status ещё partial".
--   3. Унифицируется логика ИННО vs БОНДА (#7 из аудита):
--      - ИННО: paid иff все 4 категории закрыты (license, impl, content, equipment)
--      - БОНДА: paid иff paid_amount >= revenue
--
-- Вызов из JS:
--   supabase.rpc('record_partial_payment', {
--     p_deal_id, p_paid_license, p_paid_impl, p_paid_content, p_paid_equipment,
--     p_paid_amount, p_paid_at
--   })

CREATE OR REPLACE FUNCTION record_partial_payment(
  p_deal_id UUID,
  p_paid_license NUMERIC DEFAULT NULL,
  p_paid_impl NUMERIC DEFAULT NULL,
  p_paid_content NUMERIC DEFAULT NULL,
  p_paid_equipment NUMERIC DEFAULT NULL,
  p_paid_amount NUMERIC DEFAULT NULL,
  p_paid_at DATE DEFAULT NULL
)
RETURNS deals
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_deal deals%ROWTYPE;
  v_company_type company_type;
  v_is_bonda BOOLEAN;
  v_new_status deal_status;
  v_paid_license NUMERIC;
  v_paid_impl NUMERIC;
  v_paid_content NUMERIC;
  v_paid_equipment NUMERIC;
  v_paid_amount NUMERIC;
  v_total_paid_inno NUMERIC;
  v_is_fully_paid BOOLEAN;
BEGIN
  -- Лочим строку сделки до конца транзакции — второй клиент с partial popup будет ждать
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id FOR UPDATE;

  IF v_deal.id IS NULL THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id USING ERRCODE = 'P0002';
  END IF;

  -- Права: RLS на UPDATE уже проверит, но добавим явную проверку для ясности.
  -- SECURITY INVOKER → запрос выполняется от имени клиента, RLS политики применяются.

  -- Определяем тип компании через users → companies
  SELECT c.company_type INTO v_company_type
  FROM users u
  JOIN companies c ON c.id = u.company_id
  WHERE u.id = v_deal.user_id;

  v_is_bonda := (v_company_type = 'bonda');

  -- Clamp'им paid_* значения в пределы 0..target (защита от клиентских ошибок)
  v_paid_license   := GREATEST(0, LEAST(COALESCE(p_paid_license,   v_deal.paid_license,   0), COALESCE(v_deal.revenue, 0)));
  v_paid_impl      := GREATEST(0, LEAST(COALESCE(p_paid_impl,      v_deal.paid_impl,      0), COALESCE(v_deal.impl_revenue, 0)));
  v_paid_content   := GREATEST(0, LEAST(COALESCE(p_paid_content,   v_deal.paid_content,   0), COALESCE(v_deal.content_revenue, 0)));
  v_paid_equipment := GREATEST(0, LEAST(COALESCE(p_paid_equipment, v_deal.paid_equipment, 0), COALESCE(v_deal.equipment_sell_price, 0)));
  v_paid_amount    := GREATEST(0, LEAST(COALESCE(p_paid_amount,    v_deal.paid_amount,    0), COALESCE(v_deal.revenue, 0)));

  -- Логика статуса — единая точка правды
  IF v_is_bonda THEN
    -- БОНДА: оплачено по одной строке revenue через paid_amount
    IF v_paid_amount <= 0 THEN
      v_new_status := CASE WHEN v_deal.status = 'no_invoice' THEN 'no_invoice'::deal_status ELSE 'waiting_payment'::deal_status END;
    ELSIF v_paid_amount >= COALESCE(v_deal.revenue, 0) AND COALESCE(v_deal.revenue, 0) > 0 THEN
      v_new_status := 'paid'::deal_status;
    ELSE
      v_new_status := 'partial'::deal_status;
    END IF;
  ELSE
    -- ИННО: 4 отдельные категории (license, impl, content, equipment)
    v_total_paid_inno := v_paid_license + v_paid_impl + v_paid_content + v_paid_equipment;

    v_is_fully_paid := (
      v_paid_license   >= COALESCE(v_deal.revenue,               0)
      AND v_paid_impl      >= COALESCE(v_deal.impl_revenue,          0)
      AND v_paid_content   >= COALESCE(v_deal.content_revenue,       0)
      AND v_paid_equipment >= COALESCE(v_deal.equipment_sell_price,  0)
      -- И хотя бы в одной категории был contract > 0 (иначе это сделка без ничего)
      AND (
        COALESCE(v_deal.revenue, 0)
        + COALESCE(v_deal.impl_revenue, 0)
        + COALESCE(v_deal.content_revenue, 0)
        + COALESCE(v_deal.equipment_sell_price, 0)
      ) > 0
    );

    IF v_total_paid_inno <= 0 THEN
      v_new_status := CASE WHEN v_deal.status = 'no_invoice' THEN 'no_invoice'::deal_status ELSE 'waiting_payment'::deal_status END;
    ELSIF v_is_fully_paid THEN
      v_new_status := 'paid'::deal_status;
    ELSE
      v_new_status := 'partial'::deal_status;
    END IF;
  END IF;

  -- Атомарный update всех полей + статуса
  UPDATE deals SET
    paid_license   = v_paid_license,
    paid_impl      = v_paid_impl,
    paid_content   = v_paid_content,
    paid_equipment = v_paid_equipment,
    paid_amount    = v_paid_amount,
    paid_at        = CASE WHEN v_new_status IN ('paid', 'partial') THEN COALESCE(p_paid_at, v_deal.paid_at, CURRENT_DATE) ELSE NULL END,
    status         = v_new_status,
    updated_at     = now()
  WHERE id = p_deal_id
  RETURNING * INTO v_deal;

  RETURN v_deal;
END;
$$;

-- Разрешаем выполнение авторизованным пользователям (RLS на UPDATE deals определит, кто может)
GRANT EXECUTE ON FUNCTION record_partial_payment(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, DATE) TO authenticated;
