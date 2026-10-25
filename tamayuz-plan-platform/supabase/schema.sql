-- ============================================================
-- منصة تفريغ خطة التحسين في منصة تميز
-- مخطط Supabase الكامل: حفظ الخطة + الملاحظات + الحماية RLS
-- نفّذ هذا الملف كاملًا في: Supabase Dashboard ← SQL Editor
-- ============================================================
-- ملاحظات أمنية مهمة:
-- 1) هذا المخطط يفترض أن المستخدمين يسجّلون الدخول عبر Supabase Auth
--    (Email + Password).
-- 2) لا تضع service_role أو أي مفتاح سري في ملف HTML أو في المتصفح.
--    المتصفح يستخدم anon/publishable key فقط، والحماية تأتي من RLS.
-- 3) كل صف مرتبط بـ auth.uid()، ولا يستطيع مستخدم قراءة أو تعديل صفوف غيره.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1) جدول مساحة العمل: صف واحد لكل مستخدم، ويحتوي حالة المنصة كـ JSONB
-- ============================================================
create table if not exists public.tamayuz_workspaces (
  user_id     uuid primary key default auth.uid()
              references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tamayuz_workspaces_data_object
    check (jsonb_typeof(data) = 'object')
);

comment on table public.tamayuz_workspaces is
  'حالة منصة تميز المحفوظة سحابيًا، صف واحد لكل مستخدم. الحماية عبر RLS.';
comment on column public.tamayuz_workspaces.user_id is
  'معرّف مستخدم Supabase Auth؛ لا يمكن الوصول لصف مستخدم آخر.';
comment on column public.tamayuz_workspaces.data is
  'حالة المنصة: الإعدادات، المعايير، الخطط، الإقرار، وغيرها بصيغة JSON.';

-- ============================================================
-- 2) جدول الملاحظات: ملاحظات شخصية لكل مستخدم
-- ============================================================
create table if not exists public.tamayuz_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users(id) on delete cascade,
  title       text not null default 'ملاحظة',
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tamayuz_notes_title_len
    check (char_length(title) between 1 and 120),
  constraint tamayuz_notes_body_len
    check (char_length(body) between 1 and 10000)
);

comment on table public.tamayuz_notes is
  'ملاحظات المستخدم الشخصية. كل ملاحظة مرتبطة بمستخدم واحد وتحميها RLS.';

-- فهارس مفيدة للجلب والترتيب
create index if not exists tamayuz_notes_user_updated_idx
  on public.tamayuz_notes (user_id, updated_at desc);

create index if not exists tamayuz_notes_user_created_idx
  on public.tamayuz_notes (user_id, created_at desc);

-- ============================================================
-- 3) تحديث updated_at تلقائيًا
-- ============================================================
create or replace function public.tamayuz_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tamayuz_workspaces_touch_updated_at
  on public.tamayuz_workspaces;
create trigger tamayuz_workspaces_touch_updated_at
  before update on public.tamayuz_workspaces
  for each row execute function public.tamayuz_touch_updated_at();

drop trigger if exists tamayuz_notes_touch_updated_at
  on public.tamayuz_notes;
create trigger tamayuz_notes_touch_updated_at
  before update on public.tamayuz_notes
  for each row execute function public.tamayuz_touch_updated_at();

-- ============================================================
-- 4) تفعيل RLS
-- ============================================================
alter table public.tamayuz_workspaces enable row level security;
alter table public.tamayuz_notes enable row level security;

-- ============================================================
-- 5) سياسات مساحة العمل: كل مستخدم يرى ويعدّل صفه فقط
-- ============================================================
drop policy if exists "workspaces_select_own" on public.tamayuz_workspaces;
create policy "workspaces_select_own"
  on public.tamayuz_workspaces
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "workspaces_insert_own" on public.tamayuz_workspaces;
create policy "workspaces_insert_own"
  on public.tamayuz_workspaces
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "workspaces_update_own" on public.tamayuz_workspaces;
create policy "workspaces_update_own"
  on public.tamayuz_workspaces
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "workspaces_delete_own" on public.tamayuz_workspaces;
create policy "workspaces_delete_own"
  on public.tamayuz_workspaces
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- 6) سياسات الملاحظات: منع أي وصول لملاحظات مستخدم آخر
-- ============================================================
drop policy if exists "notes_select_own" on public.tamayuz_notes;
create policy "notes_select_own"
  on public.tamayuz_notes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "notes_insert_own" on public.tamayuz_notes;
create policy "notes_insert_own"
  on public.tamayuz_notes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "notes_update_own" on public.tamayuz_notes;
create policy "notes_update_own"
  on public.tamayuz_notes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "notes_delete_own" on public.tamayuz_notes;
create policy "notes_delete_own"
  on public.tamayuz_notes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- 7) الصلاحيات: anon ممنوع، authenticated فقط
-- ============================================================
revoke all on table public.tamayuz_workspaces from public;
revoke all on table public.tamayuz_workspaces from anon;
revoke all on table public.tamayuz_notes from public;
revoke all on table public.tamayuz_notes from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.tamayuz_workspaces to authenticated;
grant select, insert, update, delete on table public.tamayuz_notes to authenticated;

-- إعادة تحميل مخطط PostgREST حتى تظهر الجداول فورًا
notify pgrst, 'reload schema';

-- ============================================================
-- 8) اختبار سريع بعد تسجيل الدخول من التطبيق
-- ============================================================
-- استبدل <USER_ID> بمعرّف المستخدم من Authentication ← Users
-- ثم نفّذ الاستعلامات التالية للتأكد من عمل RLS:
--
-- select * from public.tamayuz_notes where user_id = auth.uid();
-- insert into public.tamayuz_notes (title, body)
--   values ('اختبار', 'ملاحظة تجريبية') returning *;
-- update public.tamayuz_notes set body = 'تعديل' where id = '<NOTE_ID>';
-- delete from public.tamayuz_notes where id = '<NOTE_ID>';
--
-- محاولة قراءة صف مستخدم آخر يجب أن تعيد صفرًا أو ترفض:
-- select * from public.tamayuz_notes where user_id <> auth.uid();
