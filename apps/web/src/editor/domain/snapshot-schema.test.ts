import assert from "node:assert/strict";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import commandSchema from "../../../../../contracts/design/v2/project-command.schema.json" with { type: "json" };
import projectSchema from "../../../../../contracts/design/v2/project-snapshot.schema.json" with { type: "json" };
import { migrateV1Design, parseProjectSnapshot } from "./snapshot-schema.ts";

test("v2 project and command schemas compile together in strict mode", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(projectSchema);
  assert.doesNotThrow(() => ajv.compile(commandSchema));
});

test("migrates a v1 bathroom design to a v2 renovation project", () => {
  const project = migrateV1Design({
    schemaVersion: 1,
    designId: "legacy-design",
    revision: 4,
    units: "mm",
    room: { shape: "rectangle", widthMm: 2400, depthMm: 3000, wallHeightMm: 2400, openings: [] },
    placements: [{
      placementId: "vanity",
      productId: "custom-vanity",
      displayName: "Vanity",
      productVersion: "user-defined",
      xMm: 100,
      yMm: 100,
      widthMm: 1000,
      depthMm: 500,
      rotationDeg: 0,
    }],
  });

  assert.equal(project?.schemaVersion, 2);
  assert.equal(project?.projectId, "legacy-design");
  assert.equal(project?.spaces[0]?.spaceType, "bathroom");
  assert.equal(project?.spaces[0]?.items[0]?.displayName, "Vanity");
  assert.equal(project?.spaces[0]?.items[0]?.catalogueReference, undefined);
});

test("accepts a valid multi-space v2 project", () => {
  const project = {
    schemaVersion: 2 as const,
    projectId: "renovation",
    revision: 0,
    units: "mm" as const,
    spaces: ["bathroom", "kitchen"].map((spaceType) => ({
      spaceId: spaceType,
      name: spaceType,
      spaceType,
      geometry: { shape: "rectangle" as const, widthMm: 3000, depthMm: 3000, wallHeightMm: 2400, openings: [] },
      items: [],
    })),
  };

  assert.deepEqual(parseProjectSnapshot(project), project);
});
