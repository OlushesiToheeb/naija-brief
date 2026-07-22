import { describe, it, expect } from "vitest";
import { fmtTime, safeUrl } from "./format";

describe("fmtTime", () => {
  it("formats seconds as m:ss", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(9)).toBe("0:09");
    expect(fmtTime(75)).toBe("1:15");
    expect(fmtTime(317)).toBe("5:17");
  });

  it("guards against non-finite input", () => {
    expect(fmtTime(NaN)).toBe("0:00");
    expect(fmtTime(Infinity)).toBe("0:00");
  });
});

describe("safeUrl", () => {
  it("passes through absolute http and https links", () => {
    expect(safeUrl("https://punchng.com/x")).toBe("https://punchng.com/x");
    expect(safeUrl("http://a.b/c")).toBe("http://a.b/c");
  });

  it("blocks script-bearing and non-web schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("JavaScript:alert(1)")).toBe("");
    expect(safeUrl("data:text/html,x")).toBe("");
    expect(safeUrl("vbscript:msgbox(1)")).toBe("");
  });

  it("fails closed on empty, relative and protocol-relative input", () => {
    expect(safeUrl("")).toBe("");
    expect(safeUrl("/relative/path")).toBe("");
    expect(safeUrl("//evil.com")).toBe("");
  });
});
