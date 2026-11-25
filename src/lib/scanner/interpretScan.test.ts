import { describe, expect, it } from "vitest";
import { interpretScan, labelLink } from "./scanner";

describe("what a scanned code means", () => {
  it("plain barcodes and SKUs are product codes", () => {
    expect(interpretScan(" 5901234123457 ")).toEqual({ kind: "code", code: "5901234123457" });
    expect(interpretScan("LS-1")).toEqual({ kind: "code", code: "LS-1" });
  });

  it("GS1 Digital Link: the GTIN is the product code", () => {
    expect(interpretScan("https://id.gs1.org/01/05901234123457")).toEqual({ kind: "code", code: "5901234123457" });
    expect(interpretScan("https://brand.example.com/01/05901234123457/10/ABC123?x=1")).toEqual({ kind: "code", code: "5901234123457" });
    expect(interpretScan("https://brand.example.com/01/12345670")).toEqual({ kind: "code", code: "12345670" });
    expect(interpretScan("https://brand.example.com/01/15901234123454")).toEqual({ kind: "code", code: "15901234123454" });
  });

  it("?barcode= and ?sku= links on any site", () => {
    expect(interpretScan("https://shop.example.com/item?barcode=4006381333931")).toEqual({ kind: "code", code: "4006381333931" });
    expect(interpretScan("https://shop.example.com/item?sku=LS-1")).toEqual({ kind: "code", code: "LS-1" });
    expect(interpretScan("https://shop.example.com/item?sku=<script>").kind).toBe("link");
  });

  it("BiManage label links carry the code; ?code= elsewhere doesn't count", () => {
    expect(interpretScan(labelLink("BM-000123"))).toEqual({ kind: "code", code: "BM-000123" });
    expect(interpretScan(`${window.location.origin}/inventory/lookup?code=5901234123457`)).toEqual({ kind: "code", code: "5901234123457" });
    expect(interpretScan("https://other.example.com/x?code=123")).toEqual({ kind: "link", host: "other.example.com" });
  });

  it("any other link is a link: never a product code", () => {
    expect(interpretScan("https://www.instagram.com/somebrand")).toEqual({ kind: "link", host: "www.instagram.com" });
    expect(interpretScan("www.example.com/menu")).toEqual({ kind: "link", host: "www.example.com" });
    expect(interpretScan("http://wifi.example.net")).toEqual({ kind: "link", host: "wifi.example.net" });
  });
});
