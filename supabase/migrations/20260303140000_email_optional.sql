-- Make email optional on players table
ALTER TABLE players ALTER COLUMN email DROP NOT NULL;

-- Drop the unique constraint on email and re-add it only for non-null values
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_email_key;
CREATE UNIQUE INDEX players_email_unique ON players (email) WHERE email IS NOT NULL;
