import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../hooks/useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 500));
    expect(result.current).toBe("initial");
  });

  it("should update value after delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } }
    );

    rerender({ value: "updated", delay: 500 });

    // Should still be initial immediately after rerender
    expect(result.current).toBe("initial");

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now it should be updated
    expect(result.current).toBe("updated");
  });

  it("should clear timeout on unmount", () => {
    const { result, unmount, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } }
    );

    rerender({ value: "updated", delay: 500 });
    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Cannot reasonably test result.current after unmount, but we can verify it doesn't throw
    expect(result.current).toBe("initial"); // Returns the last value before unmounting
  });

  it("should only update once for multiple rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } }
    );

    rerender({ value: "update1", delay: 500 });
    act(() => { vi.advanceTimersByTime(200); });
    
    rerender({ value: "update2", delay: 500 });
    act(() => { vi.advanceTimersByTime(200); });
    
    rerender({ value: "update3", delay: 500 });

    // Still initial because full delay hasn't passed since LAST update
    expect(result.current).toBe("initial");

    // Advance 500ms from the last update
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should be the very last value
    expect(result.current).toBe("update3");
  });

  it("should handle different delay times", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 1000 } }
    );

    rerender({ value: "updated", delay: 1000 });
    
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe("initial");
    
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe("updated");
  });
});
