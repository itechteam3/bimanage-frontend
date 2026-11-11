import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, Dialog, Field, OtpInput, PasswordInput, TextInput } from ".";

describe("Button", () => {
  it("is disabled and announces busy while loading", () => {
    render(<Button loading>Save</Button>);
    const b = screen.getByRole("button", { name: /processing/i });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
  });
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });
});

describe("Field", () => {
  it("links label, hint and error to the input", () => {
    render(
      <Field label="Email address" required error="Enter a valid email">
        <TextInput type="email" />
      </Field>
    );
    const input = screen.getByLabelText(/email address/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
  });

  it("password toggle shows and hides the value", async () => {
    render(
      <Field label="Password">
        <PasswordInput />
      </Field>
    );
    const input = screen.getByLabelText(/^password/i);
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(input).toHaveAttribute("type", "text");
  });
});

describe("OtpInput", () => {
  const Harness = ({ onDone }: { onDone?: (v: string) => void }) => {
    const [v, setV] = useState("");
    return (
      <OtpInput
        value={v}
        onChange={(next) => {
          setV(next);
          onDone?.(next);
        }}
      />
    );
  };

  it("advances as you type and supports Backspace", async () => {
    const onDone = vi.fn();
    render(<Harness onDone={onDone} />);
    const cells = screen.getAllByRole("textbox");
    await userEvent.click(cells[0]!);
    await userEvent.keyboard("123");
    expect(cells[3]).toHaveFocus();
    await userEvent.keyboard("{Backspace}");
    expect(onDone).toHaveBeenLastCalledWith("12");
  });

  it("accepts a pasted code", async () => {
    const onDone = vi.fn();
    render(<Harness onDone={onDone} />);
    await userEvent.click(screen.getAllByRole("textbox")[0]!);
    await userEvent.paste("28 64 19");
    expect(onDone).toHaveBeenLastCalledWith("286419");
  });

  it("ignores letters", async () => {
    const onDone = vi.fn();
    render(<Harness onDone={onDone} />);
    await userEvent.click(screen.getAllByRole("textbox")[0]!);
    await userEvent.keyboard("a");
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("Dialog", () => {
  it("is labelled by its title and closes with its action", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Confirm the next step" description="Nothing is sent yet." actions={<Button onClick={onClose}>Go back</Button>} />
    );
    expect(screen.getByRole("dialog", { name: "Confirm the next step" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(onClose).toHaveBeenCalled();
  });
});
