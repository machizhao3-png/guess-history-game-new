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

create or replace function public.start_round(
  p_game_slug text,
  p_character_name text,
  p_character_aliases text[] default '{}',
  p_character_summary text default null
)
returns public.rounds
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.games;
  v_round public.rounds;
  v_round_number integer;
begin
  if p_game_slug is null or p_game_slug !~ '^[a-z0-9-]{1,40}$' then
    raise exception using errcode = '22023', message = 'invalid_game_slug';
  end if;

  if p_character_name is null or char_length(trim(p_character_name)) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'invalid_character_name';
  end if;

  insert into public.games (slug)
  values (p_game_slug)
  on conflict (slug) do update
    set updated_at = now()
  returning * into v_game;

  perform pg_advisory_xact_lock(hashtext(v_game.id::text));

  select *
  into v_round
  from public.rounds
  where game_id = v_game.id
    and status in ('creating', 'active')
  order by created_at desc
  limit 1;

  if found then
    return v_round;
  end if;

  select coalesce(max(round_number), 0) + 1
  into v_round_number
  from public.rounds
  where game_id = v_game.id;

  insert into public.rounds (
    game_id,
    round_number,
    status,
    started_at
  )
  values (
    v_game.id,
    v_round_number,
    'active',
    now()
  )
  returning * into v_round;

  insert into public.round_secrets (
    round_id,
    character_name,
    character_aliases,
    character_summary
  )
  values (
    v_round.id,
    trim(p_character_name),
    coalesce(p_character_aliases, '{}'),
    p_character_summary
  );

  return v_round;
end;
$$;

create or replace function public.record_answered_question(
  p_round_id uuid,
  p_client_id uuid,
  p_client_request_id uuid,
  p_nickname text,
  p_emoji text,
  p_content text,
  p_answer public.answer_type
)
returns public.questions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_round public.rounds;
  v_secret public.round_secrets;
  v_player public.players;
  v_question public.questions;
  v_now timestamptz := now();
  v_normalized_name text;
begin
  if p_client_id is null or p_client_request_id is null then
    raise exception using errcode = '22023', message = 'missing_client_identifier';
  end if;

  if p_nickname is null or char_length(trim(p_nickname)) not between 1 and 16 then
    raise exception using errcode = '22023', message = 'invalid_nickname';
  end if;

  if p_emoji is null or char_length(trim(p_emoji)) not between 1 and 16 then
    raise exception using errcode = '22023', message = 'invalid_emoji';
  end if;

  if p_content is null or char_length(trim(p_content)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid_question';
  end if;

  select *
  into v_round
  from public.rounds
  where id = p_round_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'round_not_found';
  end if;

  select *
  into v_question
  from public.questions
  where round_id = p_round_id
    and client_request_id = p_client_request_id;

  if found then
    return v_question;
  end if;

  if v_round.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'round_not_active';
  end if;

  insert into public.players (
    game_id,
    client_id,
    nickname,
    emoji,
    last_seen_at
  )
  values (
    v_round.game_id,
    p_client_id,
    trim(p_nickname),
    trim(p_emoji),
    v_now
  )
  on conflict (game_id, client_id) do update
    set nickname = excluded.nickname,
        emoji = excluded.emoji,
        last_seen_at = excluded.last_seen_at
  returning * into v_player;

  insert into public.questions (
    round_id,
    player_id,
    client_request_id,
    content,
    status,
    answer,
    asked_by_nickname,
    asked_by_emoji,
    order_num,
    answered_at
  )
  values (
    p_round_id,
    v_player.id,
    p_client_request_id,
    trim(p_content),
    'answered',
    p_answer,
    v_player.nickname,
    v_player.emoji,
    v_round.next_order_num,
    v_now
  )
  returning * into v_question;

  update public.rounds
  set total_questions = total_questions + 1,
      next_order_num = next_order_num + 1
  where id = p_round_id;

  if p_answer = '猜对了' then
    select *
    into v_secret
    from public.round_secrets
    where round_id = p_round_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'round_secret_not_found';
    end if;

    update public.rounds
    set status = 'completed',
        revealed_name = v_secret.character_name,
        winner_player_id = v_player.id,
        winner_nickname = v_player.nickname,
        winner_emoji = v_player.emoji,
        completed_at = v_now
    where id = p_round_id;

    v_normalized_name := lower(regexp_replace(trim(v_secret.character_name), '\s+', '', 'g'));

    insert into public.guessed_people (
      normalized_name,
      display_name,
      aliases,
      first_round_id,
      latest_round_id,
      first_guessed_at,
      last_guessed_at
    )
    values (
      v_normalized_name,
      v_secret.character_name,
      v_secret.character_aliases,
      p_round_id,
      p_round_id,
      v_now,
      v_now
    )
    on conflict (normalized_name) do update
      set display_name = excluded.display_name,
          aliases = excluded.aliases,
          latest_round_id = excluded.latest_round_id,
          times_guessed = public.guessed_people.times_guessed + 1,
          last_guessed_at = excluded.last_guessed_at;
  end if;

  return v_question;
end;
$$;

revoke all on function public.start_round(text, text, text[], text) from public;
revoke all on function public.record_answered_question(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  public.answer_type
) from public;

grant execute on function public.start_round(text, text, text[], text) to service_role;
grant execute on function public.record_answered_question(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  public.answer_type
) to service_role;

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
