import { expect, it } from "vitest";
import { acquireImageToolSlot } from "../../src/lib/image-tools/execution-slot";

it("allows only one heavy image session and releases it exactly once", () => {
  const first = acquireImageToolSlot();
  expect(() => acquireImageToolSlot()).toThrow("already running");
  first();
  const second = acquireImageToolSlot();
  first(); // A stale completion must not release the next session.
  expect(() => acquireImageToolSlot()).toThrow("already running");
  second();
  const third = acquireImageToolSlot();
  third();
});
