-- ============================================================================
-- منصة الملاحظات والمتابعة — مخطط Supabase الكامل
-- ----------------------------------------------------------------------------
-- طريقة التنفيذ:
--   1) افتح مشروعك في https://supabase.com/dashboard
--   2) من القائمة الجانبية: SQL Editor ← New query
--   3) الصق هذا الملف كاملًا ثم اضغط Run
--
-- ملاحظات أمنية:
--   • المتصفح يستخدم anon / publishable key فقط.
--   • لا تضع service_role أو sb_secret_... في أي ملف يُرفع للموقع.
--   • الحماية الفعلية تأتي من سياسات RLS أدناه.
--   • هذا المخطط يمنح كل مستخدم مسجّل (authenticated) وصولًا لملاحظات
--     الفريق بالكامل (قراءة/إضافة/تعديل/حذف) — وهو المطلوب لمنصة متابعة
--     جماعية. أوقف التسجيل العام من إعدادات Auth بعد إنشاء حسابات الفريق.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1) جدول الملاحظات — ملاحظات فريق واحد
-- ============================================================================
create table if not exists public.notes (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text not null default '',
  domain            text not null,
  priority          text not null default 'متوسطة',
  status            text not null default 'جديدة',
  recommendation    text not null default '',
  corrective_action text not null default '',
  owner_name        text not null default '',
  target_date       date,
  created_by        uuid default auth.uid()
                    references auth.users(id) on delete set null,
  created_by_name   text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  closed_at         timestamptz,

  constraint notes_title_len
    check (char_length(title) between 1 and 160),
  constraint notes_description_len
    check (char_length(description) <= 5000),
  constraint notes_recommendation_len
    check (char_length(recommendation) <= 4000),
  constraint notes_corrective_len
    check (char_length(corrective_action) <= 4000),
  constraint notes_owner_len
    check (char_length(owner_name) <= 120),
  constraint notes_created_by_name_len
    check (char_length(created_by_name) <= 120),
  constraint notes_domain_allowed
    check (domain in (
      'الشؤون الأكاديمية',
      'السلوك والمواظبة',
      'الشؤون الإدارية',
      'التقنية والدعم',
      'الأنشطة الطلابية',
      'الأمن والسلامة',
      'الشراكة المجتمعية',
      'أخرى'
    )),
  constraint notes_priority_allowed
    check (priority in ('منخفضة', 'متوسطة', 'عالية', 'حرجة')),
  constraint notes_status_allowed
    check (status in ('جديدة', 'قيد المعالجة', 'مغلقة'))
);

comment on table public.notes is
  'ملاحظات المتابعة والإجراءات التصحيحية لفريق واحد. الوصول محمي بـ RLS للمستخدمين المسجلين.';
comment on column public.notes.created_by is
  'معرّف منشئ الملاحظة من Supabase Auth. يبقى ثابتًا بعد الإنشاء.';
comment on column public.notes.created_by_name is
  'اسم منشئ الملاحظة وقت الإنشاء (يُثبّت ولا يتغير بتغير الملف الشخصي).';
comment on column public.notes.closed_at is
  'وقت الإغلاق، يُضبط تلقائيًا عند الانتقال إلى حالة «مغلقة» ويُمسح عند إعادة الفتح.';

-- فهارس تسريع البحث والترتيب
create index if not exists notes_status_idx      on public.notes (status);
create index if not exists notes_priority_idx    on public.notes (priority);
create index if not exists notes_domain_idx      on public.notes (domain);
create index if not exists notes_target_date_idx on public.notes (target_date);
create index if not exists notes_updated_idx     on public.notes (updated_at desc);
create index if not exists notes_created_by_idx  on public.notes (created_by);

-- ============================================================================
-- 2) ضبط updated_at و closed_at وحماية حقول الإنشاء
-- ============================================================================
create or replace function public.notes_before_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- حقول الإنشاء غير قابلة للتعديل من المتصفح
    new.created_at      := old.created_at;
    new.created_by      := old.created_by;
    new.created_by_name := old.created_by_name;
    new.updated_at      := now();

    if new.status = 'مغلقة' then
      if old.status is distinct from 'مغلقة' then
        new.closed_at := now();
      else
        new.closed_at := coalesce(old.closed_at, now());
      end if;
    else
      new.closed_at := null;
    end if;
  else
    new.created_by    := coalesce(new.created_by, auth.uid());
    new.created_at    := coalesce(new.created_at, now());
    new.updated_at    := now();
    if new.status = 'مغلقة' then
      new.closed_at := coalesce(new.closed_at, now());
    else
      new.closed_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notes_before_write on public.notes;
create trigger notes_before_write
  before insert or update on public.notes
  for each row execute function public.notes_before_write();

-- ============================================================================
-- 3) تفعيل الحماية على مستوى الصفوف (RLS)
-- ============================================================================
alter table public.notes enable row level security;

-- كل مستخدم مسجّل يرى ملاحظات الفريق كاملة
drop policy if exists "notes_select_team" on public.notes;
create policy "notes_select_team"
  on public.notes for select
  to authenticated
  using (true);

-- الإضافة: المنشئ يجب أن يكون المستخدم الحالي
drop policy if exists "notes_insert_team" on public.notes;
create policy "notes_insert_team"
  on public.notes for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
  );

-- التعديل: أعضاء الفريق يعدّلون الملاحظات المشتركة
drop policy if exists "notes_update_team" on public.notes;
create policy "notes_update_team"
  on public.notes for update
  to authenticated
  using (true)
  with check (true);

-- الحذف: أعضاء الفريق يملكون حذف الملاحظات المشتركة
drop policy if exists "notes_delete_team" on public.notes;
create policy "notes_delete_team"
  on public.notes for delete
  to authenticated
  using (true);

-- ============================================================================
-- 4) الصلاحيات: الزائر (anon) ممنوع، والمستخدم المسجّل فقط
-- ============================================================================
revoke all on table public.notes from public;
revoke all on table public.notes from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.notes to authenticated;

-- ============================================================================
-- 5) تفعيل التحديث المباشر (Realtime) — اختياري لكنه مفيد للفريق
-- ============================================================================
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
exception
  when undefined_object then null;
  when insufficient_privilege then null;
  when duplicate_object then null;
end;
$$;

-- إعادة تحميل مخطط PostgREST ليظهر الجدول فورًا
notify pgrst, 'reload schema';

-- ============================================================================
-- 6) تحقق سريع (اختياري) — نفّذه بعد تسجيل الدخول من المنصة
-- ----------------------------------------------------------------------------
-- select * from public.notes order by updated_at desc;
-- insert into public.notes (title, description, domain, priority, status)
-- values ('اختبار', 'ملاحظة تجريبية', 'أخرى', 'متوسطة', 'جديدة');
-- update public.notes set status = 'مغلقة' where id = '<NOTE_ID>';
-- delete from public.notes where id = '<NOTE_ID>';
-- ============================================================================
