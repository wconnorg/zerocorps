import { describe, expect, it } from "vitest";
import { parseRoleIds, syncDiscordRoles } from "./role-sync.ts";

/** `syncDiscordRoles` against a fake Discord that records what it was asked. */

const MEMBER = "123456789012345678";
const GUILD = "223456789012345678";
const ROOKIE = "323456789012345678";
const LATER = "423456789012345678";
const config = { botToken: "bot-token", guildId: GUILD, roleIds: { rookie: ROOKIE, later: LATER } };

function recorder(status: (method: string, url: string) => number | Response) {
  const calls: { method: string; url: string }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url: String(input) });
    const result = status(method, String(input));
    return typeof result === "number" ? new Response(null, { status: result }) : result;
  };
  return { calls, fetcher };
}

describe("syncing a member's rank role", () => {
  it("adds the role for their rank first, then removes the other rank roles", async () => {
    const { calls, fetcher } = recorder(() => 204);
    expect(await syncDiscordRoles(fetcher, config, MEMBER, "rookie")).toEqual({ status: "synced" });
    expect(calls.map((call) => [call.method, call.url.split("/").pop()])).toEqual([
      ["PUT", ROOKIE],
      ["DELETE", LATER],
    ]);
    expect(calls[0]!.url).toBe(
      `https://discord.com/api/v10/guilds/${GUILD}/members/${MEMBER}/roles/${ROOKIE}`,
    );
  });

  it("with no rank (unlinking), removes every rank role", async () => {
    const { calls, fetcher } = recorder(() => 204);
    await syncDiscordRoles(fetcher, config, MEMBER, null);
    expect(calls.map((call) => call.method)).toEqual(["DELETE", "DELETE"]);
  });

  it("a member who is not in the server is not an error", async () => {
    const { fetcher } = recorder(() => 404);
    expect(await syncDiscordRoles(fetcher, config, MEMBER, "rookie")).toEqual({
      status: "not-in-server",
    });
  });

  it("waits out a short rate limit once, and gives up on a long one", async () => {
    let first = true;
    const short = recorder(() => {
      if (!first) return 204;
      first = false;
      return new Response(JSON.stringify({ retry_after: 0.01 }), { status: 429 });
    });
    expect(await syncDiscordRoles(short.fetcher, config, MEMBER, "rookie")).toEqual({
      status: "synced",
    });

    const long = recorder(() => new Response(JSON.stringify({ retry_after: 60 }), { status: 429 }));
    expect(await syncDiscordRoles(long.fetcher, config, MEMBER, "rookie")).toEqual({
      status: "rate-limited",
    });
    expect(long.calls).toHaveLength(1);
  });

  it("a refusal (the bot lacks Manage Roles) or a network failure is reported, never thrown", async () => {
    expect(await syncDiscordRoles(recorder(() => 403).fetcher, config, MEMBER, "rookie")).toEqual({
      status: "failed",
      httpStatus: 403,
    });
    const broken: typeof fetch = async () => {
      throw new Error("network down");
    };
    expect(await syncDiscordRoles(broken, config, MEMBER, "rookie")).toEqual({
      status: "failed",
      httpStatus: null,
    });
  });

  it("an id that is not a Discord id is never put into a request", async () => {
    const { calls, fetcher } = recorder(() => 204);
    expect(await syncDiscordRoles(fetcher, config, "../../users/@me", "rookie")).toEqual({
      status: "failed",
      httpStatus: null,
    });
    expect(calls).toEqual([]);
  });
});

describe("DISCORD_RANK_ROLE_IDS", () => {
  it("is a JSON object of rank keys to Discord role ids", () => {
    expect(parseRoleIds(`{"rookie":"${ROOKIE}"}`)).toEqual({ rookie: ROOKIE });
  });

  it("anything else switches role sync off rather than guessing", () => {
    for (const raw of [
      undefined,
      "",
      "not json",
      "[]",
      "{}",
      `{"rookie":123}`,
      `{"rookie":"abc"}`,
      `{"Bad Key":"${ROOKIE}"}`,
    ]) {
      expect(parseRoleIds(raw), String(raw)).toBeNull();
    }
  });
});
