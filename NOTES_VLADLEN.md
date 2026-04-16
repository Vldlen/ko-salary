# ko-salary — заметки для продолжения (сохранено 2026-04-15)

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
