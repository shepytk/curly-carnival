import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateGeometry, type GeometryInput } from "./design.ts";

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
