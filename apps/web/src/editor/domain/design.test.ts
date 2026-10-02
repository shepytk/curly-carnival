import assert from "node:assert/strict";
import test from "node:test";
import vectors from "../../../../../contracts/design/v2/geometry-test-vectors.json" with { type: "json" };
import { analyzeClearances, validateGeometry, type GeometryInput, type RenovationSpace } from "./design.ts";

type Vector = {
  id: string;
  description: string;
  snapshotSchemaVersion?: number;
  space?: GeometryInput["space"];
  openings?: GeometryInput["openings"];
  items?: GeometryInput["items"];
  expected: { valid: boolean; errorCode?: string; effectiveWidthMm?: number; effectiveDepthMm?: number };
};

for (const vector of vectors.vectors as Vector[]) {
  test(`${vector.id}: ${vector.description}`, () => {
    const result = validateGeometry({
      snapshotSchemaVersion: vector.snapshotSchemaVersion,
      space: vector.space ?? { widthMm: 2400, depthMm: 3000 },
      openings: vector.openings,
      items: vector.items,
    });
    assert.equal(result.valid, vector.expected.valid);
    if (!vector.expected.valid) {
      assert.equal(result.valid ? undefined : result.errorCode, vector.expected.errorCode);
    }
    if (vector.expected.effectiveWidthMm !== undefined && result.valid) {
      assert.equal(result.effectiveFootprints?.[0]?.widthMm, vector.expected.effectiveWidthMm);
      assert.equal(result.effectiveFootprints?.[0]?.depthMm, vector.expected.effectiveDepthMm);
    }
  });
}

test("allows items to touch along an edge", () => {
  assert.equal(validateGeometry({
    space: { widthMm: 2400, depthMm: 3000 },
    items: [
      { xMm: 0, yMm: 0, widthMm: 1000, depthMm: 500, rotationDeg: 0 },
      { xMm: 1000, yMm: 0, widthMm: 1000, depthMm: 500, rotationDeg: 0 },
    ],
  }).valid, true);
});

test("reports user-configured clearance conflicts without invalidating item geometry", () => {
  const space: RenovationSpace = {
    spaceId: "bathroom",
    name: "Bathroom",
    spaceType: "bathroom",
    geometry: { shape: "rectangle", widthMm: 2400, depthMm: 3000, wallHeightMm: 2400, openings: [] },
    items: [
      { itemId: "vanity", displayName: "Vanity", xMm: 100, yMm: 100, widthMm: 1000, depthMm: 500, rotationDeg: 0, clearance: { widthMm: 1000, depthMm: 700, direction: "north" } },
      { itemId: "other", displayName: "Other", xMm: 100, yMm: 700, widthMm: 1000, depthMm: 400, rotationDeg: 0 },
    ],
  };
  assert.equal(validateGeometry({ space: space.geometry, items: space.items }).valid, true);
  assert.deepEqual(analyzeClearances(space), [{ code: "CLEARANCE_BLOCKED", itemId: "vanity", relatedItemId: "other" }]);
});

test("reports a configured clearance that extends beyond the space", () => {
  const space: RenovationSpace = {
    spaceId: "bathroom",
    name: "Bathroom",
    spaceType: "bathroom",
    geometry: { shape: "rectangle", widthMm: 1000, depthMm: 1000, wallHeightMm: 2400, openings: [] },
    items: [{ itemId: "sink", displayName: "Sink", xMm: 0, yMm: 0, widthMm: 400, depthMm: 300, rotationDeg: 0, clearance: { widthMm: 400, depthMm: 600, direction: "south" } }],
  };
  assert.deepEqual(analyzeClearances(space), [{ code: "CLEARANCE_OUT_OF_SPACE", itemId: "sink" }]);
});

test("rejects an incomplete or non-positive configured clearance zone", () => {
  const result = validateGeometry({
    space: { widthMm: 2400, depthMm: 3000 },
    items: [{ xMm: 1, yMm: 1, widthMm: 10, depthMm: 10, rotationDeg: 0, clearance: { widthMm: 0, depthMm: 10, direction: "north" } }],
  });
  assert.deepEqual(result, { valid: false, errorCode: "CLEARANCE_INVALID" });
});
