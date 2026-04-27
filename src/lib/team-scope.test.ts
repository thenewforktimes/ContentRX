import { describe, expect, it } from "vitest";
import { teamScope } from "./team-scope";

describe("teamScope", () => {
  it("returns user.id for free/Pro users (no teamOwnerUserId)", () => {
    expect(
      teamScope({ user: { id: "u_self" }, teamOwnerUserId: null }),
    ).toBe("u_self");
  });

  it("returns user.id for team owners (teamOwnerUserId is null because resolver promotes self)", () => {
    // resolveAuth sets teamOwnerUserId=null for the owner themselves.
    // teamScope must promote user.id so per-team rollups work.
    expect(
      teamScope({ user: { id: "u_owner" }, teamOwnerUserId: null }),
    ).toBe("u_owner");
  });

  it("returns owner's id for team members", () => {
    expect(
      teamScope({
        user: { id: "u_member" },
        teamOwnerUserId: "u_owner",
      }),
    ).toBe("u_owner");
  });

  it("never returns null", () => {
    // Type-level guard plus runtime check for fuzzing safety.
    const result = teamScope({
      user: { id: "u_x" },
      teamOwnerUserId: null,
    });
    expect(result).not.toBeNull();
    expect(result).not.toBe("");
  });
});
