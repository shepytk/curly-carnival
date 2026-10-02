import type { ProjectLoadResult, ProjectRepository } from "../application/project-session.ts";
import type { ProjectSnapshot } from "../domain/design.ts";
import { migrateV1Design, parseProjectSnapshot } from "../domain/snapshot-schema.ts";

export const PROJECT_STORAGE_KEY = "curly-carnival:current-project:v2";
export const LEGACY_DESIGN_STORAGE_KEY = "room-design-studio:current-design:v1";

export class LocalProjectRepository implements ProjectRepository {
  constructor(private readonly storageProvider: () => Storage = () => window.localStorage) {}

  load(): ProjectLoadResult {
    let storage: Storage;
    try {
      storage = this.storageProvider();
    } catch {
      return { status: "unavailable" };
    }

    let raw: string | null;
    let sourceKey = PROJECT_STORAGE_KEY;
    try {
      raw = storage.getItem(PROJECT_STORAGE_KEY);
      if (raw === null) {
        sourceKey = LEGACY_DESIGN_STORAGE_KEY;
        raw = storage.getItem(LEGACY_DESIGN_STORAGE_KEY);
      }
    } catch {
      return { status: "unavailable" };
    }

    if (raw === null) return { status: "empty" };

    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return { status: "invalid", raw, sourceKey, reason: "invalid-json" };
    }

    const project = sourceKey === PROJECT_STORAGE_KEY ? parseProjectSnapshot(value) : migrateV1Design(value);
    if (!project) return { status: "invalid", raw, sourceKey, reason: "unsupported-or-invalid-project" };
    return sourceKey === PROJECT_STORAGE_KEY
      ? { status: "valid", project }
      : { status: "valid", project, migratedFromV1: true };
  }

  save(project: ProjectSnapshot): void {
    this.storageProvider().setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  }

  backupUnreadable(raw: string, sourceKey: string): void {
    if (!raw) throw new Error("The unreadable project could not be read for backup.");
    this.storageProvider().setItem(`${sourceKey}:recovery:${Date.now()}`, raw);
  }
}
