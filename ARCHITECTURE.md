# КО Salary — Архитектура системы

## Стек
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes (серверные компоненты)
- **БД**: Supabase (PostgreSQL) — бесплатный тариф
- **Авторизация**: Supabase Auth (email/password)
- **Хостинг**: Vercel (бесплатно)

## Роли пользователей

| Роль | Видит | Может |
|------|-------|-------|
| **Менеджер** | Свой ЗП файл, свои сделки, свои встречи | Вносить сделки, отмечать встречи |
| **РОП** | Свой отдел (все менеджеры), сводную по отделу | То же + корректировать данные менеджеров |
| **Комдир** | Все отделы, общую сводную | То же + управлять планами |
| **Админ** | Всё | Управлять пользователями, должностями, схемами мотивации |

## Схема базы данных

### companies (компании/юрлица)
```
id          UUID PK
name        TEXT         -- "ИННО", "БОНДА"
created_at  TIMESTAMPTZ
```

### positions (должности)
```
id          UUID PK
name        TEXT         -- "Младший менеджер ОП", "Менеджер ОП"
company_id  UUID FK → companies
created_at  TIMESTAMPTZ
```

### motivation_schemas (схемы мотивации — привязаны к должности)
```
id              UUID PK
position_id     UUID FK → positions
name            TEXT         -- "Схема менеджера ОП Q1 2026"
base_salary     INTEGER      -- базовый оклад
valid_from      DATE         -- действует с
valid_to        DATE NULL    -- действует до (NULL = текущая)
config          JSONB        -- гибкая конфигурация KPI, бонусов, формул
created_at      TIMESTAMPTZ
```

**config JSONB пример:**
```json
{
  "revenue_plan": 660000,
  "units_plan": 15,
  "meetings_plan": 25,
  "kpi_quality": {
    "enabled": true,
    "description": "Качественный KPI",
    "formula": "meetings_percent * coefficient",
    "coefficient": 15000
  },
  "kpi_quantity": {
    "enabled": true,
    "description": "Количественный KPI",
    "formula": "units_percent * coefficient",
    "coefficient": 10000
  },
  "margin_bonus": {
    "enabled": true,
    "description": "Маржа с оборудования",
    "percent": 0.094
  },
  "deductions": {
    "enabled": true,
    "description": "Депремирование"
  }
}
```

### users (пользователи)
```
id          UUID PK (= Supabase Auth ID)
email       TEXT UNIQUE
full_name   TEXT         -- "Субботин Иван"
role        ENUM         -- admin, director, rop, manager
company_id  UUID FK → companies
position_id UUID FK → positions NULL
is_active   BOOLEAN
created_at  TIMESTAMPTZ
```

### periods (расчётные периоды)
```
id          UUID PK
company_id  UUID FK → companies
year        INTEGER
month       INTEGER      -- 1-12
status      ENUM         -- draft, active, closed
created_at  TIMESTAMPTZ
UNIQUE(company_id, year, month)
```

### deals (сделки)
```
id              UUID PK
user_id         UUID FK → users       -- менеджер
period_id       UUID FK → periods
client_name     TEXT                   -- "Vaffel", "U Coffee"
revenue         DECIMAL               -- сумма выручки
mrr             DECIMAL               -- MRR
units           INTEGER               -- кол-во точек
status          ENUM                  -- prospect, waiting_payment, paid, cancelled
equipment_margin DECIMAL              -- маржа с оборудования
is_forecast     BOOLEAN DEFAULT false -- true = прогноз, false = факт
forecast_revenue DECIMAL NULL         -- прогнозируемая выручка (если отличается от факта)
forecast_close_date DATE NULL         -- ожидаемая дата закрытия
notes           TEXT NULL
amo_link        TEXT NULL              -- ссылка на AMO (опционально)
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### meetings (встречи — ежедневный трекинг)
```
id              UUID PK
user_id         UUID FK → users
period_id       UUID FK → periods
date            DATE
scheduled       INTEGER DEFAULT 0     -- назначено на утро
new_completed   INTEGER DEFAULT 0     -- проведено новых
repeat_completed INTEGER DEFAULT 0    -- проведено повторных
mentor          INTEGER DEFAULT 0     -- как менторы
next_day        INTEGER DEFAULT 0     -- назначено на завтра
rescheduled     INTEGER DEFAULT 0     -- перенесено
created_at      TIMESTAMPTZ
UNIQUE(user_id, date)
```

### salary_results (рассчитанные ЗП)
```
id              UUID PK
user_id         UUID FK → users
period_id       UUID FK → periods
base_salary     DECIMAL               -- оклад
kpi_quality     DECIMAL               -- качественный KPI
kpi_quantity    DECIMAL               -- количественный KPI
margin_bonus    DECIMAL               -- маржа с оборудования
extra_bonus     DECIMAL               -- доп бонус
deduction       DECIMAL               -- депремирование
total           DECIMAL               -- итого
breakdown       JSONB                 -- детальная расшифровка расчёта
calculated_at   TIMESTAMPTZ
UNIQUE(user_id, period_id)
```

### one_time_payments (разовые выплаты/вычеты)
```
id          UUID PK
user_id     UUID FK → users
period_id   UUID FK → periods
amount      DECIMAL
type        ENUM         -- bonus, deduction
description TEXT
created_at  TIMESTAMPTZ
```

## Страницы

### Менеджер
- `/dashboard` — мой прогресс: план/факт выручка, KPI, встречи, **прогноз ЗП в реальном времени**
- `/deals` — мои сделки (CRUD), разделение на **факт** (оплачено) и **прогноз** (ждём оплату, в работе)
- `/meetings` — трекинг встреч по дням (календарная сетка)
- `/salary` — мой расчётный лист (текущий + история)
- `/forecast` — прогноз: сколько заработаю если закрою сделки X, Y, Z

### РОП / Комдир
- `/team` — сводная по менеджерам (как текущая сводная таблица КО)
- `/team/[id]` — детали по конкретному менеджеру
- `/reports` — аналитика, графики, сравнения

### Админ
- `/admin/users` — управление пользователями
- `/admin/positions` — должности и схемы мотивации
- `/admin/periods` — расчётные периоды (открыть/закрыть месяц)
- `/admin/companies` — юрлица

## Расчёт ЗП (серверная функция)

```
total = base_salary
      + kpi_quality(meetings, schema)
      + kpi_quantity(units, schema)
      + margin_bonus(equipment_margin, schema)
      + extra_bonus
      + one_time_bonuses
      - deduction
      - one_time_deductions
```

Расчёт запускается автоматически при изменении сделок/встреч (realtime)
или вручную по кнопке "Пересчитать".

## Экспорт
- Расчётный лист менеджера → PDF
- Сводная таблица → XLSX
- Формат максимально приближен к текущим Google Sheets файлам
