import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CurrencyInput, parseCurrencyString, formatCurrencyBR } from "@/components/ui/currency-input";

// ─── unit: parseCurrencyString ───────────────────────────────────────────────

describe("parseCurrencyString", () => {
  it("parses pt-BR with dot-thousands and comma-decimal", () => {
    expect(parseCurrencyString("1.970,00")).toBe(1970);
  });
  it("parses US format (dot-decimal)", () => {
    expect(parseCurrencyString("1970.50")).toBe(1970.5);
  });
  it("parses integer string", () => {
    expect(parseCurrencyString("1970")).toBe(1970);
  });
  it('strips "R$ " prefix', () => {
    expect(parseCurrencyString("R$ 1.970,00")).toBe(1970);
  });
  it("handles zero", () => {
    expect(parseCurrencyString("0")).toBe(0);
    expect(parseCurrencyString("0,00")).toBe(0);
  });
  it("returns undefined for empty string", () => {
    expect(parseCurrencyString("")).toBeUndefined();
  });
  it("returns undefined for non-numeric garbage", () => {
    expect(parseCurrencyString("abc")).toBeUndefined();
  });
  it("limits to 2 decimal places via rounding", () => {
    expect(parseCurrencyString("1970.999")).toBe(1971);
  });
});

// ─── unit: formatCurrencyBR ──────────────────────────────────────────────────

describe("formatCurrencyBR", () => {
  it("formats 1970 as 1.970,00", () => {
    expect(formatCurrencyBR(1970)).toBe("1.970,00");
  });
  it("formats 49.9 as 49,90", () => {
    expect(formatCurrencyBR(49.9)).toBe("49,90");
  });
  it("formats 0 as 0,00", () => {
    expect(formatCurrencyBR(0)).toBe("0,00");
  });
});

// ─── component tests ─────────────────────────────────────────────────────────

describe("CurrencyInput component", () => {
  // T01 — renders formatted initial value
  it("T01: value=1970 renders as 1.970,00", () => {
    render(<CurrencyInput value={1970} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("1.970,00");
  });

  // T02 — blur formats partial input (49,9 → 49,90)
  it("T02: typing 49,9 and blurring formats to 49,90", () => {
    render(<CurrencyInput />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "49,9" } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe("49,90");
  });

  // T03 — zero value
  it("T03: value=0 renders as 0,00", () => {
    render(<CurrencyInput value={0} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("0,00");
  });

  // T04 — empty value
  it("T04: no value prop renders empty field", () => {
    render(<CurrencyInput />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  // T05 — paste "R$ 1.970,00" → internal value 1970
  it("T05: pasting 'R$ 1.970,00' calls onValueChange with 1970", () => {
    const onValueChange = vi.fn();
    render(<CurrencyInput onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox");
    // handleChange strips non-digit/comma/dot, so "R$ 1.970,00" → "1.970,00" → 1970
    fireEvent.change(input, { target: { value: "R$ 1.970,00" } });
    expect(onValueChange).toHaveBeenCalledWith(1970);
  });

  // T06 — US format "1970.50" → display 1.970,50
  it("T06: value='1970.50' renders as 1.970,50", () => {
    render(<CurrencyInput value="1970.50" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("1.970,50");
  });

  // T07 — ArrowUp does not change value
  it("T07: ArrowUp does not change value", () => {
    render(<CurrencyInput value={100} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    const before = input.value;
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe(before);
  });

  // T08 — ArrowDown does not change value
  it("T08: ArrowDown does not change value", () => {
    render(<CurrencyInput value={100} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    const before = input.value;
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.value).toBe(before);
  });

  // T09 — max 2 decimal places enforced during typing
  it("T09: typing more than 2 decimal places is blocked at 2", () => {
    render(<CurrencyInput />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "49,999" } });
    expect((input as HTMLInputElement).value).toBe("49,99");
  });

  // T10 — onValueChange receives parsed number
  it("T10: onValueChange fires with the parsed number", () => {
    const onValueChange = vi.fn();
    render(<CurrencyInput onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "1970" } });
    expect(onValueChange).toHaveBeenCalledWith(1970);
  });

  // T11 — onChange fires with normalized string (not formatted)
  it("T11: onChange e.target.value is a plain numeric string", () => {
    const onChange = vi.fn();
    render(<CurrencyInput onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "1970" } });
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0];
    expect(call.target.value).toBe("1970");
    expect(call.target.value).not.toContain(".");
    expect(call.target.value).not.toContain(",");
  });

  // T12 — hidden input carries the name attribute
  it("T12: when name is provided, hidden input receives normalized value", () => {
    const { container } = render(<CurrencyInput name="valor" value={1970} />);
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden).toBeTruthy();
    expect(hidden.name).toBe("valor");
    expect(hidden.value).toBe("1970");
  });

  // T13 — no hidden input when name is omitted
  it("T13: no hidden input when name is not provided", () => {
    const { container } = render(<CurrencyInput value={1970} />);
    const hidden = container.querySelector('input[type="hidden"]');
    expect(hidden).toBeNull();
  });

  // T14 — external value change syncs display when not focused
  it("T14: external value change updates display when not focused", () => {
    const { rerender } = render(<CurrencyInput value={100} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("100,00");
    rerender(<CurrencyInput value={200} />);
    expect(input.value).toBe("200,00");
  });

  // T15 — inputMode is decimal
  it("T15: input has inputMode=decimal", () => {
    render(<CurrencyInput />);
    const input = screen.getByRole("textbox");
    expect(
      input.getAttribute("inputMode") ?? input.getAttribute("inputmode"),
    ).toBe("decimal");
  });

  // T16 — blur on empty field stays empty
  it("T16: blurring an empty field does not add 0,00", () => {
    render(<CurrencyInput />);
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe("");
  });
});
