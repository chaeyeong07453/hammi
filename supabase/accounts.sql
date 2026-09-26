-- 함미합삐 타자연습: 어디서나 로그인되는 계정
-- Supabase SQL Editor에 붙여 넣고 Run. (비밀번호는 bcrypt 해시로만 저장, 표는 함수로만 접근)
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.accounts (
  id text primary key,
  pin text not null,
  token text not null,
  rec jsonb not null default '{}'::jsonb,
  count int not null default 0,
  created_at timestamptz not null default now(),
  last timestamptz not null default now()
);
alter table public.accounts enable row level security;
-- 정책 없음: anon 키로는 표를 직접 읽거나 쓸 수 없고 아래 함수만 쓸 수 있음

create or replace function public.account_signup(p_id text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r public.accounts; v_id text := trim(p_id);
begin
  if v_id is null or char_length(v_id) < 1 or char_length(v_id) > 10 then return jsonb_build_object('error', 'name'); end if;
  if p_pin !~ '^[0-9]{4}$' then return jsonb_build_object('error', 'pin'); end if;
  if exists (select 1 from public.accounts where id = v_id) then return jsonb_build_object('error', 'exists'); end if;
  insert into public.accounts (id, pin, token) values (v_id, crypt(p_pin, gen_salt('bf')), encode(gen_random_bytes(18), 'hex')) returning * into r;
  return jsonb_build_object('id', r.id, 'token', r.token, 'rec', r.rec, 'count', r.count);
end $$;

create or replace function public.account_login(p_id text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r public.accounts;
begin
  select * into r from public.accounts where id = trim(p_id);
  if not found then return jsonb_build_object('error', 'nouser'); end if;
  if r.pin <> crypt(p_pin, r.pin) then perform pg_sleep(0.5); return jsonb_build_object('error', 'pin'); end if;
  update public.accounts set last = now() where id = r.id;
  return jsonb_build_object('id', r.id, 'token', r.token, 'rec', r.rec, 'count', r.count);
end $$;

create or replace function public.account_refresh(p_id text, p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r public.accounts;
begin
  select * into r from public.accounts where id = p_id and token = p_token;
  if not found then return jsonb_build_object('error', 'token'); end if;
  return jsonb_build_object('id', r.id, 'rec', r.rec, 'count', r.count);
end $$;

create or replace function public.account_save(p_id text, p_token text, p_rec jsonb, p_count int)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r public.accounts;
begin
  select * into r from public.accounts where id = p_id and token = p_token;
  if not found then return jsonb_build_object('error', 'token'); end if;
  update public.accounts set rec = coalesce(p_rec, '{}'::jsonb), count = greatest(coalesce(p_count, 0), r.count), last = now() where id = r.id returning * into r;
  return jsonb_build_object('id', r.id, 'rec', r.rec, 'count', r.count);
end $$;

create or replace function public.account_ranking()
returns table (id text, rec jsonb, count int) language sql security definer set search_path = public as $$
  select id, rec, count from public.accounts order by last desc limit 500
$$;

grant execute on function public.account_signup(text, text), public.account_login(text, text), public.account_refresh(text, text), public.account_save(text, text, jsonb, int), public.account_ranking() to anon, authenticated;
