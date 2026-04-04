import { describe, it, expect } from "vitest";
import { cn, maskPhone, maskCPF, validateCPF, formatPhone, formatCPF } from "../lib/utils";

describe("cn (class merge)", () => {
  it("merges basic classes", () => {
    expect(cn("bg-red-500", "text-white")).toBe("bg-red-500 text-white");
  });

  it("handles conditional classes", () => {
    const isTrue = true;
    const isFalse = false;
    expect(cn("base-class", isTrue && "truthy-class", isFalse && "falsy-class")).toBe("base-class truthy-class");
  });

  it("resolves tailwind conflicts", () => {
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
    expect(cn("px-2 py-1", "p-4")).toBe("p-4"); // Note: p-4 overrides px and py
  });

  it("ignores null and undefined", () => {
    expect(cn("class1", null, undefined, "class2")).toBe("class1 class2");
  });

  it("handles arrays", () => {
    expect(cn(["class1", "class2"], "class3")).toBe("class1 class2 class3");
  });
});

describe("maskPhone & formatPhone", () => {
  it("formats 11 digits correctly", () => {
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("formats 10 digits correctly", () => {
    expect(maskPhone("1187654321")).toBe("(11) 8765-4321");
  });

  it("handles empty or null values", () => {
    expect(maskPhone("")).toBe("");
    expect(formatPhone(null)).toBe("");
  });
});

describe("maskCPF & formatCPF", () => {
  it("formats 11 digits correctly", () => {
    expect(maskCPF("12345678901")).toBe("123.456.789-01");
    expect(formatCPF("12345678901")).toBe("123.456.789-01");
  });

  it("handles partial strings", () => {
    expect(maskCPF("123456")).toBe("123.456");
  });

  it("handles empty or null values", () => {
    expect(maskCPF("")).toBe("");
    expect(formatCPF(null)).toBe("");
  });
});

describe("validateCPF", () => {
  it("returns true for valid CPFs", () => {
    expect(validateCPF("52998224725")).toBe(true); // Known valid CPF
  });

  it("returns false for invalid length", () => {
    expect(validateCPF("123")).toBe(false);
  });

  it("returns false for identical digits", () => {
    expect(validateCPF("11111111111")).toBe(false);
  });

  it("returns false for invalid check digits", () => {
    expect(validateCPF("12345678901")).toBe(false);
  });
});
