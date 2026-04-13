-- Fix: add INSERT/UPDATE/DELETE policies for individual_plans
-- Director, admin, and founder can manage plans (currently only SELECT exists)

-- INSERT policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'individual_plans') THEN
    DROP POLICY IF EXISTS "Leaders manage plans" ON individual_plans;
    CREATE POLICY "Leaders manage plans" ON individual_plans
      FOR ALL USING (
        get_user_role() IN ('admin', 'director', 'founder', 'rop')
      );
  END IF;
END $$;

-- Also ensure KPI tables have write policies for leaders
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'kpi_entries') THEN
    DROP POLICY IF EXISTS "Leaders manage kpi entries" ON kpi_entries;
    CREATE POLICY "Leaders manage kpi entries" ON kpi_entries
      FOR ALL USING (
        user_id = auth.uid()
        OR get_user_role() IN ('admin', 'director', 'founder', 'rop')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'kpi_approvals') THEN
    DROP POLICY IF EXISTS "Leaders manage kpi approvals" ON kpi_approvals;
    CREATE POLICY "Leaders manage kpi approvals" ON kpi_approvals
      FOR ALL USING (
        get_user_role() IN ('admin', 'director', 'founder', 'rop')
      );
  END IF;
END $$;
