-- Add 'founder' role to all relevant RLS policies
-- Founder can read ALL data across ALL companies (like admin/director)

-- Companies: founder can read all
DROP POLICY IF EXISTS "Users read own company" ON companies;
CREATE POLICY "Users read own company" ON companies
  FOR SELECT USING (
    id = get_user_company()
    OR get_user_role() IN ('admin', 'director', 'founder')
  );

-- Positions: founder can read all
DROP POLICY IF EXISTS "Users read positions" ON positions;
CREATE POLICY "Users read positions" ON positions
  FOR SELECT USING (
    company_id = get_user_company()
    OR get_user_role() IN ('admin', 'director', 'founder')
  );

-- Motivation schemas: founder can read all
DROP POLICY IF EXISTS "Users read schemas" ON motivation_schemas;
CREATE POLICY "Users read schemas" ON motivation_schemas
  FOR SELECT USING (
    position_id IN (SELECT id FROM positions WHERE company_id = get_user_company())
    OR get_user_role() IN ('admin', 'director', 'founder')
  );

-- Users: founder can read all users
DROP POLICY IF EXISTS "Users read colleagues" ON users;
CREATE POLICY "Users read colleagues" ON users
  FOR SELECT USING (
    id = auth.uid()
    OR (company_id = get_user_company() AND get_user_role() IN ('rop', 'director', 'admin'))
    OR get_user_role() IN ('admin', 'founder')
  );

-- Periods: founder can read all
DROP POLICY IF EXISTS "Users read periods" ON periods;
CREATE POLICY "Users read periods" ON periods
  FOR SELECT USING (
    company_id = get_user_company()
    OR get_user_role() IN ('admin', 'director', 'founder')
  );

-- Deals: founder can read all
DROP POLICY IF EXISTS "Manager reads own deals" ON deals;
CREATE POLICY "Manager reads own deals" ON deals
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
  );

-- Meetings: founder can read all
DROP POLICY IF EXISTS "Manager reads own meetings" ON meetings;
CREATE POLICY "Manager reads own meetings" ON meetings
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
  );

-- Salary results: founder can read all
DROP POLICY IF EXISTS "Manager reads own salary" ON salary_results;
CREATE POLICY "Manager reads own salary" ON salary_results
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
  );

-- One-time payments: founder can read all
DROP POLICY IF EXISTS "Manager reads own payments" ON one_time_payments;
CREATE POLICY "Manager reads own payments" ON one_time_payments
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
  );

-- Individual plans: check if table has RLS, add founder
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'individual_plans') THEN
    -- Ensure RLS is enabled
    ALTER TABLE individual_plans ENABLE ROW LEVEL SECURITY;

    -- Drop existing policy if any
    DROP POLICY IF EXISTS "Users read plans" ON individual_plans;
    DROP POLICY IF EXISTS "Manager reads own plans" ON individual_plans;

    -- Create policy with founder access
    CREATE POLICY "Users read plans" ON individual_plans
      FOR SELECT USING (
        user_id = auth.uid()
        OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
      );
  END IF;
END $$;

-- KPI entries: add founder if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'kpi_entries') THEN
    DROP POLICY IF EXISTS "Users read kpi entries" ON kpi_entries;
    DROP POLICY IF EXISTS "Manager reads own kpi" ON kpi_entries;

    CREATE POLICY "Users read kpi entries" ON kpi_entries
      FOR SELECT USING (
        user_id = auth.uid()
        OR get_user_role() IN ('rop', 'director', 'admin', 'founder')
      );
  END IF;
END $$;

-- KPI approvals: add founder if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'kpi_approvals') THEN
    DROP POLICY IF EXISTS "Users read kpi approvals" ON kpi_approvals;

    CREATE POLICY "Users read kpi approvals" ON kpi_approvals
      FOR SELECT USING (
        get_user_role() IN ('rop', 'director', 'admin', 'founder')
      );
  END IF;
END $$;
