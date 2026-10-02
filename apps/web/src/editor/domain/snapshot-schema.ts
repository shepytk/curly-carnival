import Ajv2020 from "ajv/dist/2020.js";
import schema from "../../../../../contracts/design/v1/design-snapshot.schema.json";
import { validateGeometry, type DesignSnapshot } from "./design.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile<DesignSnapshot>(schema);

export function parseDesignSnapshot(value: unknown): DesignSnapshot | null {
  if (!validateSchema(value)) return null;
  const result = validateGeometry({
    snapshotSchemaVersion: value.schemaVersion,
    room: value.room,
    openings: value.room.openings,
    placements: value.placements,
  });
  return result.valid ? value : null;
}
