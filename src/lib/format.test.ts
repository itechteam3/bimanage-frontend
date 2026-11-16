import { describe, expect, it } from "vitest";
import { nairaExact } from "./format";
describe("nairaExact (wallet and earnings: exact to the kobo)", () => {
  it("shows kobo only when there are any, and never rounds up", () => {
    expect(nairaExact(17.46)).toBe("₦17.46");
    expect(nairaExact(0.54)).toBe("₦0.54");
    expect(nairaExact(2080684.86)).toBe("₦2,080,684.86");
    expect(nairaExact(500)).toBe("₦500");
    expect(nairaExact(17.999999999)).toBe("₦18");
    expect(nairaExact(null)).toBe("₦0");
  });
});
