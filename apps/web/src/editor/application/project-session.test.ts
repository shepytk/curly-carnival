import assert from "node:assert/strict";
import test from "node:test";
import { ProjectSession } from "./project-session.ts";
import type { ProjectSnapshot } from "../domain/design.ts";

const emptyProject: ProjectSnapshot = {
  schemaVersion: 2,
  projectId: "test-project",
  revision: 0,
  units: "mm",
  spaces: [{
    spaceId: "bathroom",
    name: "Bathroom",
    spaceType: "bathroom",
    geometry: { shape: "rectangle", widthMm: 2400, depthMm: 3000, wallHeightMm: 2400, openings: [] },
    items: [],
  }],
};

test("accepts a valid item, rejects overlap, and keeps invalid commands out of history", () => {
  const session = new ProjectSession(emptyProject);
  const item = { itemId: "vanity-1", displayName: "Vanity", xMm: 50, yMm: 50, widthMm: 1000, depthMm: 500, rotationDeg: 0 as const };
  const first = session.execute({ type: "place-item", spaceId: "bathroom", item, expectedRevision: 0 });
  assert.equal(first.ok, true);
  const second = session.execute({
    type: "place-item",
    spaceId: "bathroom",
    item: { ...item, itemId: "shower-1", displayName: "Shower", xMm: 900, yMm: 100 },
    expectedRevision: 1,
  });
  assert.deepEqual(second, { ok: false, errorCode: "ITEMS_OVERLAP" });
  assert.equal(session.canUndo, true);
  assert.equal(session.project.spaces[0]?.items.length, 1);
});

test("undo and redo preserve a monotonic revision", () => {
  const session = new ProjectSession(emptyProject);
  session.execute({
    type: "place-item",
    spaceId: "bathroom",
    item: { itemId: "vanity-1", displayName: "Vanity", xMm: 50, yMm: 50, widthMm: 1000, depthMm: 500, rotationDeg: 0 },
    expectedRevision: 0,
  });
  assert.equal(session.undo()?.revision, 2);
  assert.equal(session.redo()?.revision, 3);
  assert.equal(session.project.spaces[0]?.items.length, 1);
});

test("rejects a command based on a stale revision", () => {
  const session = new ProjectSession(emptyProject);
  assert.deepEqual(session.execute({ type: "remove-item", spaceId: "bathroom", itemId: "missing", expectedRevision: 3 }), {
    ok: false,
    errorCode: "STALE_REVISION",
  });
});

test("targets mutations to the selected space", () => {
  const project: ProjectSnapshot = {
    ...emptyProject,
    spaces: [
      emptyProject.spaces[0]!,
      {
        spaceId: "kitchen",
        name: "Kitchen",
        spaceType: "kitchen",
        geometry: { shape: "rectangle", widthMm: 4000, depthMm: 3500, wallHeightMm: 2500, openings: [] },
        items: [],
      },
    ],
  };
  const session = new ProjectSession(project);
  const result = session.execute({
    type: "place-item",
    spaceId: "kitchen",
    item: { itemId: "island", displayName: "Island", xMm: 500, yMm: 500, widthMm: 1800, depthMm: 900, rotationDeg: 0 },
    expectedRevision: 0,
  });
  assert.equal(result.ok, true);
  assert.equal(session.project.spaces[0]?.items.length, 0);
  assert.equal(session.project.spaces[1]?.items[0]?.displayName, "Island");
});
