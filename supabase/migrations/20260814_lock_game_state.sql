-- Close game_state.
--
-- APPLY THIS ONLY AFTER the AdminGate build is live and an admin has signed
-- in successfully at /manage. Until then the permissive policies must stay,
-- or the court manager cannot read its own session.
--
-- The exposure being closed is not primarily privacy. game_state was anon
-- READ and anon WRITE, and it holds the row a live night runs on. Anyone
-- with the key from the public bundle could have overwritten a session
-- mid-night, in front of a full room. Read exposure (rosters, tiers) is real
-- but secondary to that availability risk.
--
-- Membership of engine_admins is the boundary, not `authenticated`: the
-- clubhouse issues a login to every player on the roster.
--
-- ROLLBACK, if the door ever locks the wrong people out mid-night:
--   drop policy if exists "game_state admin read"  on game_state;
--   drop policy if exists "game_state admin write" on game_state;
--   create policy "game_state anon read"  on game_state for select
--     to anon, authenticated using (true);
--   create policy "game_state anon write" on game_state for all
--     to anon, authenticated using (true) with check (true);

drop policy if exists "game_state anon read"  on game_state;
drop policy if exists "game_state anon write" on game_state;
drop policy if exists "game_state admin read"  on game_state;
drop policy if exists "game_state admin write" on game_state;

create policy "game_state admin read"
  on game_state for select to authenticated
  using (is_engine_admin());

create policy "game_state admin write"
  on game_state for all to authenticated
  using (is_engine_admin())
  with check (is_engine_admin());
