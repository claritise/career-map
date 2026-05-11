// @vitest-environment jsdom
import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEscapeKey } from "./use-escape-key";

describe("useEscapeKey", () => {
  it("invokes the callback when Escape is pressed", () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(onEscape));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("does not fire for other keys", () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(onEscape));

    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "a" });
    fireEvent.keyDown(window, { key: " " });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const onEscape = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(onEscape));

    unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("uses the latest callback after re-render", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useEscapeKey(cb), {
      initialProps: { cb: first },
    });

    rerender({ cb: second });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
