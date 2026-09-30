import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

export function parseCurrencyString(raw: string): number | undefined {
  if (!raw && raw !== "0") return undefined;
  let s = String(raw).replace(/[R$\s%]/g, "").trim();
  if (!s) return undefined;

  if (s.includes(",")) {
    // pt-BR: dots are thousand-separators, comma is decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // US / plain: multiple dots = thousand-separators
    const dots = (s.match(/\./g) || []).length;
    if (dots > 1) s = s.replace(/\./g, "");
    // single dot → decimal separator (e.g. "1970.50") — leave as-is
  }

  const n = parseFloat(s);
  if (!isFinite(n) || isNaN(n)) return undefined;
  return Math.round(n * 100) / 100;
}

export function formatCurrencyBR(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function initDisplay(value: string | number | readonly string[] | undefined): string {
  if (value === "" || value === null || value === undefined) return "";
  const n = parseCurrencyString(String(value));
  return n !== undefined ? formatCurrencyBR(n) : "";
}

// ─── component ──────────────────────────────────────────────────────────────

export interface CurrencyInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "type" | "inputMode"
  > {
  /**
   * Controlled value. Accepts numeric string ("1970" / "1970.50"),
   * plain number, or empty string. Formatted display is managed internally.
   */
  value?: string | number;
  /**
   * Fires on every keystroke with e.target.value = normalized numeric string
   * (e.g. "1970.5"). Compatible with existing setState(e.target.value) handlers.
   */
  onChange?: (
    e: React.ChangeEvent<HTMLInputElement> & { target: { value: string } },
  ) => void;
  /** Alternative callback that gives the parsed number (or undefined when empty). */
  onValueChange?: (value: number | undefined) => void;
}

export function CurrencyInput({
  value,
  onChange,
  onValueChange,
  className,
  onBlur,
  onFocus,
  onKeyDown,
  name,
  defaultValue,
  ...rest
}: CurrencyInputProps) {
  // Local display string — what the user sees / edits
  const [displayValue, setDisplayValue] = useState<string>(() =>
    initDisplay(value ?? defaultValue),
  );

  // Track focus so external value changes don't disrupt mid-edit
  const focused = useRef(false);

  // Sync when parent resets or pre-fills value
  useEffect(() => {
    if (focused.current) return;
    setDisplayValue(initDisplay(value));
  }, [value]);

  // ── emit helpers ──────────────────────────────────────────────────────────

  const emitChange = (num: number | undefined) => {
    const normalizedStr = num !== undefined ? String(num) : "";
    if (onChange) {
      onChange({
        target: { value: normalizedStr, name: name ?? "" },
        currentTarget: { value: normalizedStr, name: name ?? "" },
        nativeEvent: new Event("change"),
        bubbles: true,
        cancelable: false,
        defaultPrevented: false,
        eventPhase: 0,
        isTrusted: false,
        preventDefault: () => {},
        isDefaultPrevented: () => false,
        stopPropagation: () => {},
        isPropagationStopped: () => false,
        persist: () => {},
        timeStamp: Date.now(),
        type: "change",
      } as React.ChangeEvent<HTMLInputElement>);
    }
    onValueChange?.(num);
  };

  // ── event handlers ────────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow only: digits, comma, dot
    const filtered = raw.replace(/[^\d,\.]/g, "");

    // Prevent more than 2 decimal places
    const commaIdx = filtered.indexOf(",");
    const dotIdx = filtered.lastIndexOf(".");
    const decimalSep = commaIdx !== -1 ? commaIdx : dotIdx !== -1 ? dotIdx : -1;
    let clamped = filtered;
    if (decimalSep !== -1 && filtered.length - decimalSep - 1 > 2) {
      clamped = filtered.slice(0, decimalSep + 3);
    }

    setDisplayValue(clamped);
    emitChange(parseCurrencyString(clamped));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focused.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    focused.current = false;
    if (displayValue.trim()) {
      const num = parseCurrencyString(displayValue);
      if (num !== undefined) setDisplayValue(formatCurrencyBR(num));
    }
    onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Block arrow-key increment/decrement (no-op on type="text", but be explicit)
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
    onKeyDown?.(e);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Input
        {...rest}
        type="text"
        inputMode="decimal"
        className={cn(className)}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        // name is intentionally omitted from the visible input so HTML-form
        // submissions read the hidden input (normalized value, no formatting)
      />
      {/* Hidden input carries the normalized value for HTML form submissions */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={
            parseCurrencyString(displayValue) !== undefined
              ? String(parseCurrencyString(displayValue))
              : ""
          }
        />
      )}
    </>
  );
}
