-- 010: the admin linking flow, with consent where it belongs.
--
-- The find-your-name picker is retired, so linking an account to a playing
-- record becomes a two-key turn: the CLUB assigns an invite (this table,
-- admin-only writes), and the MEMBER accepts it on their next visit — the
-- accept is what inserts the clubhouse_links row, consent stamped by the
-- person it belongs to. An admin can never consent on a member's behalf,
-- and a member only ever sees their own assigned record.
--
-- This migration also closes the open-claim hole the picker left behind:
-- the old `own link claim` policy let any member self-link to any claimable
-- roster player by direct API. Inserts now require a matching invite AND a
-- consent stamp.
--
-- Admin usage until the roster screen exists (one row per member):
--   insert into public.clubhouse_link_invite (email, player_id)
--   values ('member@example.com', '<roster player_id>');

create table if not exists public.clubhouse_link_invite (
  email text primary key,
  player_id text not null references public.clubhouse_roster (player_id),
  created_at timestamptz not null default now(),
  constraint invite_email_lowercase check (email = lower(email)),
  constraint invite_one_per_player unique (player_id)
);

alter table public.clubhouse_link_invite enable row level security;

-- A member sees only the invite addressed to them.
create policy invite_own_read on public.clubhouse_link_invite
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Accepting cleans up after itself.
create policy invite_own_delete on public.clubhouse_link_invite
  for delete to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- The club manages the queue.
create policy invite_admin_all on public.clubhouse_link_invite
  for all to authenticated
  using (public.is_engine_admin())
  with check (public.is_engine_admin());

-- Self-linking now requires the club's invite and the member's consent.
drop policy "own link claim" on public.clubhouse_links;

create policy links_insert_invited on public.clubhouse_links
  for insert to authenticated
  with check (
    auth.uid() = auth_user_id
    and consent_publication_at is not null
    and exists (
      select 1
      from public.clubhouse_link_invite i
      where i.player_id = clubhouse_links.player_id
        and i.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
