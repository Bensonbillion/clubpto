import { describe, expect, it } from "vitest";
import { parseRosterCsv } from "./rosterCsv";

describe("CSV roster import", () => {
  it("uses first names as preferred display names and keeps a stable row identity", () => {
    const [row] = parseRosterCsv(
      "First Name,Last Name,Phone,Email\nAda,Lovelace,+14165550100,ada@example.com\n",
    );

    expect(row).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      preferredName: "Ada",
      email: "ada@example.com",
      phone: "+14165550100",
    });
    expect(row.sourceKey).toMatch(/^csv_/);
  });

  it("does not merge different people who share an email address", () => {
    const rows = parseRosterCsv(
      "First Name,Last Name,Phone,Email\nAlex,One,+14165550101,household@example.com\nJamie,Two,+14165550102,household@example.com\n",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].sourceKey).not.toBe(rows[1].sourceKey);
    expect(rows.map((row) => row.preferredName)).toEqual(["Alex", "Jamie"]);
  });

  it("normalizes empty cells without creating a blank player", () => {
    const rows = parseRosterCsv(
      "First Name,Last Name,Phone,Email\n , , , \nAda, , , ada@example.com\n",
    );

    expect(rows).toEqual([
      expect.objectContaining({ firstName: "Ada", lastName: null, phone: null, email: "ada@example.com" }),
    ]);
  });
});
