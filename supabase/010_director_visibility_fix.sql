-- 010: Fix cross-company visibility for rop/director/founder
-- + sync 'founder' enum + secure helper functions + correct write policies
--
-- Матрица доступа:
--   manager  — только свои данные
--   rop      — read-only кросс-компанийно (Основной + Руководство)
--   director — read кросс-компанийно, write на планы/периоды
--   founder  — read-only кросс-компанийно (Основной + Руководство)
--   admin    — полный доступ

-- ============================================================
-- 0. Синхронизация enum (founder добавлен в проде вручную)
-- ============================================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'founder';

-- ============================================================
-- 1. Helper-функции с SET search_path = public
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_company()
RETURNS UUID AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================
-- 2. companies — SELECT: все руководители кросс-компанийно
-- ============================================================
DROP POLICY IF EXISTS "Users read own company" ON companies;
CREATE POLICY "Users read own company" ON companies
  FOR SELECT USING (
    id = get_user_company()
    OR get_user_role() IN ('admin', 'director', 'rop', 'founder')
  );

-- WRITE: только admin
DROP POLICY IF EXISTS "Admin manages companies" ON companies;
CREATE POLICY "Admin manages companies" ON companies
  FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- 3. positions — SELECT: все руководители кросс-компанийно
-- ============================================================
DROP POLICY IF EXISTS "Users read positions" ON positions;
CREATE POLICY "Users read positions" ON positions
  FOR SELECT USING (
    company_id = get_user_company()
    OR get_user_role() IN ('admin', 'director', 'rop', 'founder')
  );

-- WRITE: только admin
DROP POLICY IF EXISTS "Admin manages positions" ON positions;
CREATE POLICY "Admin manages positions" ON positions
  FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- 4. motivation_schemas — SELECT: все руководители кросс-компанийно
-- ============================================================
DROP POLICY IF EXISTS "Users read schemas" ON motivation_schemas;
CREATE POLICY "Users read schemas" ON motivation_schemas
  FOR SELECT USING (
    position_id IN (SELECT id FROM positions WHERE company_id = get_user_company())
    OR get_user_role() IN ('admin', 'director', 'rop', 'founder')
  );

-- WRITE: только admin
DROP POLICY IF EXISTS "Admin manages schemas" ON motivation_schemas;
CREATE POLICY "Admin manages schemas" ON motivation_schemas
  FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- 5. users — SELECT: rop/director/founder видят ВСЕХ (кросс-компанийно)
--    ЭТО ГЛАВНЫЙ ФИКС — раньше director/rop видели только свою компанию
-- ============================================================
DROP POLICY IF EXISTS "Users read colleagues" ON users;
CREATE POLICY "Users read colleagues" ON users
  FOR SELECT USING (
    id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
  );

-- WRITE: только admin
DROP POLICY IF EXISTS "Admin manages users" ON users;
CREATE POLICY "Admin manages users" ON users
  FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- 6. periods — SELECT: все руководители кросс-компанийно
--    WRITE: admin + director (Руководство)
-- ============================================================
DROP POLICY IF EXISTS "Users read periods" ON periods;
CREATE POLICY "Users read periods" ON periods
  FOR SELECT USING (
    company_id = get_user_company()
    OR get_user_role() IN ('admin', 'director', 'rop', 'founder')
  );

DROP POLICY IF EXISTS "Admin manages periods" ON periods;
CREATE POLICY "Admin manages periods" ON periods
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

-- ============================================================
-- 7. deals — SELECT: менеджер свои, руководители все кросс-компанийно
--    WRITE: менеджер свои + admin/director
-- ============================================================
DROP POLICY IF EXISTS "Manager reads own deals" ON deals;
CREATE POLICY "Manager reads own deals" ON deals
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
  );

-- INSERT: менеджер свои
DROP POLICY IF EXISTS "Manager manages own deals" ON deals;
CREATE POLICY "Manager manages own deals" ON deals
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: менеджер свои + admin/director
DROP POLICY IF EXISTS "Manager updates own deals" ON deals;
CREATE POLICY "Manager updates own deals" ON deals
  FOR UPDATE USING (
    user_id = auth.uid()
    OR get_user_role() IN ('admin', 'director')
  );

-- DELETE: менеджер свои + admin/director
DROP POLICY IF EXISTS "Manager deletes own deals" ON deals;
CREATE POLICY "Manager deletes own deals" ON deals
  FOR DELETE USING (
    user_id = auth.uid()
    OR get_user_role() IN ('admin', 'director')
  );

-- ============================================================
-- 8. meetings — SELECT: менеджер свои, руководители все
--    WRITE: менеджер свои + admin/director
-- ============================================================
DROP POLICY IF EXISTS "Manager reads own meetings" ON meetings;
CREATE POLICY "Manager reads own meetings" ON meetings
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
  );

DROP POLICY IF EXISTS "Manager manages own meetings" ON meetings;
CREATE POLICY "Manager manages own meetings" ON meetings
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Manager updates own meetings" ON meetings;
CREATE POLICY "Manager updates own meetings" ON meetings
  FOR UPDATE USING (
    user_id = auth.uid()
    OR get_user_role() IN ('admin', 'director')
  );

-- ============================================================
-- 9. salary_results — SELECT: менеджер свои, руководители все
--    WRITE: admin + director
-- ============================================================
DROP POLICY IF EXISTS "Manager reads own salary" ON salary_results;
CREATE POLICY "Manager reads own salary" ON salary_results
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
  );

DROP POLICY IF EXISTS "System manages salary" ON salary_results;
CREATE POLICY "System manages salary" ON salary_results
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

-- ============================================================
-- 10. one_time_payments — SELECT: менеджер свои, руководители все
--     WRITE: admin + director + rop (оставляем как было)
-- ============================================================
DROP POLICY IF EXISTS "Manager reads own payments" ON one_time_payments;
CREATE POLICY "Manager reads own payments" ON one_time_payments
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
  );

DROP POLICY IF EXISTS "Admin manages payments" ON one_time_payments;
CREATE POLICY "Admin manages payments" ON one_time_payments
  FOR ALL USING (get_user_role() IN ('admin', 'director', 'rop'));

-- ============================================================
-- 11. individual_plans — SELECT: все руководители
--     WRITE: только admin + director (фикс: убираем rop и founder)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'individual_plans') THEN
    ALTER TABLE individual_plans ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users read plans" ON individual_plans;
    DROP POLICY IF EXISTS "Manager reads own plans" ON individual_plans;
    DROP POLICY IF EXISTS "Leaders manage plans" ON individual_plans;

    CREATE POLICY "Users read plans" ON individual_plans
      FOR SELECT USING (
        user_id = auth.uid()
        OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
      );

    CREATE POLICY "Leaders manage plans" ON individual_plans
      FOR ALL USING (
        get_user_role() IN ('admin', 'director')
      );
  END IF;
END $$;

-- ============================================================
-- 12. kpi_entries — SELECT: все руководители
--     WRITE: только admin + director
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'kpi_entries') THEN
    DROP POLICY IF EXISTS "Users read kpi entries" ON kpi_entries;
    DROP POLICY IF EXISTS "Manager reads own kpi" ON kpi_entries;
    DROP POLICY IF EXISTS "Leaders manage kpi entries" ON kpi_entries;
    DROP POLICY IF EXISTS "kpi_entries_all" ON kpi_entries;

    CREATE POLICY "Users read kpi entries" ON kpi_entries
      FOR SELECT USING (
        user_id = auth.uid()
        OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
      );

    CREATE POLICY "Leaders manage kpi entries" ON kpi_entries
      FOR ALL USING (
        user_id = auth.uid()
        OR get_user_role() IN ('admin', 'director')
      );
  END IF;
END $$;

-- ============================================================
-- 13. kpi_approvals — SELECT: все руководители
--     WRITE: только admin + director
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'kpi_approvals') THEN
    DROP POLICY IF EXISTS "Users read kpi approvals" ON kpi_approvals;
    DROP POLICY IF EXISTS "Leaders manage kpi approvals" ON kpi_approvals;
    DROP POLICY IF EXISTS "kpi_approvals_all" ON kpi_approvals;

    CREATE POLICY "Users read kpi approvals" ON kpi_approvals
      FOR SELECT USING (
        get_user_role() IN ('rop', 'director', 'admin', 'founder')
      );

    CREATE POLICY "Leaders manage kpi approvals" ON kpi_approvals
      FOR ALL USING (
        get_user_role() IN ('admin', 'director')
      );
  END IF;
END $$;
