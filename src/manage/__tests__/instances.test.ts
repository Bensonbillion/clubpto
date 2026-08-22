// Two managers, two URLs, one codebase.
//
// /manage and /manage2 are the same app mounted twice. What makes them two
// managers rather than one is the localStorage key each writes, and these
// tests pin the two facts that matter: instance 1 keeps the key every phone
// already has a night under, and instance 2's night is invisible to it.

import { describe, expect, it } from "vitest";
import { createSessionStore, memoryStorage } from "@/court-manager/persistence";
import { STORAGE_KEY, storageKeyFor } from "../useSession";

describe("the storage key per instance", () => {
  it("instance 1 is the bare key, unchanged, so a phone mid-night keeps its night", () => {
    // A phone with Wednesday in progress under cm_manage_session must resume
    // it after this deploy. Renaming the first instance's key would silently
    // hand that phone an empty manager.
    expect(storageKeyFor(1)).toBe("cm_manage_session");
    expect(storageKeyFor(1)).toBe(STORAGE_KEY);
  });

  it("instance 2 writes somewhere else", () => {
    expect(storageKeyFor(2)).toBe("cm_manage_session_2");
    expect(storageKeyFor(2)).not.toBe(storageKeyFor(1));
  });
});

describe("two instances on one device never see each other's night", () => {
  it("a save on /manage2 leaves /manage empty, and the reverse", async () => {
    type Night = { dayLabel: string };
    const storage = memoryStorage();
    const make = (instance: number) => createSessionStore<Night>({
      storageKey: storageKeyFor(instance),
      schemaVersion: 1,
      storage,
      remote: null,
      defaults: () => ({ dayLabel: "" }),
    });

    // save() writes localStorage synchronously. flush() only matters with a
    // remote, and there is none, so the cross-instance load() below reads
    // exactly what the other store wrote, with nothing deferred.
    const second = make(2);
    await second.load();
    second.save({ dayLabel: "Wednesday, court 2" }, 1);

    const first = make(1);
    const { state } = await first.load();
    expect(state.dayLabel).toBe("");

    first.save({ dayLabel: "Wednesday, court 1" }, 2);
    const again = await make(2).load();
    expect(again.state.dayLabel).toBe("Wednesday, court 2");
  });
});

describe("each manager has its own action colour", () => {
  it("Manager 1 keeps sage, Manager 2 is visibly different, both readable on the same ink", async () => {
    const { INSTANCE_ACCENTS, T } = await import("../ui/primitives");
    // The default is the sage every frame was drawn in, so nothing on /manage
    // changes colour because /manage2 exists.
    expect(INSTANCE_ACCENTS[1].acc).toBe("#aebf92");
    expect(INSTANCE_ACCENTS[2].acc).not.toBe(INSTANCE_ACCENTS[1].acc);
    // Screens reach the accent through the variable with sage as the fallback,
    // so a screen rendered outside a manager is still sage.
    expect(T.acc).toContain("var(--cm-acc, #aebf92)");
    expect(T.accd).toContain("var(--cm-accd, #56633f)");
  });
});
