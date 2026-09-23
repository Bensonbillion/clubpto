// PTO League registration capture.
//
// /league/join writes each submission straight into the clubhouse project's
// league_registrations table (see src/clubhouse/migrations/011). The public
// site can insert but never read: RLS grants anon an insert policy and no
// select, so the insert must stay minimal (no .select(), no returning).
// Benson reads signups in the Supabase dashboard.

import { clubhouse } from "@/clubhouse/supabaseClient";
import { league } from "@/content/league";

export type Division = "mens" | "womens";
export type Experience = "few" | "developing" | "intermediate";

/** The form's working state: selects start blank until the visitor picks. */
export interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  division: Division | "";
  experience: Experience | "";
  instagram: string;
  consent: boolean;
}

/** A validated lead, ready to send. */
export interface LeagueRegistration extends LeadData {
  division: Division;
  experience: Experience;
}

export interface RegistrationRow {
  season: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  division: Division;
  experience: Experience;
  instagram: string | null;
  consent: boolean;
  source: string;
}

/** Just enough of a Supabase client to insert one row. */
export interface RegistrationClient {
  from(table: string): {
    insert(row: RegistrationRow): PromiseLike<{ error: unknown }>;
  };
}

export const REGISTRATION_SOURCE = "clubpto.com/league/join";

export const buildRegistrationRow = (
  lead: LeagueRegistration,
): RegistrationRow => ({
  season: league.seasonNumber,
  first_name: lead.firstName.trim(),
  last_name: lead.lastName.trim(),
  email: lead.email.trim().toLowerCase(),
  phone: lead.phone.trim(),
  division: lead.division,
  experience: lead.experience,
  instagram: lead.instagram.trim() || null,
  consent: lead.consent,
  source: REGISTRATION_SOURCE,
});

export const submitLeagueRegistration = async (
  lead: LeagueRegistration,
  client: RegistrationClient = clubhouse,
): Promise<{ ok: boolean }> => {
  try {
    const { error } = await client
      .from("league_registrations")
      .insert(buildRegistrationRow(lead));
    return { ok: !error };
  } catch {
    return { ok: false };
  }
};
