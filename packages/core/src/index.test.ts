import { describe, it, expect } from "vitest";
import { greet, VERSION } from "./index.js";

describe("core", () => {
  describe("greet", () => {
    it("should return a greeting message", () => {
      expect(greet("World")).toBe("Hello, World!");
    });

    it("should use the provided name", () => {
      expect(greet("Cadence")).toBe("Hello, Cadence!");
    });
  });

  describe("VERSION", () => {
    it("should be defined", () => {
      expect(VERSION).toBeDefined();
    });

    it("should be a string", () => {
      expect(typeof VERSION).toBe("string");
    });
  });
});
