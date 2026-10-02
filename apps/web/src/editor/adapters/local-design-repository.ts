import type { DesignRepository } from "../application/design-session.ts";
import type { DesignSnapshot } from "../domain/design.ts";
import { parseDesignSnapshot } from "../domain/snapshot-schema.ts";

const STORAGE_KEY = "room-design-studio:current-design:v1";

export class LocalDesignRepository implements DesignRepository {
  constructor(private readonly storage: Storage = window.localStorage) {}

  load(): DesignSnapshot | null {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return parseDesignSnapshot(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  save(snapshot: DesignSnapshot): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }
}
