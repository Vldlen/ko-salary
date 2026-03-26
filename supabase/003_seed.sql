-- Seed data — начальное наполнение из текущих Google Sheets

-- Компании
INSERT INTO companies (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ИННО'),
  ('22222222-2222-2222-2222-222222222222', 'БОНДА');

-- Должности
INSERT INTO positions (id, name, company_id) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'Менеджер отдела продаж', '11111111-1111-1111-1111-111111111111'),
  ('aaaa0002-0000-0000-0000-000000000002', 'Младший менеджер отдела продаж', '11111111-1111-1111-1111-111111111111'),
  ('aaaa0003-0000-0000-0000-000000000003', 'Менеджер отдела продаж', '22222222-2222-2222-2222-222222222222'),
  ('aaaa0004-0000-0000-0000-000000000004', 'Младший менеджер отдела продаж', '22222222-2222-2222-2222-222222222222');

-- Схемы мотивации ИННО — Менеджер ОП
INSERT INTO motivation_schemas (position_id, name, base_salary, valid_from, config) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'Менеджер ОП ИННО — 2026', 80000, '2026-01-01', '{
    "revenue_plan": 660000,
    "units_plan": 15,
    "meetings_plan": 25,
    "kpi_quality": {
      "enabled": true,
      "description": "Качественный KPI (встречи)",
      "max_amount": 15000
    },
    "kpi_quantity": {
      "enabled": true,
      "description": "Количественный KPI (штуки)",
      "max_amount": 10000
    },
    "margin_bonus": {
      "enabled": true,
      "description": "Маржа с оборудования",
      "percent": 0.094
    }
  }');

-- Схемы мотивации ИННО — Младший менеджер ОП
INSERT INTO motivation_schemas (position_id, name, base_salary, valid_from, config) VALUES
  ('aaaa0002-0000-0000-0000-000000000002', 'Младший менеджер ОП ИННО — 2026', 70000, '2026-01-01', '{
    "revenue_plan": 100000,
    "units_plan": 5,
    "meetings_plan": 15,
    "kpi_quality": {
      "enabled": true,
      "description": "Качественный KPI (встречи)",
      "max_amount": 10000
    },
    "kpi_quantity": {
      "enabled": true,
      "description": "Количественный KPI (штуки)",
      "max_amount": 5000
    },
    "margin_bonus": {
      "enabled": true,
      "description": "Маржа с оборудования",
      "percent": 0.091
    }
  }');

-- Схемы мотивации БОНДА — Менеджер ОП
INSERT INTO motivation_schemas (position_id, name, base_salary, valid_from, config) VALUES
  ('aaaa0003-0000-0000-0000-000000000003', 'Менеджер ОП БОНДА — 2026', 80000, '2026-01-01', '{
    "revenue_plan": 500000,
    "units_plan": 5,
    "meetings_plan": 25,
    "kpi_quality": {
      "enabled": true,
      "description": "Качественный KPI (встречи)",
      "max_amount": 15000
    },
    "kpi_quantity": {
      "enabled": true,
      "description": "Количественный KPI (штуки)",
      "max_amount": 10000
    },
    "margin_bonus": {
      "enabled": false,
      "description": "Маржа с оборудования",
      "percent": 0
    }
  }');

-- Текущий период — Март 2026
INSERT INTO periods (id, company_id, year, month, status) VALUES
  ('bbbb0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 2026, 3, 'active'),
  ('bbbb0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 2026, 3, 'active');
