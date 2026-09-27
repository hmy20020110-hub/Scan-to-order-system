import { describe, expect, it } from "vitest";
import { validateTableInput } from "../shared/table-validation";

describe("table input validation", () => {
  it("rejects empty names and codes before an API request", () => {
    expect(validateTableInput({ name: "", code: "" })).toBe("请输入桌台名称");
    expect(validateTableInput({ name: " A01 ", code: " " })).toContain("桌台码至少 2 位");
  });

  it("accepts trimmed human-readable table identifiers", () => {
    expect(validateTableInput({ name: " A 01 ", code: " A01 " })).toBeNull();
    expect(validateTableInput({ name: "A01", code: "A_01-2" })).toBeNull();
  });

  it("rejects unsupported characters in the table code", () => {
    expect(validateTableInput({ name: "A01", code: "一号桌" })).toContain("只能包含");
    expect(validateTableInput({ name: "A01", code: "A/01" })).toContain("只能包含");
  });
});
