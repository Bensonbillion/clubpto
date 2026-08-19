// GENERATED FILE. Do not edit by hand.
//
// Generator: scripts/gen-manage-roster.mjs
// Source:    src/clubhouse/migrations/002_roster_seed.sql
//
// Edit the seed SQL, re-run the generator, commit both.
//
// WHY THE ROSTER IS BUNDLED INTO THE APP
//
// A live night runs on one phone in a loud room with the club's wifi
// somewhere between bad and absent, and the manager's door is a passcode, so
// there is no auth session to read the club's table with. If step 2 of the
// wizard asked the network who plays here, the night would stall before the
// first serve. So the roster ships with the build. The remote list in
// clubhouse_roster is a refresh layered on top of these names, never the
// thing they depend on, and every path through src/manage/roster/source.ts
// starts from this array.
//
// Sorted by displayName using localeCompare with an explicit "en" locale, so
// the order is identical on every machine that regenerates it.

export interface RosterName {
  readonly playerId: string;
  readonly displayName: string;
}

export const BUNDLED_ROSTER: readonly RosterName[] = [
  { playerId: "p-abubakar", displayName: "Abubakar" },
  { playerId: "p-ade", displayName: "Ade" },
  { playerId: "p-adee", displayName: "Adee" },
  { playerId: "p-akin", displayName: "Akin" },
  { playerId: "p-albright", displayName: "Albright" },
  { playerId: "p-alex", displayName: "Alex" },
  { playerId: "p-amadiosi", displayName: "Amadiosi" },
  { playerId: "p-amber", displayName: "Amber" },
  { playerId: "p-andrew", displayName: "Andrew" },
  { playerId: "p-ayo", displayName: "Ayo" },
  { playerId: "p-benita", displayName: "Benita" },
  { playerId: "p-benson", displayName: "Benson" },
  { playerId: "p-brian", displayName: "Brian" },
  { playerId: "p-carlos", displayName: "Carlos" },
  { playerId: "p-chibuike", displayName: "Chibuike" },
  { playerId: "p-chizea", displayName: "Chizea" },
  { playerId: "p-david", displayName: "David" },
  { playerId: "p-debbie", displayName: "Debbie" },
  { playerId: "p-deborah", displayName: "Deborah" },
  { playerId: "p-diana", displayName: "Diana" },
  { playerId: "p-donell", displayName: "Donell" },
  { playerId: "p-donnel", displayName: "Donnel" },
  { playerId: "p-donnell", displayName: "Donnell" },
  { playerId: "p-doris", displayName: "Doris" },
  { playerId: "p-duke", displayName: "Duke" },
  { playerId: "p-dynamite", displayName: "Dynamite" },
  { playerId: "p-edmund", displayName: "Edmund" },
  { playerId: "p-elvis", displayName: "Elvis" },
  { playerId: "p-eman", displayName: "Eman" },
  { playerId: "p-emmanuel", displayName: "Emmanuel" },
  { playerId: "p-ese", displayName: "Ese" },
  { playerId: "p-eve", displayName: "Eve" },
  { playerId: "p-fiyin", displayName: "Fiyin" },
  { playerId: "p-folarin", displayName: "Folarin" },
  { playerId: "p-frank", displayName: "Frank" },
  { playerId: "p-grace", displayName: "Grace" },
  { playerId: "p-hamid", displayName: "Hamid" },
  { playerId: "p-hank", displayName: "Hank" },
  { playerId: "p-ife", displayName: "Ife" },
  { playerId: "p-ifeoma", displayName: "Ifeoma" },
  { playerId: "p-ig", displayName: "IG" },
  { playerId: "p-jaidan", displayName: "Jaidan" },
  { playerId: "p-jen", displayName: "Jen" },
  { playerId: "p-kayode", displayName: "Kayode" },
  { playerId: "p-kelechi", displayName: "Kelechi" },
  { playerId: "p-kenisha", displayName: "Kenisha" },
  { playerId: "p-malik", displayName: "Malik" },
  { playerId: "p-martins", displayName: "Martins" },
  { playerId: "p-ore", displayName: "Ore" },
  { playerId: "p-ossai", displayName: "Ossai" },
  { playerId: "p-paola", displayName: "Paola" },
  { playerId: "p-rob", displayName: "Rob" },
  { playerId: "p-sam", displayName: "Sam" },
  { playerId: "p-samuel", displayName: "Samuel" },
  { playerId: "p-shana", displayName: "Shana" },
  { playerId: "p-tamilore", displayName: "Tamilore" },
  { playerId: "p-temi", displayName: "Temi" },
  { playerId: "p-temitope", displayName: "Temitope" },
  { playerId: "p-timi", displayName: "Timi" },
  { playerId: "p-timi-olaoye", displayName: "Timi Olaoye" },
  { playerId: "p-tofunmi", displayName: "Tofunmi" },
  { playerId: "p-tolu", displayName: "Tolu" },
  { playerId: "p-tomi", displayName: "Tomi" },
  { playerId: "p-tumi", displayName: "Tumi" },
  { playerId: "p-tyrell", displayName: "Tyrell" },
  { playerId: "p-valerie", displayName: "Valerie" },
];
