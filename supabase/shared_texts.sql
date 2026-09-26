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
