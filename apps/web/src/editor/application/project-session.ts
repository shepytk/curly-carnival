import {
  validateProject,
  type DesignItemPlacement,
  type GeometryErrorCode,
  type Opening,
  type ProjectSnapshot,
  type RenovationSpace,
  type SpaceGeometry,
} from "../domain/design.ts";

export type ProjectCommand =
  | { type: "set-space"; space: RenovationSpace; expectedRevision: number }
  | { type: "upsert-opening"; spaceId: string; opening: Opening; expectedRevision: number }
  | { type: "remove-opening"; spaceId: string; openingId: string; expectedRevision: number }
  | { type: "place-item"; spaceId: string; item: DesignItemPlacement; expectedRevision: number }
  | { type: "move-item"; spaceId: string; itemId: string; xMm: number; yMm: number; expectedRevision: number }
  | { type: "rotate-item"; spaceId: string; itemId: string; rotationDeg: DesignItemPlacement["rotationDeg"]; expectedRevision: number }
  | { type: "remove-item"; spaceId: string; itemId: string; expectedRevision: number };

export type CommandResult =
  | { ok: true; project: ProjectSnapshot }
  | { ok: false; errorCode: GeometryErrorCode | "STALE_REVISION" | "ENTITY_NOT_FOUND" | "DUPLICATE_ID" };

export type ProjectLoadResult =
  | { status: "empty" }
  | { status: "valid"; project: ProjectSnapshot; migratedFromV1?: true }
  | { status: "unavailable" }
  | { status: "invalid"; raw: string; sourceKey: string; reason: "invalid-json" | "unsupported-or-invalid-project" };

export interface ProjectRepository {
  load(): ProjectLoadResult;
  save(project: ProjectSnapshot): void;
}

const copy = <T>(value: T): T => structuredClone(value);

export class ProjectSession {
  private current: ProjectSnapshot;
  private past: ProjectSnapshot[] = [];
  private future: ProjectSnapshot[] = [];

  constructor(initial: ProjectSnapshot) {
    this.current = copy(initial);
  }

  get project(): ProjectSnapshot {
    return copy(this.current);
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  execute(command: ProjectCommand): CommandResult {
    if (command.expectedRevision !== this.current.revision) return { ok: false, errorCode: "STALE_REVISION" };
    const candidate = copy(this.current);

    if (command.type === "set-space") {
      const index = candidate.spaces.findIndex((space) => space.spaceId === command.space.spaceId);
      if (index < 0) return { ok: false, errorCode: "ENTITY_NOT_FOUND" };
      candidate.spaces[index] = copy(command.space);
    } else {
      const space = candidate.spaces.find((entry) => entry.spaceId === command.spaceId);
      if (!space) return { ok: false, errorCode: "ENTITY_NOT_FOUND" };

      switch (command.type) {
        case "upsert-opening": {
          const index = space.geometry.openings.findIndex((opening) => opening.openingId === command.opening.openingId);
          if (index < 0) space.geometry.openings.push(copy(command.opening));
          else space.geometry.openings[index] = copy(command.opening);
          break;
        }
        case "remove-opening": {
          const previous = space.geometry.openings.length;
          space.geometry.openings = space.geometry.openings.filter((opening) => opening.openingId !== command.openingId);
          if (space.geometry.openings.length === previous) return { ok: false, errorCode: "ENTITY_NOT_FOUND" };
          break;
        }
        case "place-item":
          if (candidate.spaces.some((entry) => entry.items.some((item) => item.itemId === command.item.itemId))) {
            return { ok: false, errorCode: "DUPLICATE_ID" };
          }
          space.items.push(copy(command.item));
          break;
        case "move-item": {
          const item = space.items.find((entry) => entry.itemId === command.itemId);
          if (!item) return { ok: false, errorCode: "ENTITY_NOT_FOUND" };
          item.xMm = command.xMm;
          item.yMm = command.yMm;
          break;
        }
        case "rotate-item": {
          const item = space.items.find((entry) => entry.itemId === command.itemId);
          if (!item) return { ok: false, errorCode: "ENTITY_NOT_FOUND" };
          item.rotationDeg = command.rotationDeg;
          break;
        }
        case "remove-item": {
          const previous = space.items.length;
          space.items = space.items.filter((entry) => entry.itemId !== command.itemId);
          if (space.items.length === previous) return { ok: false, errorCode: "ENTITY_NOT_FOUND" };
          break;
        }
      }
    }

    const validation = validateProject(candidate);
    if (!validation.valid) return { ok: false, errorCode: validation.errorCode };
    this.past.push(this.current);
    this.current = { ...candidate, revision: this.current.revision + 1 };
    this.future = [];
    return { ok: true, project: this.project };
  }

  undo(): ProjectSnapshot | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(this.current);
    this.current = { ...copy(previous), revision: this.current.revision + 1 };
    return this.project;
  }

  redo(): ProjectSnapshot | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(this.current);
    this.current = { ...copy(next), revision: this.current.revision + 1 };
    return this.project;
  }
}

export function newBathroomProject(geometry: SpaceGeometry): ProjectSnapshot {
  return {
    schemaVersion: 2,
    projectId: crypto.randomUUID(),
    revision: 0,
    units: "mm",
    spaces: [{
      spaceId: crypto.randomUUID(),
      name: "Bathroom",
      spaceType: "bathroom",
      geometry,
      items: [],
    }],
  };
}
