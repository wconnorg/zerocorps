import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../test/test-database.ts";
import type { Query } from "../backup/dump.ts";
import { COOLDOWN_DAYS, HOLD_DAYS, isUsernameAvailable, setUsername } from "./username-claim.ts";

/**
 * Claiming and changing a username, on a real Postgres, tested against the ways two people
 * can collide and the ways one person can try to get around the wait.
 */

let database: TestDatabase;
const query: Query = async (text, params) =>
  (await database.client.query<Record<string, unknown>>(text, params)).rows;

const DAY = 24 * 60 * 60 * 1000;
const START = new Date("2026-09-21T12:00:00.000Z");
const later = (days: number) => new Date(START.getTime() + days * DAY);

let nextId = 0;
async function newMember(): Promise<string> {
  nextId += 1;
  const id = `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`;
  await query("INSERT INTO users (id, email) VALUES ($1::uuid, $2)", [
    id,
    `member${nextId}@example.com`,
  ]);
  return id;
}

const nameOf = async (id: string) => {
  const [row] = await query("SELECT username, previous_username FROM users WHERE id = $1::uuid", [
    id,
  ]);
  return { username: row?.username ?? null, previous: row?.previous_username ?? null };
};

beforeAll(async () => {
  database = await createTestDatabase();
}, 180_000);

afterAll(async () => {
  await database?.close();
});

describe("claiming a name", () => {
  it("takes it, lower-cased, and leaves the first change free", async () => {
    const id = await newMember();
    const result = await setUsername(query, { userId: id, username: "  Trader_99  ", now: START });
    expect(result).toMatchObject({ ok: true, username: "trader_99", changed: false });

    const [row] = await query(
      "SELECT username, previous_username, username_changed_at FROM users WHERE id = $1::uuid",
      [id],
    );
    expect(row?.username).toBe("trader_99");
    expect(row?.previous_username).toBeNull();
    // No date yet: a first claim is not a change, so one correction is still free.
    expect(row?.username_changed_at).toBeNull();
  });

  it("re-typing the name you already have changes nothing and is not a change", async () => {
    const id = await newMember();
    await setUsername(query, { userId: id, username: "steady", now: START });
    const again = await setUsername(query, { userId: id, username: "STEADY", now: later(1) });
    expect(again).toMatchObject({ ok: true, username: "steady", changed: false });
    expect((await nameOf(id)).previous).toBeNull();
  });

  it("refuses a name that breaks the rules, and writes nothing", async () => {
    const id = await newMember();
    for (const bad of ["ab", "has space", "admin", "___", "Trader!"]) {
      const result = await setUsername(query, { userId: id, username: bad, now: START });
      expect(result.ok, bad).toBe(false);
      if (!result.ok) expect(result.refusal, bad).toBe("invalid");
    }
    expect((await nameOf(id)).username).toBeNull();
  });

  it("refuses a name somebody else has, whatever case it is typed in", async () => {
    const first = await newMember();
    const second = await newMember();
    await setUsername(query, { userId: first, username: "onlyone", now: START });

    for (const attempt of ["onlyone", "ONLYONE", "  OnlyOne  "]) {
      const result = await setUsername(query, { userId: second, username: attempt, now: START });
      expect(result.ok, attempt).toBe(false);
      if (!result.ok) expect(result.refusal, attempt).toBe("taken");
    }
    expect((await nameOf(second)).username).toBeNull();
    expect((await nameOf(first)).username).toBe("onlyone");
  });

  it("the DATABASE is what stops two people having one name, not the check before it", async () => {
    const first = await newMember();
    const second = await newMember();
    await setUsername(query, { userId: first, username: "contested", now: START });

    // Straight past every check in the code, as a race would arrive: the index refuses it.
    await expect(
      query("UPDATE users SET username = $2 WHERE id = $1::uuid", [second, "contested"]),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("the DATABASE also refuses a name of the wrong shape, however it arrives", async () => {
    const id = await newMember();
    for (const bad of ["ab", "Trader", "has space", "way_too_long_for_a_username"]) {
      await expect(
        query("UPDATE users SET username = $2 WHERE id = $1::uuid", [id, bad]),
      ).rejects.toMatchObject({ code: "23514" });
    }
  });
});

describe("changing a name", () => {
  it("holds the old name, so nobody can pick it up and be mistaken for you", async () => {
    const mover = await newMember();
    const stranger = await newMember();
    await setUsername(query, { userId: mover, username: "oldname", now: START });
    const changed = await setUsername(query, { userId: mover, username: "newname", now: later(1) });
    expect(changed).toMatchObject({ ok: true, username: "newname", changed: true });
    expect(await nameOf(mover)).toMatchObject({ username: "newname", previous: "oldname" });

    const grab = await setUsername(query, { userId: stranger, username: "oldname", now: later(2) });
    expect(grab.ok).toBe(false);
    if (!grab.ok) expect(grab.refusal).toBe("taken");
    expect(await isUsernameAvailable(query, "oldname", later(2))).toBe(false);
  });

  it("lets the old name go once the hold has run out", async () => {
    const mover = await newMember();
    const stranger = await newMember();
    await setUsername(query, { userId: mover, username: "passedon", now: START });
    await setUsername(query, { userId: mover, username: "movedaway", now: later(1) });

    const dayBefore = later(1 + HOLD_DAYS - 0.5);
    const dayAfter = later(1 + HOLD_DAYS + 0.5);
    expect(await isUsernameAvailable(query, "passedon", dayBefore)).toBe(false);
    expect(await isUsernameAvailable(query, "passedon", dayAfter)).toBe(true);

    const grab = await setUsername(query, {
      userId: stranger,
      username: "passedon",
      now: dayAfter,
    });
    expect(grab).toMatchObject({ ok: true, username: "passedon" });
  });

  it("makes you wait before the next change, and says until when", async () => {
    const id = await newMember();
    await setUsername(query, { userId: id, username: "first", now: START });
    // The first change is free.
    expect(
      await setUsername(query, { userId: id, username: "second", now: later(1) }),
    ).toMatchObject({ ok: true, changed: true });

    const tooSoon = await setUsername(query, { userId: id, username: "third", now: later(2) });
    expect(tooSoon.ok).toBe(false);
    if (!tooSoon.ok) {
      expect(tooSoon.refusal).toBe("too-soon");
      expect(tooSoon.availableAt?.getTime()).toBe(later(1 + COOLDOWN_DAYS).getTime());
    }
    expect((await nameOf(id)).username).toBe("second");

    // And the wait really does end.
    const afterTheWait = later(1 + COOLDOWN_DAYS + 0.5);
    expect(
      await setUsername(query, { userId: id, username: "third", now: afterTheWait }),
    ).toMatchObject({ ok: true, username: "third" });
  });

  it("the wait cannot be dodged by asking twice at once", async () => {
    const id = await newMember();
    await setUsername(query, { userId: id, username: "once", now: START });
    await setUsername(query, { userId: id, username: "twice", now: later(1) });

    // Both arrive while the wait is on. Each reads the row itself, so both are refused.
    const [a, b] = await Promise.all([
      setUsername(query, { userId: id, username: "aaa", now: later(2) }),
      setUsername(query, { userId: id, username: "bbb", now: later(2) }),
    ]);
    expect([a.ok, b.ok]).toEqual([false, false]);
    expect((await nameOf(id)).username).toBe("twice");
  });

  it("your own name and your own held name do not block you", async () => {
    const id = await newMember();
    await setUsername(query, { userId: id, username: "mine", now: START });
    expect(await isUsernameAvailable(query, "mine", START, id)).toBe(true);
    await setUsername(query, { userId: id, username: "myother", now: later(1) });
    // "mine" is held BY this member, so it is theirs to take back when the wait ends.
    expect(await isUsernameAvailable(query, "mine", later(2), id)).toBe(true);
    expect(await isUsernameAvailable(query, "mine", later(2))).toBe(false);
  });
});

describe("letting go of names that are no longer held", () => {
  // Clearing them is the daily cleanup's job, and is tested with the rest of it.
  it("a hold that has run out is free whether or not anything has cleared it", async () => {
    const id = await newMember();
    await setUsername(query, { userId: id, username: "uncleared", now: START });
    await setUsername(query, { userId: id, username: "current", now: later(1) });
    // Nothing tidies it, and it is still free once the hold has run out.
    expect(await isUsernameAvailable(query, "uncleared", later(1 + HOLD_DAYS + 1))).toBe(true);
    expect((await nameOf(id)).previous).toBe("uncleared");
  });
});
