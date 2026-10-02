import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { DesignSession, newDesign, type DesignCommand } from "./application/design-session.ts";
import { LocalDesignRepository } from "./adapters/local-design-repository.ts";
import { PlanRenderer } from "./adapters/PlanRenderer.tsx";
import type { DesignSnapshot, Opening, ProductPlacement } from "./domain/design.ts";

type RequestedCommand<T = DesignCommand> = T extends { expectedRevision: number } ? Omit<T, "expectedRevision"> : never;

const explainError = (code: string): string => {
  const copy: Record<string, string> = {
    PLACEMENT_OUT_OF_BOUNDS: "That fixture does not fit inside the room. Move it fully within the walls.",
    PLACEMENTS_OVERLAP: "That fixture overlaps another fixture. Move it to a clear area.",
    OPENING_OUT_OF_BOUNDS: "That opening does not fit on the selected wall.",
    OPENINGS_OVERLAP: "That opening overlaps another opening on the same wall.",
    DIMENSION_MUST_BE_INTEGER_MM: "Enter whole millimetres only.",
    DIMENSION_MUST_BE_POSITIVE_MM: "Room dimensions must be greater than zero.",
    STALE_REVISION: "The design changed before this edit was applied. Reopen the saved design and try again.",
    ENTITY_NOT_FOUND: "The selected item is no longer in the design.",
    DUPLICATE_ID: "That item is already in the design.",
  };
  return copy[code] ?? `The design change was rejected (${code}).`;
};

function initialize(repository: LocalDesignRepository): DesignSnapshot {
  return repository.load() ?? newDesign();
}

export function RoomEditor() {
  const repository = useMemo(() => new LocalDesignRepository(), []);
  const initial = useMemo(() => initialize(repository), [repository]);
  const sessionRef = useRef<DesignSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new DesignSession(initial);
  const [snapshot, setSnapshot] = useState(initial);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [status, setStatus] = useState("Design ready. Measurements are in millimetres.");
  const [error, setError] = useState("");
  const [positionDraft, setPositionDraft] = useState({ xMm: 0, yMm: 0 });
  const selectedPlacement = snapshot.placements.find((item) => item.placementId === selectedPlacementId) ?? null;

  useEffect(() => {
    try {
      repository.save(snapshot);
    } catch {
      setStatus("This browser could not save the design. Check available local storage.");
    }
  }, [repository, snapshot]);

  useEffect(() => {
    if (selectedPlacement) setPositionDraft({ xMm: selectedPlacement.xMm, yMm: selectedPlacement.yMm });
  }, [selectedPlacement?.placementId, selectedPlacement?.xMm, selectedPlacement?.yMm]);

  const dispatch = (command: RequestedCommand) => {
    const result = sessionRef.current!.execute({ ...command, expectedRevision: snapshot.revision } as DesignCommand);
    if (!result.ok) {
      setError(explainError(result.errorCode));
      setStatus("Design change was not applied.");
      return false;
    }
    setSnapshot(result.snapshot);
    setError("");
    setStatus(`Saved locally · revision ${result.snapshot.revision}`);
    return true;
  };

  const addOpening = (kind: Opening["kind"]) => {
    const widthMm = kind === "door" ? 800 : 900;
    const opening: Opening = kind === "door"
      ? { openingId: crypto.randomUUID(), kind, wall: "south", offsetMm: 100, widthMm, heightMm: 2000, swing: "inward-left" }
      : { openingId: crypto.randomUUID(), kind, wall: "north", offsetMm: 400, widthMm, heightMm: 900, sillHeightMm: 900 };
    dispatch({ type: "upsert-opening", opening });
  };

  const addFixture = (kind: "vanity" | "shower") => {
    const shower = kind === "shower";
    const placement: ProductPlacement = {
      placementId: crypto.randomUUID(),
      productId: shower ? "shower-proxy-v1" : "vanity-proxy-v1",
      productVersion: "proxy-v1",
      xMm: shower ? Math.max(0, snapshot.room.widthMm - 950) : 50,
      yMm: shower ? Math.max(0, snapshot.room.depthMm - 950) : 50,
      widthMm: shower ? 900 : 1000,
      depthMm: shower ? 900 : 500,
      rotationDeg: 0,
    };
    if (dispatch({ type: "place-product", placement })) setSelectedPlacementId(placement.placementId);
  };

  const submitRoomDimensions = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const room = {
      ...snapshot.room,
      widthMm: Number(form.get("widthMm")),
      depthMm: Number(form.get("depthMm")),
    };
    dispatch({ type: "set-room", room });
  };

  const submitPosition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPlacement) return;
    dispatch({ type: "move-product", placementId: selectedPlacement.placementId, ...positionDraft });
  };

  const setHistorySnapshot = (next: DesignSnapshot | null, verb: string) => {
    if (!next) return;
    setSnapshot(next);
    setError("");
    setStatus(`${verb} · revision ${next.revision}`);
  };

  const reopen = () => {
    const saved = repository.load();
    if (!saved) {
      setError("There is no saved design in this browser yet.");
      return;
    }
    sessionRef.current = new DesignSession(saved);
    setSnapshot(saved);
    setSelectedPlacementId(null);
    setError("");
    setStatus("Saved design reopened from this browser.");
  };

  const startNew = () => {
    const fresh = newDesign();
    sessionRef.current = new DesignSession(fresh);
    setSnapshot(fresh);
    setSelectedPlacementId(null);
    setError("");
    setStatus("New bathroom design started.");
  };

  const removeOpening = (opening: Opening) => dispatch({ type: "remove-opening", openingId: opening.openingId });

  return (
    <main className="studio-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Room Design Studio home">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>room<span className="brand-light">form</span></span>
        </a>
        <div className="topbar-meta"><span className="save-dot" /> Saved on this device</div>
        <div className="topbar-actions">
          <button className="button button-quiet" onClick={reopen}>Reopen saved</button>
          <button className="button button-quiet" onClick={startNew}>New design</button>
          <button className="button button-primary" onClick={() => { try { repository.save(snapshot); setError(""); setStatus("Design saved on this device."); } catch { setError("Could not save to this browser."); } }}>Save design</button>
        </div>
      </header>

      <div className="workspace-heading">
        <div>
          <p className="eyebrow">HOME BATHROOM PLANNER · 2D EDITOR</p>
          <h1>Plan your bathroom</h1>
          <p className="lede">Set the room measurements, add openings and try fixture positions to scale.</p>
        </div>
        <div className="revision-chip">Design v1 <span>·</span> {snapshot.revision === 0 ? "Draft" : `Revision ${snapshot.revision}`}</div>
      </div>

      <div className="workspace-grid">
        <aside className="sidebar" aria-label="Design controls">
          <section className="panel-section">
            <div className="section-heading"><span className="step-number">01</span><h2>Room size</h2></div>
            <form key={`${snapshot.room.widthMm}-${snapshot.room.depthMm}`} className="dimension-form" onSubmit={submitRoomDimensions}>
              <label>Width <span>mm</span><input name="widthMm" type="number" min="1" step="1" defaultValue={snapshot.room.widthMm} /></label>
              <label>Depth <span>mm</span><input name="depthMm" type="number" min="1" step="1" defaultValue={snapshot.room.depthMm} /></label>
              <button className="button button-outline" type="submit">Update room</button>
            </form>
          </section>

          <section className="panel-section">
            <div className="section-heading"><span className="step-number">02</span><h2>Openings</h2></div>
            <div className="button-row">
              <button className="button button-outline" onClick={() => addOpening("door")}>＋ Door</button>
              <button className="button button-outline" onClick={() => addOpening("window")}>＋ Window</button>
            </div>
            {snapshot.room.openings.length > 0 ? (
              <ul className="item-list" aria-label="Room openings">
                {snapshot.room.openings.map((opening) => (
                  <li key={opening.openingId}>
                    <span className={`item-indicator ${opening.kind}`} />
                    <span>{opening.kind === "door" ? "Door" : "Window"}<small>{opening.wall} wall · {opening.widthMm} mm</small></span>
                    <button className="icon-button" aria-label={`Remove ${opening.kind}`} onClick={() => removeOpening(opening)}>×</button>
                  </li>
                ))}
              </ul>
            ) : <p className="helper-copy">Add doors and windows to show where fixtures can go.</p>}
          </section>

          <section className="panel-section">
            <div className="section-heading"><span className="step-number">03</span><h2>Fixtures</h2></div>
            <div className="catalogue-list">
              <button className="catalogue-card vanity-card" onClick={() => addFixture("vanity")}>
                <span className="catalogue-icon vanity-icon" aria-hidden="true">▱</span>
                <span><strong>Vanity</strong><small>1000 × 500 mm</small></span><span className="add-mark">＋</span>
              </button>
              <button className="catalogue-card shower-card" onClick={() => addFixture("shower")}>
                <span className="catalogue-icon shower-icon" aria-hidden="true">▦</span>
                <span><strong>Shower</strong><small>900 × 900 mm</small></span><span className="add-mark">＋</span>
              </button>
            </div>
            <p className="helper-copy">Simple, dimensionally accurate proxies for this first slice.</p>
            <ul className="item-list fixture-list" aria-label="Placed fixtures">
              {snapshot.placements.map((item) => {
                const label = item.productId.includes("shower") ? "Shower" : "Vanity";
                return <li key={item.placementId}>
                  <span className={`item-indicator ${label === "Shower" ? "window" : "door"}`} />
                  <button className="fixture-select" aria-pressed={selectedPlacementId === item.placementId} onClick={() => setSelectedPlacementId(item.placementId)}>
                    {label}<small>{item.xMm}, {item.yMm} mm · {item.rotationDeg}°</small>
                  </button>
                </li>;
              })}
            </ul>
          </section>

          {selectedPlacement && <section className="panel-section selected-section">
            <div className="section-heading"><span className="step-number">04</span><h2>Selected fixture</h2></div>
            <form className="position-form" onSubmit={submitPosition}>
              <label>X position (mm)<input type="number" step="1" value={positionDraft.xMm} onChange={(event) => setPositionDraft({ ...positionDraft, xMm: Number(event.target.value) })} /></label>
              <label>Y position (mm)<input type="number" step="1" value={positionDraft.yMm} onChange={(event) => setPositionDraft({ ...positionDraft, yMm: Number(event.target.value) })} /></label>
              <button className="button button-outline" type="submit">Apply position</button>
            </form>
            <div className="button-row selected-actions">
              <button className="button button-outline" onClick={() => dispatch({ type: "rotate-product", placementId: selectedPlacement.placementId, rotationDeg: ((selectedPlacement.rotationDeg + 90) % 360) as ProductPlacement["rotationDeg"] })}>Rotate 90°</button>
              <button className="button button-danger" onClick={() => { if (dispatch({ type: "remove-product", placementId: selectedPlacement.placementId })) setSelectedPlacementId(null); }}>Remove</button>
            </div>
          </section>}
        </aside>

        <section className="canvas-panel" aria-label="Room plan">
          <div className="canvas-toolbar">
            <div className="view-tabs"><button className="view-tab active" aria-current="page">2D Plan</button><button className="view-tab" disabled title="3D preview is planned for Milestone 2">3D Preview <span>Coming next</span></button></div>
            <div className="history-actions">
              <button className="icon-button history-button" aria-label="Undo" disabled={!sessionRef.current!.canUndo} onClick={() => setHistorySnapshot(sessionRef.current!.undo(), "Undid last change")}>↶</button>
              <button className="icon-button history-button" aria-label="Redo" disabled={!sessionRef.current!.canRedo} onClick={() => setHistorySnapshot(sessionRef.current!.redo(), "Redid change")}>↷</button>
            </div>
          </div>
          <div className="canvas-content">
            <PlanRenderer
              snapshot={snapshot}
              selectedPlacementId={selectedPlacementId}
              onSelect={setSelectedPlacementId}
              onMove={(placementId, xMm, yMm) => dispatch({ type: "move-product", placementId, xMm, yMm })}
            />
          </div>
          <div className="canvas-footer">
            <div className="legend"><span><i className="legend-door" /> Door</span><span><i className="legend-window" /> Window</span><span><i className="legend-fixture" /> Fixtures</span></div>
            <span className="scale-note">Scale preview · all dimensions in mm</span>
          </div>
        </section>
      </div>

      <footer className="statusbar" role="status" aria-live="polite">
        <span className="status-check" aria-hidden="true">✓</span>{status}
        <span className="status-right">Autosaved locally</span>
      </footer>
      {error && <div className="toast-error" role="alert">{error}</div>}
    </main>
  );
}
