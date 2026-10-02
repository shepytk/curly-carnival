import Ajv2020 from "ajv/dist/2020.js";
import legacySchema from "../../../../../contracts/design/v1/design-snapshot.schema.json" with { type: "json" };
import projectSchema from "../../../../../contracts/design/v2/project-snapshot.schema.json" with { type: "json" };
import {
  validateProject,
  type ClearanceZone,
  type Opening,
  type ProjectSnapshot,
  type RotationDeg,
  type SpaceGeometry,
} from "./design.ts";

interface LegacyPlacement {
  placementId: string;
  productId: string;
  displayName?: string;
  productVersion: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
  rotationDeg: RotationDeg;
  clearance?: ClearanceZone;
}

interface LegacyDesignSnapshot {
  schemaVersion: 1;
  designId: string;
  revision: number;
  units: "mm";
  room: SpaceGeometry;
  placements: LegacyPlacement[];
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateProjectSchema = ajv.compile<ProjectSnapshot>(projectSchema);
const validateLegacySchema = ajv.compile<LegacyDesignSnapshot>(legacySchema);

export function parseProjectSnapshot(value: unknown): ProjectSnapshot | null {
  if (!validateProjectSchema(value)) return null;
  return validateProject(value).valid ? value : null;
}

export function migrateV1Design(value: unknown): ProjectSnapshot | null {
  if (!validateLegacySchema(value)) return null;
  const project: ProjectSnapshot = {
    schemaVersion: 2,
    projectId: value.designId,
    revision: value.revision,
    units: value.units,
    spaces: [{
      spaceId: `${value.designId}-space-1`,
      name: "Bathroom",
      spaceType: "bathroom",
      geometry: {
        ...value.room,
        openings: value.room.openings.map((opening: Opening) => ({ ...opening })),
      },
      items: value.placements.map((placement) => ({
        itemId: placement.placementId,
        displayName: placement.displayName ?? placement.productId,
        ...(placement.productVersion !== "user-defined"
          ? { catalogueReference: { productId: placement.productId, productVersion: placement.productVersion } }
          : {}),
        xMm: placement.xMm,
        yMm: placement.yMm,
        widthMm: placement.widthMm,
        depthMm: placement.depthMm,
        rotationDeg: placement.rotationDeg,
        ...(placement.clearance ? { clearance: { ...placement.clearance } } : {}),
      })),
    }],
  };
  return validateProject(project).valid ? project : null;
}
