import { describe, expect, it } from "vitest";
import { suggestEmail } from "./emailTypos";

describe("suggestEmail", () => {
  it.each([
    ["elijahayanlere3@gmaiul.com", "elijahayanlere3@gmail.com"],
    ["ada@gmial.com", "ada@gmail.com"],
    ["ada@gmail.con", "ada@gmail.com"],
    ["ada@gmail.co", "ada@gmail.com"],
    ["  Ada@YAHO.com ", "ada@yahoo.com"],
    ["ada@hotmial.com", "ada@hotmail.com"],
    ["ada@outlok.com", "ada@outlook.com"],
    ["ada@icloud.co", "ada@icloud.com"],
  ])("%s → %s", (input, expected) => expect(suggestEmail(input)).toBe(expected));

  it.each(["ada@gmail.com", "ada@bitechteam.com", "ada@company.com.ng", "ada@mail.com", "ada@", "not-an-email", ""])("leaves %s alone", (input) => expect(suggestEmail(input)).toBeNull());
});
