# ko-salary — заметки для продолжения (обновлено 2026-04-22)

## Аудит — текущий статус

Все 12 пунктов обработаны. Резюме по каждому ниже.

### ✅ #1 Утечка в /api/admin/managers — не-баг
РОП/комдир/фаундер видят обе команды умышленно (бизнес-требование).

### ✅ #2 Race condition в частичной оплате
Фикс: миграция `012_record_payment_rpc.sql` — RPC `record_partial_payment` лочит строку (`SELECT FOR UPDATE`), считает итоговый статус на сервере, атомарно обновляет все поля. `deals/page.tsx` теперь вызывает эту RPC вместо клиентского UPDATE.

### ✅ #3 Определение БОНДА/ИННО по имени
Фикс: миграция `011_company_type.sql` — добавлен enum `company_type` (`'inno' | 'bonda'`) + колонка `companies.company_type` + backfill по текущим именам. Хелперы `isBondaCompany(company)` / `isInnoCompany(company)` в `lib/utils.ts` (с fallback на имя для переходного периода). Все 8+ сайтов с `.includes('БОНД')` переписаны.

### ✅ #4 Типизация deals/page.tsx
State и хендлеры типизированы: `User | null`, `Period | null`, `Deal[]`, `Deal | null`. `tsc --noEmit` проходит.

### ✅ #5 Валидация формы сделки
В `deals/page.tsx` добавлена функция `validateForm()` — проверяет client_name, revenue ≥ 0, units ≥ 0, MRR ≥ 0, цены оборудования ≥ 0, ссылка AMO http(s). Ошибка показывается в форме до сабмита.

### ✅ #6 Деление на ноль в salary-calculator
Все ответвления `> 0 ? x/y : 0` уже были защищены. Дополнительно — coerce `revenuePlan/unitsPlan/meetingsPlan` к числу через `Number(... ?? 0) || 0`, чтобы undefined из config не просочился.

### ✅ #7 Рассинхрон partial ИННО/БОНДА
Решается одновременно с #2 — вся логика определения статуса `paid/partial/waiting_payment/no_invoice` теперь внутри RPC `record_partial_payment`, единая точка правды.

### ✅ #8 Индекс motivation_schemas
Миграция `011_company_type.sql` заодно добавила индексы:
- `idx_motivation_schemas_position_valid(position_id, valid_from, valid_to)`
- `idx_deals_period_user_status(period_id, user_id, status)`
- `idx_deals_paid_at(paid_at) WHERE paid_at IS NOT NULL`
- `idx_meetings_period_user(period_id, user_id)`

### ✅ #9 console.error с чувствительной инфой
Введён `lib/logger.ts` — в проде срезает stack traces и redact'ит поля `password/token/secret/authorization/cookie`. В dev и при `window.__KO_DEBUG__ = true` — полный вывод для отладки. Клиентские страницы (deals/meetings/salary/team/dashboard/forecast/view-as-context) переведены на `logger.error`.

### ✅ #10 RLS-гард viewAs для РОПа — не-баг
Аудит подтвердил: RLS разрешает rop/director/admin/founder **только read** кросс-компанийно (миграция 010). Write для `rop` ограничен — UI-кнопки редактирования дополнительно гейтятся `user.role === 'manager' && !isViewingAs`. Документация добавлена в `lib/view-as-context.tsx`.

### ✅ #11 Ошибки загрузки не показываются юзеру
Добавлены `toast(..., 'error')` для load-ошибок на страницах deals, dashboard. Alert'ы на CRUD-операциях заменены на toast. Toast-система уже была в `components/Toast.tsx`, просто не использовалась широко.

### ✅ #12 Хардкод-дефолты в schema.config
`DEFAULT_PUSH_PERCENTS` и `DEFAULT_THRESHOLD_TIERS` в salary-calculator остались (иначе расчёт сломается для schema без конфига), но при использовании дефолта теперь пишется `logger.warn` с ID схемы — админ увидит и поправит должность.

## Что нужно применить в проде

1. Миграция `010_director_visibility_fix.sql` — **УЖЕ ПРИМЕНЕНА** (2026-04-22).
2. Миграция `011_company_type.sql` — ⚠️ **НУЖНО ПРИМЕНИТЬ** (добавляет company_type + backfill + индексы).
3. Миграция `012_record_payment_rpc.sql` — ⚠️ **НУЖНО ПРИМЕНИТЬ** (RPC для частичной оплаты).

**Важно:** миграция 011 должна пойти **до** 012 (12 использует enum company_type).

После применения 011 — зайти в Supabase Dashboard → SQL Editor:
```sql
SELECT name, company_type FROM companies;
```
и убедиться что все юрлица получили тип. Если какой-то NULL — задать руками.

## Чек-лист проверки после деплоя

- [ ] `/team` у комдира показывает обе команды, счётчики > 0
- [ ] `/team` у РОПа — то же
- [ ] Менеджер видит только свои сделки/встречи
- [ ] Создание сделки с revenue=-100 → ошибка валидации, а не запись
- [ ] Частичная оплата: два клиента открывают popup → только один записывает, статус корректный
- [ ] В F12 консоли нет `[ko-salary] schema.config.push_bonus_percents не задан` (иначе — поправить должность)

---

## Старые заметки (для истории, до 22.04.2026)

## Статус аудита
Прошли по списку улучшений из первичного аудита.
- **#1 (утечка данных в /api/admin/managers)** — закрыто как не-баг. По бизнес-логике РОП/комдир/фаундер умышленно видят обе команды. Напоминание: если появится третья команда, к которой доступ не должен быть всем — нужен явный флаг видимости.

## Текущий активный вопрос: «Команды иногда не видны комдиру и фаундеру»

### Симптом
На странице /team у комдира (и в какой-то момент у переведённого в фаундеры) показывается "Нет сотрудников", все счётчики = 0. Возникает периодически.

### Root cause
В `supabase/006_founder_rls.sql` политика `"Users read colleagues"` на таблице `users`:
```sql
FOR SELECT USING (
  id = auth.uid()
  OR (company_id = get_user_company() AND get_user_role() IN ('rop', 'director', 'admin'))
  OR get_user_role() IN ('admin', 'founder')
)
```

**Комдир попадает только в среднюю ветку → видит только пользователей СВОЕЙ компании.** Фаундер — в третью ветку → видит всех. Когда Владлен временно переводил комдира в фаундеры — работало. Возвращал в комдиры — ломалось.

### Сопутствующие проблемы (миграционный дрейф)
1. В `001_schema.sql`: `CREATE TYPE user_role AS ENUM ('admin', 'director', 'rop', 'manager')` — **нет 'founder'**. В `src/types/database.ts` и в RLS `006_founder_rls.sql` уже используется 'founder'. Вывод: enum расширили в проде вручную через Supabase Dashboard (`ALTER TYPE user_role ADD VALUE 'founder'`), но в миграции не добавили.
2. Две миграции с префиксом `006`:
   - `006_founder_rls.sql` — RLS политики
   - `006_paid_at.sql` — только добавляет колонку paid_at в deals (политики не трогает, конфликта нет)
3. `get_user_role()` / `get_user_company()` в `002_rls.sql` без `SET search_path = public` — рекомендованная практика Supabase, сейчас отсутствует.

### Гипотеза про периодичность у фаундера
Если enum в проде был расширен вручную и при каком-то восстановлении/миграции схлопнулся — `role` становится битым, `get_user_role()` → NULL → все RLS отваливаются → "Нет сотрудников". После повторного `ALTER TYPE` оживает.

## План фикса (ДОЖДАТЬСЯ ОТВЕТОВ ВЛАДЛЕНА перед реализацией!)

Одной миграцией `010_director_visibility_fix.sql`:
1. `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'founder'` — синхронизировать с продом.
2. Переписать политики на **всех таблицах** чтобы `director` вёл себя как founder (видит всё кросс-компанийно). Таблицы: `users`, `deals`, `meetings`, `periods`, `companies`, `positions`, `motivation_schemas`, `salary_results`, `one_time_payments`, `individual_plans`, `kpi_entries`, `kpi_approvals`.
3. Добавить `SET search_path = public` в helper-функции.
4. (Опционально) Политика users с фильтром `is_active=true AND fired_at IS NULL AND deleted_at IS NULL` — чтобы уволенные не светились.

## Вопросы Владлену на завтра

**A.** Хочешь чтобы `director` видел всё кросс-компанийно **read-only**, или также мог редактировать? В `002_rls.sql` уже есть `FOR ALL ... USING (get_user_role() IN ('admin', 'director'))` — то есть редактирующие права у директора уже есть, нужно убедиться, что новая миграция их не урезает.

**B.** Есть ли в проде пользователи с "неизвестной" / битой ролью, которых надо почистить отдельным шагом?

## Остальные пункты аудита (ещё не обсуждались, очередь)

2. Race condition в частичной оплате — `src/app/deals/page.tsx:269-310`, неатомарный update 6 полей + статус. Нужно server action с транзакцией.
3. БОНДА/ИННО определяется через `name.toUpperCase().includes('БОНД')` — хрупко. Нужна колонка `company_type`.
4. `any[]` по всему `deals/page.tsx` — нет типизации Deal[].
5. Нет валидации формы сделки — можно сохранить revenue=-100, пустой client_name.
6. Деление на ноль в `salary-calculator.ts:127-128` когда plan=0.
7. Рассинхрон логики partial для ИННО/БОНДА — статус `paid` может не выставиться.
8. Нет индекса `motivation_schemas(valid_from, valid_to)`.
9. `console.error` с возможной чувствительной инфой в проде.
10. Нет RLS-гарда при `viewAs` для РОПа из другой компании.
11. Ошибки загрузки не показываются пользователю.
12. Fallback на хардкод-дефолты в schema.config.

## Инфраструктура
- Проект: ko-salary = «Пульс КО» = «Пульс ком. отдела» (переименованное фронтовое название)
- Стек: Next.js 14 App Router + Supabase + Tailwind + Vercel
- Прод URL: (неизвестен, уточнить)
- Ветка: main
- Uncommitted: `src/app/deals/page.tsx` — замена `equipment_margin` → `equipment_sell_price`
