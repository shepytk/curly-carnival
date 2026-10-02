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

export interface ProductPlacement {
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

export interface ClearanceZone {
  widthMm: number;
  depthMm: number;
  direction: WallId;
}

export interface Room {
  shape: "rectangle";
  widthMm: number;
  depthMm: number;
  wallHeightMm: number;
  openings: Opening[];
}

export interface DesignSnapshot {
  schemaVersion: 1;
  designId: string;
  revision: number;
  units: "mm";
  room: Room;
  placements: ProductPlacement[];
}

export type GeometryInput = {
  snapshotSchemaVersion?: number;
  room: { widthMm: number; depthMm: number; wallHeightMm?: number };
  openings?: Array<Partial<Opening>>;
  placements?: Array<Partial<ProductPlacement>>;
};

export type GeometryErrorCode =
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "DIMENSION_MUST_BE_INTEGER_MM"
  | "DIMENSION_MUST_BE_POSITIVE_MM"
  | "OPENING_OUT_OF_BOUNDS"
  | "OPENINGS_OVERLAP"
  | "PLACEMENT_OUT_OF_BOUNDS"
  | "PLACEMENTS_OVERLAP"
  | "CLEARANCE_INVALID"
  | "UNSUPPORTED_ROTATION";

export type GeometryResult =
  | { valid: true; effectiveFootprints?: Array<{ widthMm: number; depthMm: number }> }
  | { valid: false; errorCode: GeometryErrorCode };

export interface DesignWarning {
  code: "CLEARANCE_OUT_OF_ROOM" | "CLEARANCE_BLOCKED";
  placementId: string;
  relatedPlacementId?: string;
}

const wallLength = (wall: WallId, room: GeometryInput["room"]): number =>
  wall === "south" || wall === "north" ? room.widthMm : room.depthMm;

const positive = (value: number): boolean => Number.isInteger(value) && value > 0;
const nonNegative = (value: number): boolean => Number.isInteger(value) && value >= 0;

function overlaps(
  a: { xMm: number; yMm: number; widthMm: number; depthMm: number },
  b: { xMm: number; yMm: number; widthMm: number; depthMm: number },
): boolean {
  return a.xMm < b.xMm + b.widthMm && a.xMm + a.widthMm > b.xMm
    && a.yMm < b.yMm + b.depthMm && a.yMm + a.depthMm > b.yMm;
}

export function analyzeClearances(snapshot: Pick<DesignSnapshot, "room" | "placements">): DesignWarning[] {
  const warnings: DesignWarning[] = [];
  for (const item of snapshot.placements) {
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
    if (box.x < 0 || box.y < 0 || box.x + box.width > snapshot.room.widthMm || box.y + box.depth > snapshot.room.depthMm) {
      warnings.push({ code: "CLEARANCE_OUT_OF_ROOM", placementId: item.placementId });
    }
    for (const other of snapshot.placements) {
      if (other.placementId === item.placementId) continue;
      const otherSize = other.rotationDeg === 90 || other.rotationDeg === 270
        ? { widthMm: other.depthMm, depthMm: other.widthMm }
        : { widthMm: other.widthMm, depthMm: other.depthMm };
      if (overlaps({ xMm: box.x, yMm: box.y, widthMm: box.width, depthMm: box.depth }, { xMm: other.xMm, yMm: other.yMm, widthMm: otherSize.widthMm, depthMm: otherSize.depthMm })) {
        warnings.push({ code: "CLEARANCE_BLOCKED", placementId: item.placementId, relatedPlacementId: other.placementId });
      }
    }
  }
  return warnings;
}

export function validateGeometry(input: GeometryInput): GeometryResult {
  if (input.snapshotSchemaVersion !== undefined && input.snapshotSchemaVersion !== 1) {
    return { valid: false, errorCode: "UNSUPPORTED_SCHEMA_VERSION" };
  }

  const dimensions = [input.room.widthMm, input.room.depthMm];
  if (input.room.wallHeightMm !== undefined) dimensions.push(input.room.wallHeightMm);
  for (const opening of input.openings ?? []) {
    for (const value of [opening.offsetMm, opening.widthMm, opening.heightMm, opening.sillHeightMm]) {
      if (value !== undefined) dimensions.push(value);
    }
  }
  for (const placement of input.placements ?? []) {
    for (const value of [placement.xMm, placement.yMm, placement.widthMm, placement.depthMm]) {
      if (value !== undefined) dimensions.push(value);
    }
  }
  if (dimensions.some((value) => !Number.isInteger(value))) {
    return { valid: false, errorCode: "DIMENSION_MUST_BE_INTEGER_MM" };
  }
  if (!positive(input.room.widthMm) || !positive(input.room.depthMm)
    || (input.room.wallHeightMm !== undefined && !positive(input.room.wallHeightMm))) {
    return { valid: false, errorCode: "DIMENSION_MUST_BE_POSITIVE_MM" };
  }

  const openings = input.openings ?? [];
  for (const opening of openings) {
    if (!("south" === opening.wall || "east" === opening.wall || "north" === opening.wall || "west" === opening.wall)
      || !(opening.kind === "door" || opening.kind === "window")
      || !nonNegative(opening.offsetMm ?? -1) || !positive(opening.widthMm ?? 0)) {
      return { valid: false, errorCode: "OPENING_OUT_OF_BOUNDS" };
    }
    if (opening.offsetMm! + opening.widthMm! > wallLength(opening.wall, input.room)) {
      return { valid: false, errorCode: "OPENING_OUT_OF_BOUNDS" };
    }
    if (opening.heightMm !== undefined) {
      const sill = opening.kind === "window" ? opening.sillHeightMm : 0;
      if (!positive(opening.heightMm) || (opening.kind === "window" && !nonNegative(sill ?? -1))
        || (input.room.wallHeightMm !== undefined && (sill ?? 0) + opening.heightMm > input.room.wallHeightMm)) {
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

  const placements = input.placements ?? [];
  const boxes = [] as Array<{ xMm: number; yMm: number; widthMm: number; depthMm: number }>;
  const effectiveFootprints = [] as Array<{ widthMm: number; depthMm: number }>;
  for (const item of placements) {
    if (item.rotationDeg !== 0 && item.rotationDeg !== 90 && item.rotationDeg !== 180 && item.rotationDeg !== 270) {
      return { valid: false, errorCode: "UNSUPPORTED_ROTATION" };
    }
    if (!Number.isInteger(item.xMm) || !Number.isInteger(item.yMm)
      || !positive(item.widthMm ?? 0) || !positive(item.depthMm ?? 0)) {
      return { valid: false, errorCode: "PLACEMENT_OUT_OF_BOUNDS" };
    }
    if (item.clearance && (!positive(item.clearance.widthMm) || !positive(item.clearance.depthMm)
      || !["south", "east", "north", "west"].includes(item.clearance.direction))) {
      return { valid: false, errorCode: "CLEARANCE_INVALID" };
    }
    const quarterTurn = item.rotationDeg === 90 || item.rotationDeg === 270;
    const widthMm = quarterTurn ? item.depthMm! : item.widthMm!;
    const depthMm = quarterTurn ? item.widthMm! : item.depthMm!;
    const box = { xMm: item.xMm!, yMm: item.yMm!, widthMm, depthMm };
    if (box.xMm < 0 || box.yMm < 0 || box.xMm + widthMm > input.room.widthMm || box.yMm + depthMm > input.room.depthMm) {
      return { valid: false, errorCode: "PLACEMENT_OUT_OF_BOUNDS" };
    }
    if (boxes.some((previous) => overlaps(previous, box))) {
      return { valid: false, errorCode: "PLACEMENTS_OVERLAP" };
    }
    boxes.push(box);
    effectiveFootprints.push({ widthMm, depthMm });
  }
  return { valid: true, effectiveFootprints };
}
