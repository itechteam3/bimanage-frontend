import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { BankPicker, Field } from "@/components/ui";

const BANKS = [
  { name: "5TT MFB", code: "1" },
  { name: "Abbey Mortgage Bank", code: "2" },
  { name: "Access Bank", code: "044" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "OPay Digital Services Limited (OPay)", code: "999992" },
  { name: "United Bank For Africa", code: "033" },
  { name: "Zenith Bank", code: "057" },
  { name: "Zoo Microfinance Bank", code: "9" },
];

function Harness({ onChange = vi.fn() }: { onChange?: (c: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Field label="Bank name">
      <BankPicker
        banks={BANKS}
        value={value}
        onChange={(c) => {
          setValue(c);
          onChange(c);
        }}
      />
    </Field>
  );
}

describe("BankPicker", () => {
  it("is a labelled combobox; popular banks come first", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole("combobox", { name: "Bank name" });
    await user.click(box);
    const names = within(screen.getByRole("listbox", { name: "Banks" })).getAllByRole("option").map((o) => o.textContent);
    expect(names.slice(0, 6)).toEqual(["OPay Digital Services Limited (OPay)", "Moniepoint MFB", "Guaranty Trust Bank", "Access Bank", "Zenith Bank", "United Bank For Africa"]);
    expect(names.at(-1)).toBe("Zoo Microfinance Bank");
  });

  it("typing filters, ignoring case, spaces and punctuation; nicknames work", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole("combobox", { name: "Bank name" });
    await user.type(box, "gt bank");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Guaranty Trust Bank"]);
    await user.clear(box);
    await user.type(box, "UBA");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["United Bank For Africa"]);
    await user.clear(box);
    await user.type(box, "zzz");
    expect(screen.getByText(/No bank matches/)).toBeInTheDocument();
  });

  it("keyboard: arrows move, Enter chooses, Esc closes; the chosen bank shows in the box", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const box = screen.getByRole("combobox", { name: "Bank name" });
    await user.click(box);
    await user.type(box, "ba");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect((box as HTMLInputElement).value).not.toBe("");
    await user.click(box);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("clicking an option chooses it", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("combobox", { name: "Bank name" }));
    await user.click(screen.getByRole("option", { name: "Kuda Bank" }));
    expect(onChange).toHaveBeenCalledWith("50211");
    expect(screen.getByRole("combobox", { name: "Bank name" })).toHaveValue("Kuda Bank");
  });
});
