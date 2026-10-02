import assert from "node:assert/strict";
import test from "node:test";
import { DesignSession } from "./design-session.ts";
import type { DesignSnapshot } from "../domain/design.ts";

const emptyDesign: DesignSnapshot = {
  schemaVersion: 1,
  designId: "test-design",
  revision: 0,
  units: "mm",
  room: { shape: "rectangle", widthMm: 2400, depthMm: 3000, wallHeightMm: 2400, openings: [] },
  placements: [],
};

test("accepts valid placement, rejects overlap, and keeps invalid commands out of history", () => {
  const session = new DesignSession(emptyDesign);
  const placement = { placementId: "vanity-1", productId: "vanity", productVersion: "v1", xMm: 50, yMm: 50, widthMm: 1000, depthMm: 500, rotationDeg: 0 as const };
  const first = session.execute({ type: "place-product", placement, expectedRevision: 0 });
  assert.equal(first.ok, true);
  const second = session.execute({
    type: "place-product",
    placement: { ...placement, placementId: "shower-1", productId: "shower", xMm: 900, yMm: 100 },
    expectedRevision: 1,
  });
  assert.deepEqual(second, { ok: false, errorCode: "PLACEMENTS_OVERLAP" });
  assert.equal(session.canUndo, true);
  assert.equal(session.snapshot.placements.length, 1);
});

test("undo and redo preserve a monotonic revision", () => {
  const session = new DesignSession(emptyDesign);
  session.execute({
    type: "place-product",
    placement: { placementId: "vanity-1", productId: "vanity", productVersion: "v1", xMm: 50, yMm: 50, widthMm: 1000, depthMm: 500, rotationDeg: 0 },
    expectedRevision: 0,
  });
  assert.equal(session.undo()?.revision, 2);
  assert.equal(session.redo()?.revision, 3);
  assert.equal(session.snapshot.placements.length, 1);
});

test("rejects a command based on a stale revision", () => {
  const session = new DesignSession(emptyDesign);
  assert.deepEqual(session.execute({ type: "remove-product", placementId: "missing", expectedRevision: 3 }), {
    ok: false,
    errorCode: "STALE_REVISION",
  });
});
