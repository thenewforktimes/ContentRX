import { describe, it, expect } from "vitest";
import {
  ACTOR_ROLES,
  inferActorRole,
  resolveActorRole,
} from "./actor-role";

describe("inferActorRole", () => {
  it("maps plugin → designer", () => {
    expect(inferActorRole("plugin")).toBe("designer");
  });

  it("maps cli → engineer", () => {
    expect(inferActorRole("cli")).toBe("engineer");
  });

  it("maps action → engineer", () => {
    expect(inferActorRole("action")).toBe("engineer");
  });

  it("maps dashboard → pm", () => {
    expect(inferActorRole("dashboard")).toBe("pm");
  });
});

describe("resolveActorRole", () => {
  it("prefers the explicit client-supplied role when valid", () => {
    expect(resolveActorRole("plugin", "engineer")).toBe("engineer");
    expect(resolveActorRole("cli", "designer")).toBe("designer");
    expect(resolveActorRole("dashboard", "other")).toBe("other");
  });

  it("falls back to the source default when no explicit role supplied", () => {
    expect(resolveActorRole("plugin", undefined)).toBe("designer");
    expect(resolveActorRole("cli", null)).toBe("engineer");
    expect(resolveActorRole("dashboard", undefined)).toBe("pm");
  });

  it("ignores invalid explicit values and uses the fallback", () => {
    // @ts-expect-error — deliberately passing an invalid role
    expect(resolveActorRole("plugin", "ceo")).toBe("designer");
  });

  it("covers every declared actor role in the ACTOR_ROLES export", () => {
    expect(new Set(ACTOR_ROLES)).toEqual(
      new Set(["designer", "engineer", "pm", "other"]),
    );
  });
});
