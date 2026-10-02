export type WallId = "south" | "east" | "north" | "west";
export type OpeningKind = "door" | "window";
export type RotationDeg = 0 | 90 | 180 | 270;

export interface Opening {
  openingId: string;
  kind: OpeningKind;
  wall: WallId;
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  sillHeightMm?: number;
  swing?: "inward-left" | "inward-right" | "none";
}

export interface CatalogueReference {
  productId: string;
  productVersion: string;
}

export interface DesignItemPlacement {
  itemId: string;
  displayName: string;
  catalogueReference?: CatalogueReference;
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
  rotationDeg: RotationDeg;
  clearance?: ClearanceZone;
}

export interface ClearanceZone {
  widthMm: number;
  depthMm: number;
  direction: WallId;
}

export interface SpaceGeometry {
  shape: "rectangle";
  widthMm: number;
  depthMm: number;
  wallHeightMm: number;
  openings: Opening[];
}

export interface RenovationSpace {
  spaceId: string;
  name: string;
  spaceType: string;
  geometry: SpaceGeometry;
  items: DesignItemPlacement[];
}

export interface ProjectSnapshot {
  schemaVersion: 2;
  projectId: string;
  revision: number;
  units: "mm";
  spaces: RenovationSpace[];
}

export type GeometryInput = {
  snapshotSchemaVersion?: number;
  space: { widthMm: number; depthMm: number; wallHeightMm?: number };
  openings?: Array<Partial<Opening>>;
  items?: Array<Partial<DesignItemPlacement>>;
};

export type GeometryErrorCode =
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "DIMENSION_MUST_BE_INTEGER_MM"
  | "DIMENSION_MUST_BE_POSITIVE_MM"
  | "OPENING_OUT_OF_BOUNDS"
  | "OPENINGS_OVERLAP"
  | "ITEM_OUT_OF_BOUNDS"
  | "ITEMS_OVERLAP"
  | "CLEARANCE_INVALID"
  | "UNSUPPORTED_ROTATION"
  | "DUPLICATE_ID";

export type GeometryResult =
  | { valid: true; effectiveFootprints?: Array<{ widthMm: number; depthMm: number }> }
  | { valid: false; errorCode: GeometryErrorCode };

export interface DesignWarning {
  code: "CLEARANCE_OUT_OF_SPACE" | "CLEARANCE_BLOCKED";
  itemId: string;
  relatedItemId?: string;
}

const wallLength = (wall: WallId, space: GeometryInput["space"]): number =>
  wall === "south" || wall === "north" ? space.widthMm : space.depthMm;

const positive = (value: number): boolean => Number.isInteger(value) && value > 0;
const nonNegative = (value: number): boolean => Number.isInteger(value) && value >= 0;

function overlaps(
  a: { xMm: number; yMm: number; widthMm: number; depthMm: number },
  b: { xMm: number; yMm: number; widthMm: number; depthMm: number },
): boolean {
  return a.xMm < b.xMm + b.widthMm && a.xMm + a.widthMm > b.xMm
    && a.yMm < b.yMm + b.depthMm && a.yMm + a.depthMm > b.yMm;
}

export function analyzeClearances(space: Pick<RenovationSpace, "geometry" | "items">): DesignWarning[] {
  const warnings: DesignWarning[] = [];
  for (const item of space.items) {
    if (!item.clearance) continue;
    const size = item.rotationDeg === 90 || item.rotationDeg === 270
      ? { widthMm: item.depthMm, depthMm: item.widthMm }
      : { widthMm: item.widthMm, depthMm: item.depthMm };
    const zone = item.clearance;
    const centeredX = item.xMm + Math.floor((size.widthMm - zone.widthMm) / 2);
    const centeredY = item.yMm + Math.floor((size.depthMm - zone.widthMm) / 2);
    const box = zone.direction === "north"
      ? { x: centeredX, y: item.yMm + size.depthMm, width: zone.widthMm, depth: zone.depthMm }
      : zone.direction === "south"
        ? { x: centeredX, y: item.yMm - zone.depthMm, width: zone.widthMm, depth: zone.depthMm }
        : zone.direction === "east"
          ? { x: item.xMm + size.widthMm, y: centeredY, width: zone.depthMm, depth: zone.widthMm }
          : { x: item.xMm - zone.depthMm, y: centeredY, width: zone.depthMm, depth: zone.widthMm };
    if (box.x < 0 || box.y < 0 || box.x + box.width > space.geometry.widthMm || box.y + box.depth > space.geometry.depthMm) {
      warnings.push({ code: "CLEARANCE_OUT_OF_SPACE", itemId: item.itemId });
    }
    for (const other of space.items) {
      if (other.itemId === item.itemId) continue;
      const otherSize = other.rotationDeg === 90 || other.rotationDeg === 270
        ? { widthMm: other.depthMm, depthMm: other.widthMm }
        : { widthMm: other.widthMm, depthMm: other.depthMm };
      if (overlaps(
        { xMm: box.x, yMm: box.y, widthMm: box.width, depthMm: box.depth },
        { xMm: other.xMm, yMm: other.yMm, widthMm: otherSize.widthMm, depthMm: otherSize.depthMm },
      )) {
        warnings.push({ code: "CLEARANCE_BLOCKED", itemId: item.itemId, relatedItemId: other.itemId });
      }
    }
  }
  return warnings;
}

export function validateGeometry(input: GeometryInput): GeometryResult {
  if (input.snapshotSchemaVersion !== undefined && input.snapshotSchemaVersion !== 2) {
    return { valid: false, errorCode: "UNSUPPORTED_SCHEMA_VERSION" };
  }

  const dimensions = [input.space.widthMm, input.space.depthMm];
  if (input.space.wallHeightMm !== undefined) dimensions.push(input.space.wallHeightMm);
  for (const opening of input.openings ?? []) {
    for (const value of [opening.offsetMm, opening.widthMm, opening.heightMm, opening.sillHeightMm]) {
      if (value !== undefined) dimensions.push(value);
    }
  }
  for (const item of input.items ?? []) {
    for (const value of [item.xMm, item.yMm, item.widthMm, item.depthMm]) {
      if (value !== undefined) dimensions.push(value);
    }
    if (item.clearance) dimensions.push(item.clearance.widthMm, item.clearance.depthMm);
  }
  if (dimensions.some((value) => !Number.isInteger(value))) {
    return { valid: false, errorCode: "DIMENSION_MUST_BE_INTEGER_MM" };
  }
  if (!positive(input.space.widthMm) || !positive(input.space.depthMm)
    || (input.space.wallHeightMm !== undefined && !positive(input.space.wallHeightMm))) {
    return { valid: false, errorCode: "DIMENSION_MUST_BE_POSITIVE_MM" };
  }

  const openings = input.openings ?? [];
  for (const opening of openings) {
    if (!(opening.wall === "south" || opening.wall === "east" || opening.wall === "north" || opening.wall === "west")
      || !(opening.kind === "door" || opening.kind === "window")
      || !nonNegative(opening.offsetMm ?? -1) || !positive(opening.widthMm ?? 0)) {
      return { valid: false, errorCode: "OPENING_OUT_OF_BOUNDS" };
    }
    if (opening.offsetMm! + opening.widthMm! > wallLength(opening.wall, input.space)) {
      return { valid: false, errorCode: "OPENING_OUT_OF_BOUNDS" };
    }
    if (opening.heightMm !== undefined) {
      const sill = opening.kind === "window" ? opening.sillHeightMm : 0;
      if (!positive(opening.heightMm) || (opening.kind === "window" && !nonNegative(sill ?? -1))
        || (input.space.wallHeightMm !== undefined && (sill ?? 0) + opening.heightMm > input.space.wallHeightMm)) {
        return { valid: false, errorCode: "OPENING_OUT_OF_BOUNDS" };
      }
    }
  }
  for (let i = 0; i < openings.length; i += 1) {
    for (let j = i + 1; j < openings.length; j += 1) {
      const a = openings[i]!, b = openings[j]!;
      if (a.wall === b.wall && a.offsetMm! < b.offsetMm! + b.widthMm! && a.offsetMm! + a.widthMm! > b.offsetMm!) {
        return { valid: false, errorCode: "OPENINGS_OVERLAP" };
      }
    }
  }

  const items = input.items ?? [];
  const boxes = [] as Array<{ xMm: number; yMm: number; widthMm: number; depthMm: number }>;
  const effectiveFootprints = [] as Array<{ widthMm: number; depthMm: number }>;
  for (const item of items) {
    if (item.rotationDeg !== 0 && item.rotationDeg !== 90 && item.rotationDeg !== 180 && item.rotationDeg !== 270) {
      return { valid: false, errorCode: "UNSUPPORTED_ROTATION" };
    }
    if (!Number.isInteger(item.xMm) || !Number.isInteger(item.yMm)
      || !positive(item.widthMm ?? 0) || !positive(item.depthMm ?? 0)) {
      return { valid: false, errorCode: "ITEM_OUT_OF_BOUNDS" };
    }
    if (item.clearance && (!positive(item.clearance.widthMm) || !positive(item.clearance.depthMm)
      || !["south", "east", "north", "west"].includes(item.clearance.direction))) {
      return { valid: false, errorCode: "CLEARANCE_INVALID" };
    }
    const quarterTurn = item.rotationDeg === 90 || item.rotationDeg === 270;
    const widthMm = quarterTurn ? item.depthMm! : item.widthMm!;
    const depthMm = quarterTurn ? item.widthMm! : item.depthMm!;
    const box = { xMm: item.xMm!, yMm: item.yMm!, widthMm, depthMm };
    if (box.xMm < 0 || box.yMm < 0 || box.xMm + widthMm > input.space.widthMm || box.yMm + depthMm > input.space.depthMm) {
      return { valid: false, errorCode: "ITEM_OUT_OF_BOUNDS" };
    }
    if (boxes.some((previous) => overlaps(previous, box))) {
      return { valid: false, errorCode: "ITEMS_OVERLAP" };
    }
    boxes.push(box);
    effectiveFootprints.push({ widthMm, depthMm });
  }
  return { valid: true, effectiveFootprints };
}

export function validateProject(project: ProjectSnapshot): GeometryResult {
  const spaceIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const space of project.spaces) {
    if (spaceIds.has(space.spaceId)) return { valid: false, errorCode: "DUPLICATE_ID" };
    spaceIds.add(space.spaceId);
    for (const item of space.items) {
      if (itemIds.has(item.itemId)) return { valid: false, errorCode: "DUPLICATE_ID" };
      itemIds.add(item.itemId);
    }
    const result = validateGeometry({
      snapshotSchemaVersion: project.schemaVersion,
      space: space.geometry,
      openings: space.geometry.openings,
      items: space.items,
    });
    if (!result.valid) return result;
  }
  return { valid: true };
}
