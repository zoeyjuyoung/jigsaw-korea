-- Supabase 프로젝트에서 SQL Editor 열고 전체 복사 → Run
-- (한 번만 실행하면 됩니다)

create table if not exists public.rooms (
  id text primary key,
  image_url text not null,
  image_w integer not null,
  image_h integer not null,
  cols integer not null,
  rows integer not null,
  created_at timestamptz not null default now()
);

-- 모든 사람이 방을 만들고 조회할 수 있도록 RLS 열어두기
alter table public.rooms enable row level security;

drop policy if exists "rooms are readable by anyone" on public.rooms;
create policy "rooms are readable by anyone"
  on public.rooms
  for select
  using (true);

drop policy if exists "rooms are insertable by anyone" on public.rooms;
create policy "rooms are insertable by anyone"
  on public.rooms
  for insert
  with check (true);

-- 이미지 저장용 Storage 버킷: 아래는 SQL 로 만들 수 없으므로 UI 에서 만들어 주세요.
-- 1. Storage → New bucket → name: puzzle-images, Public bucket 체크
-- 2. Policies → New policy → Templates "Allow access to public" 로 SELECT/INSERT 허용
