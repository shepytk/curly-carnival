import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeClearances, validateGeometry, type DesignSnapshot, type GeometryInput } from "./design.ts";

const contract = JSON.parse(readFileSync("contracts/design/v1/geometry-test-vectors.json", "utf8")) as {
  vectors: Array<{ id: string; description: string; snapshotSchemaVersion?: number; room?: GeometryInput["room"]; openings?: GeometryInput["openings"]; placements?: GeometryInput["placements"]; expected: { valid: boolean; errorCode?: string; effectiveWidthMm?: number; effectiveDepthMm?: number } }>;
};

for (const vector of contract.vectors) {
  test(`${vector.id}: ${vector.description}`, () => {
    const result = validateGeometry({
      snapshotSchemaVersion: vector.snapshotSchemaVersion,
      room: vector.room ?? { widthMm: 2400, depthMm: 3000 },
      openings: vector.openings,
      placements: vector.placements,
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

test("allows footprints to touch along an edge", () => {
  assert.equal(validateGeometry({
    room: { widthMm: 2400, depthMm: 3000 },
    placements: [
      { xMm: 0, yMm: 0, widthMm: 1000, depthMm: 500, rotationDeg: 0 },
      { xMm: 1000, yMm: 0, widthMm: 1000, depthMm: 500, rotationDeg: 0 },
    ],
  }).valid, true);
});

test("reports user-configured clearance conflicts without invalidating fixture geometry", () => {
  const snapshot: DesignSnapshot = {
    schemaVersion: 1, designId: "clearance-test", revision: 0, units: "mm",
    room: { shape: "rectangle", widthMm: 2400, depthMm: 3000, wallHeightMm: 2400, openings: [] },
    placements: [
      { placementId: "vanity", productId: "custom-vanity", displayName: "Vanity", productVersion: "user-defined", xMm: 100, yMm: 100, widthMm: 1000, depthMm: 500, rotationDeg: 0, clearance: { widthMm: 1000, depthMm: 700, direction: "north" } },
      { placementId: "other", productId: "custom-other", displayName: "Other", productVersion: "user-defined", xMm: 100, yMm: 700, widthMm: 1000, depthMm: 400, rotationDeg: 0 },
    ],
  };
  assert.equal(validateGeometry({ room: snapshot.room, placements: snapshot.placements }).valid, true);
  assert.deepEqual(analyzeClearances(snapshot), [{ code: "CLEARANCE_BLOCKED", placementId: "vanity", relatedPlacementId: "other" }]);
});

test("reports a configured clearance that extends beyond the room", () => {
  const snapshot: DesignSnapshot = {
    schemaVersion: 1, designId: "wall-clearance-test", revision: 0, units: "mm",
    room: { shape: "rectangle", widthMm: 1000, depthMm: 1000, wallHeightMm: 2400, openings: [] },
    placements: [{ placementId: "sink", productId: "custom-sink", productVersion: "user-defined", xMm: 0, yMm: 0, widthMm: 400, depthMm: 300, rotationDeg: 0, clearance: { widthMm: 400, depthMm: 600, direction: "south" } }],
  };
  assert.deepEqual(analyzeClearances(snapshot), [{ code: "CLEARANCE_OUT_OF_ROOM", placementId: "sink" }]);
});

test("rejects an incomplete or non-positive configured clearance zone", () => {
  const result = validateGeometry({
    room: { widthMm: 2400, depthMm: 3000 },
    placements: [{ xMm: 1, yMm: 1, widthMm: 10, depthMm: 10, rotationDeg: 0, clearance: { widthMm: 0, depthMm: 10, direction: "north" } }],
  });
  assert.deepEqual(result, { valid: false, errorCode: "CLEARANCE_INVALID" });
});
