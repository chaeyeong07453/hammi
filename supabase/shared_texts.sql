-- 긴글연습 '함께 보는 글' 저장소 (이미 적용됨, 기록용)
create table if not exists public.shared_texts (
  id bigint generated always as identity primary key,
  title text not null,
  author text not null default '',
  body text not null,
  writer text not null default '',
  pin text not null default '',
  created_at timestamptz not null default now()
);
alter table public.shared_texts enable row level security;
create policy "anyone can read" on public.shared_texts for select using (true);
create policy "anyone can insert" on public.shared_texts for insert with check (char_length(title) between 1 and 60 and char_length(body) between 1 and 5000);
create or replace function public.delete_shared_text(p_id bigint, p_pin text) returns boolean language sql security definer as $$
  delete from public.shared_texts where id = p_id and pin = p_pin returning true;
$$;

-- ===== v2: 내가 올린 글 고치기/지우기 (계정 또는 비밀번호) =====
-- Supabase SQL Editor에 이 v2 구간을 붙여 넣고 Run.
alter table public.shared_texts add column if not exists owner text not null default '';

-- 권한 확인: 비밀번호가 맞거나, 올린 계정 본인(토큰 확인)이면 true
create or replace function public.shared_text_can(p_id bigint, p_pin text, p_owner text, p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.shared_texts; ok boolean := false;
begin
  select * into r from public.shared_texts where id = p_id;
  if not found then return false; end if;
  if coalesce(p_pin, '') <> '' and r.pin = p_pin then return true; end if;
  if coalesce(p_owner, '') <> '' and r.owner = p_owner and to_regclass('public.accounts') is not null then
    execute 'select exists(select 1 from public.accounts where id = $1 and token = $2)' into ok using p_owner, coalesce(p_token, '');
  end if;
  return ok;
end $$;

create or replace function public.shared_text_update(p_id bigint, p_pin text, p_owner text, p_token text, p_title text, p_author text, p_body text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(p_title, '')) not between 1 and 60 or char_length(coalesce(p_body, '')) not between 1 and 5000 then return false; end if;
  if not public.shared_text_can(p_id, p_pin, p_owner, p_token) then return false; end if;
  update public.shared_texts set title = p_title, author = coalesce(p_author, ''), body = p_body where id = p_id;
  return true;
end $$;

create or replace function public.shared_text_delete(p_id bigint, p_pin text, p_owner text, p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.shared_text_can(p_id, p_pin, p_owner, p_token) then return false; end if;
  delete from public.shared_texts where id = p_id;
  return true;
end $$;

revoke execute on function public.shared_text_can(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.shared_text_update(bigint, text, text, text, text, text, text), public.shared_text_delete(bigint, text, text, text) to anon, authenticated;
