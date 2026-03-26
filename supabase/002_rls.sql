-- Row Level Security (RLS) policies
-- Ensures each user only sees what their role allows

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE motivation_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_time_payments ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's company
CREATE OR REPLACE FUNCTION get_user_company()
RETURNS UUID AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Companies: everyone can read their own company
CREATE POLICY "Users read own company" ON companies
  FOR SELECT USING (
    id = get_user_company()
    OR get_user_role() IN ('admin', 'director')
  );

CREATE POLICY "Admin manages companies" ON companies
  FOR ALL USING (get_user_role() = 'admin');

-- Positions: read own company, admin manages
CREATE POLICY "Users read positions" ON positions
  FOR SELECT USING (
    company_id = get_user_company()
    OR get_user_role() IN ('admin', 'director')
  );

CREATE POLICY "Admin manages positions" ON positions
  FOR ALL USING (get_user_role() = 'admin');

-- Motivation schemas: read own position, admin manages
CREATE POLICY "Users read schemas" ON motivation_schemas
  FOR SELECT USING (
    position_id IN (SELECT id FROM positions WHERE company_id = get_user_company())
    OR get_user_role() IN ('admin', 'director')
  );

CREATE POLICY "Admin manages schemas" ON motivation_schemas
  FOR ALL USING (get_user_role() = 'admin');

-- Users: see colleagues in own company, admin sees all
CREATE POLICY "Users read colleagues" ON users
  FOR SELECT USING (
    id = auth.uid()
    OR (company_id = get_user_company() AND get_user_role() IN ('rop', 'director', 'admin'))
    OR get_user_role() = 'admin'
  );

CREATE POLICY "Admin manages users" ON users
  FOR ALL USING (get_user_role() = 'admin');

-- Periods: read own company
CREATE POLICY "Users read periods" ON periods
  FOR SELECT USING (
    company_id = get_user_company()
    OR get_user_role() IN ('admin', 'director')
  );

CREATE POLICY "Admin manages periods" ON periods
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

-- Deals: manager sees own, rop/director sees company
CREATE POLICY "Manager reads own deals" ON deals
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin')
  );

CREATE POLICY "Manager manages own deals" ON deals
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Manager updates own deals" ON deals
  FOR UPDATE USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin')
  );

CREATE POLICY "Manager deletes own deals" ON deals
  FOR DELETE USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin')
  );

-- Meetings: same pattern as deals
CREATE POLICY "Manager reads own meetings" ON meetings
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin')
  );

CREATE POLICY "Manager manages own meetings" ON meetings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Manager updates own meetings" ON meetings
  FOR UPDATE USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin')
  );

-- Salary results: manager sees own, rop/director sees company
CREATE POLICY "Manager reads own salary" ON salary_results
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin')
  );

CREATE POLICY "System manages salary" ON salary_results
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

-- One-time payments: manager sees own, admin manages
CREATE POLICY "Manager reads own payments" ON one_time_payments
  FOR SELECT USING (
    user_id = auth.uid()
    OR get_user_role() IN ('rop', 'director', 'admin')
  );

CREATE POLICY "Admin manages payments" ON one_time_payments
  FOR ALL USING (get_user_role() IN ('admin', 'director', 'rop'));
