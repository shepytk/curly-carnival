import type { DesignLoadResult, DesignRepository } from "../application/design-session.ts";
import type { DesignSnapshot } from "../domain/design.ts";
import { parseDesignSnapshot } from "../domain/snapshot-schema.ts";

const STORAGE_KEY = "room-design-studio:current-design:v1";

export class LocalDesignRepository implements DesignRepository {
  constructor(private readonly storageProvider: () => Storage = () => window.localStorage) {}

  load(): DesignLoadResult {
    let raw: string | null;
    try {
      raw = this.storageProvider().getItem(STORAGE_KEY);
    } catch {
      return { status: "unavailable" };
    }
    try {
      if (raw === null) return { status: "empty" };
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        return { status: "invalid", raw, reason: "invalid-json" };
      }
      const snapshot = parseDesignSnapshot(value);
      return snapshot ? { status: "valid", snapshot } : { status: "invalid", raw, reason: "unsupported-or-invalid-design" };
    } catch {
      return { status: "invalid", raw: raw ?? "", reason: "unsupported-or-invalid-design" };
    }
  }

  save(snapshot: DesignSnapshot): void {
    this.storageProvider().setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  backupUnreadable(raw: string): void {
    if (!raw) throw new Error("The unreadable design could not be read for backup.");
    this.storageProvider().setItem(`${STORAGE_KEY}:recovery:${Date.now()}`, raw);
  }
}
