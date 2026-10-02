import {
  validateGeometry,
  type DesignSnapshot,
  type GeometryErrorCode,
  type Opening,
  type ProductPlacement,
  type Room,
} from "../domain/design.ts";

export type DesignCommand =
  | { type: "set-room"; room: Room; expectedRevision: number }
  | { type: "upsert-opening"; opening: Opening; expectedRevision: number }
  | { type: "remove-opening"; openingId: string; expectedRevision: number }
  | { type: "place-product"; placement: ProductPlacement; expectedRevision: number }
  | { type: "move-product"; placementId: string; xMm: number; yMm: number; expectedRevision: number }
  | { type: "rotate-product"; placementId: string; rotationDeg: ProductPlacement["rotationDeg"]; expectedRevision: number }
  | { type: "remove-product"; placementId: string; expectedRevision: number };

export type CommandResult =
  | { ok: true; snapshot: DesignSnapshot }
  | { ok: false; errorCode: GeometryErrorCode | "STALE_REVISION" | "ENTITY_NOT_FOUND" | "DUPLICATE_ID" };

export interface DesignRepository {
  load(): DesignSnapshot | null;
  save(snapshot: DesignSnapshot): void;
}

const copy = (value: DesignSnapshot): DesignSnapshot => structuredClone(value);

export class DesignSession {
  private current: DesignSnapshot;
  private past: DesignSnapshot[] = [];
  private future: DesignSnapshot[] = [];

  constructor(initial: DesignSnapshot) {
    this.current = copy(initial);
  }

  get snapshot(): DesignSnapshot {
    return copy(this.current);
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  execute(command: DesignCommand): CommandResult {
    if (command.expectedRevision !== this.current.revision) return { ok: false, errorCode: "STALE_REVISION" };
    const candidate = copy(this.current);

    switch (command.type) {
      case "set-room":
        candidate.room = copy(command.room);
        break;
      case "upsert-opening": {
        const index = candidate.room.openings.findIndex((opening) => opening.openingId === command.opening.openingId);
        if (index < 0) candidate.room.openings.push(copy(command.opening));
        else candidate.room.openings[index] = copy(command.opening);
        break;
      }
      case "remove-opening": {
        const previous = candidate.room.openings.length;
        candidate.room.openings = candidate.room.openings.filter((opening) => opening.openingId !== command.openingId);
        if (candidate.room.openings.length === previous) return { ok: false, errorCode: "ENTITY_NOT_FOUND" };
        break;
      }
      case "place-product":
        if (candidate.placements.some((item) => item.placementId === command.placement.placementId)) return { ok: false, errorCode: "DUPLICATE_ID" };
        candidate.placements.push(copy(command.placement));
        break;
      case "move-product": {
        const item = candidate.placements.find((placement) => placement.placementId === command.placementId);
        if (!item) return { ok: false, errorCode: "ENTITY_NOT_FOUND" };
        item.xMm = command.xMm;
        item.yMm = command.yMm;
        break;
      }
      case "rotate-product": {
        const item = candidate.placements.find((placement) => placement.placementId === command.placementId);
        if (!item) return { ok: false, errorCode: "ENTITY_NOT_FOUND" };
        item.rotationDeg = command.rotationDeg;
        break;
      }
      case "remove-product": {
        const previous = candidate.placements.length;
        candidate.placements = candidate.placements.filter((item) => item.placementId !== command.placementId);
        if (candidate.placements.length === previous) return { ok: false, errorCode: "ENTITY_NOT_FOUND" };
        break;
      }
    }

    const validation = validateGeometry({
      room: candidate.room,
      openings: candidate.room.openings,
      placements: candidate.placements,
    });
    if (!validation.valid) return { ok: false, errorCode: validation.errorCode };
    this.past.push(this.current);
    this.current = { ...candidate, revision: this.current.revision + 1 };
    this.future = [];
    return { ok: true, snapshot: this.snapshot };
  }

  undo(): DesignSnapshot | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(this.current);
    this.current = { ...copy(previous), revision: this.current.revision + 1 };
    return this.snapshot;
  }

  redo(): DesignSnapshot | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(this.current);
    this.current = { ...copy(next), revision: this.current.revision + 1 };
    return this.snapshot;
  }
}

export function newDesign(): DesignSnapshot {
  return {
    schemaVersion: 1,
    designId: crypto.randomUUID(),
    revision: 0,
    units: "mm",
    room: { shape: "rectangle", widthMm: 2400, depthMm: 3000, wallHeightMm: 2400, openings: [] },
    placements: [],
  };
}
