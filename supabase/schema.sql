-- Guess History Game: initial Supabase schema
-- Run this file in a new Supabase project's SQL editor.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.game_status as enum ('active', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.round_status as enum ('creating', 'active', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.question_status as enum ('pending', 'answered', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.answer_type as enum ('是', '不是', '不确定', '无关', '猜对了');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default 'main',
  title text not null default '猜历史人物',
  status public.game_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_slug_format check (slug ~ '^[a-z0-9-]{1,40}$')
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  client_id uuid not null,
  nickname text not null,
  emoji text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_nickname_length check (char_length(nickname) between 1 and 16),
  constraint players_emoji_length check (char_length(emoji) between 1 and 16),
  unique (game_id, client_id)
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  round_number integer not null,
  status public.round_status not null default 'creating',
  revealed_name text,
  total_questions integer not null default 0,
  next_order_num integer not null default 1,
  winner_player_id uuid references public.players(id) on delete set null,
  winner_nickname text,
  winner_emoji text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint rounds_positive_number check (round_number > 0),
  constraint rounds_nonnegative_total check (total_questions >= 0),
  constraint rounds_positive_next_order check (next_order_num > 0),
  constraint rounds_reveal_on_completion check (
    status <> 'completed' or (revealed_name is not null and completed_at is not null)
  ),
  unique (game_id, round_number)
);

-- Secrets are isolated from public round data. No anon/authenticated RLS policy
-- is created for this table; only the server-side service role may access it.
create table if not exists public.round_secrets (
  round_id uuid primary key references public.rounds(id) on delete cascade,
  character_name text not null,
  character_aliases text[] not null default '{}',
  character_summary text,
  created_at timestamptz not null default now(),
  constraint round_secrets_name_length check (char_length(character_name) between 1 and 80)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  client_request_id uuid not null,
  content text not null,
  status public.question_status not null default 'pending',
  answer public.answer_type,
  asked_by_nickname text not null,
  asked_by_emoji text not null,
  order_num integer not null,
  error_code text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint questions_content_length check (char_length(content) between 1 and 120),
  constraint questions_nickname_length check (char_length(asked_by_nickname) between 1 and 16),
  constraint questions_emoji_length check (char_length(asked_by_emoji) between 1 and 16),
  constraint questions_positive_order check (order_num > 0),
  constraint questions_answer_state check (
    (status = 'pending' and answer is null and answered_at is null)
    or (status = 'answered' and answer is not null and answered_at is not null)
    or (status = 'failed' and answer is null)
  ),
  unique (round_id, order_num),
  unique (round_id, client_request_id)
);

-- Public history and deduplication ledger. It contains revealed people only.
create table if not exists public.guessed_people (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null unique,
  display_name text not null,
  aliases text[] not null default '{}',
  first_round_id uuid references public.rounds(id) on delete set null,
  latest_round_id uuid references public.rounds(id) on delete set null,
  times_guessed integer not null default 1,
  first_guessed_at timestamptz not null default now(),
  last_guessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guessed_people_name_length check (
    char_length(normalized_name) between 1 and 80
    and char_length(display_name) between 1 and 80
  ),
  constraint guessed_people_positive_count check (times_guessed > 0)
);

-- One shared active/creating round per game.
create unique index if not exists rounds_one_open_round_per_game
  on public.rounds (game_id)
  where status in ('creating', 'active');

create index if not exists rounds_game_created_idx
  on public.rounds (game_id, created_at desc);

create index if not exists rounds_completed_idx
  on public.rounds (completed_at desc)
  where status = 'completed';

create index if not exists questions_round_order_idx
  on public.questions (round_id, order_num);

create index if not exists questions_round_status_idx
  on public.questions (round_id, status);

create index if not exists players_game_seen_idx
  on public.players (game_id, last_seen_at desc);

create index if not exists guessed_people_last_guessed_idx
  on public.guessed_people (last_guessed_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
before update on public.games
for each row execute function public.set_updated_at();

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists rounds_set_updated_at on public.rounds;
create trigger rounds_set_updated_at
before update on public.rounds
for each row execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

drop trigger if exists guessed_people_set_updated_at on public.guessed_people;
create trigger guessed_people_set_updated_at
before update on public.guessed_people
for each row execute function public.set_updated_at();

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.round_secrets enable row level security;
alter table public.questions enable row level security;
alter table public.guessed_people enable row level security;

-- Public clients may read shared game state. All writes go through Next.js
-- Route Handlers using the server-only service role key. The players table
-- remains server-only because client_id is a persistent browser identifier.
drop policy if exists "games are publicly readable" on public.games;
create policy "games are publicly readable"
  on public.games for select
  to anon, authenticated
  using (true);

drop policy if exists "rounds are publicly readable" on public.rounds;
create policy "rounds are publicly readable"
  on public.rounds for select
  to anon, authenticated
  using (true);

drop policy if exists "questions are publicly readable" on public.questions;
create policy "questions are publicly readable"
  on public.questions for select
  to anon, authenticated
  using (true);

drop policy if exists "guessed people are publicly readable" on public.guessed_people;
create policy "guessed people are publicly readable"
  on public.guessed_people for select
  to anon, authenticated
  using (true);

-- Realtime publishes only public shared state, never round_secrets.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rounds'
  ) then
    alter publication supabase_realtime add table public.rounds;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'questions'
  ) then
    alter publication supabase_realtime add table public.questions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'guessed_people'
  ) then
    alter publication supabase_realtime add table public.guessed_people;
  end if;
end $$;
