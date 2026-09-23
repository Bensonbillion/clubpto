// Bug: /league/join showed a confirmation screen but never sent the
// registration anywhere (leadCaptureUrl was TODO, so the POST was skipped
// and the lead lived only in the visitor's sessionStorage).
//
// These tests pin the fix: a submission is written to the clubhouse
// project's league_registrations table, and a failed write is reported
// back to the caller instead of being swallowed.
import { describe, expect, it, vi } from "vitest";
import {
  buildRegistrationRow,
  submitLeagueRegistration,
} from "@/league/submitRegistration";

const lead = {
  firstName: "  Ada ",
  lastName: "Lovelace ",
  email: " Ada@Example.com ",
  phone: " 416-555-0100 ",
  division: "womens" as const,
  experience: "developing" as const,
  instagram: "  ",
  consent: true,
};

const fakeClient = (error: { message: string } | null) => {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ insert });
  return { client: { from }, from, insert };
};

describe("league registration capture", () => {
  it("maps the form into a trimmed table row", () => {
    expect(buildRegistrationRow(lead)).toEqual({
      season: 1,
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      phone: "416-555-0100",
      division: "womens",
      experience: "developing",
      instagram: null,
      consent: true,
      source: "clubpto.com/league/join",
    });
  });

  it("inserts the row into league_registrations", async () => {
    const { client, from, insert } = fakeClient(null);
    const result = await submitLeagueRegistration(lead, client);
    expect(from).toHaveBeenCalledWith("league_registrations");
    expect(insert).toHaveBeenCalledWith(buildRegistrationRow(lead));
    expect(result).toEqual({ ok: true });
  });

  it("reports a failed write instead of swallowing it", async () => {
    const { client } = fakeClient({ message: "permission denied" });
    const result = await submitLeagueRegistration(lead, client);
    expect(result).toEqual({ ok: false });
  });

  it("reports a thrown network error", async () => {
    const insert = vi.fn().mockRejectedValue(new Error("offline"));
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    const result = await submitLeagueRegistration(lead, client);
    expect(result).toEqual({ ok: false });
  });
});
