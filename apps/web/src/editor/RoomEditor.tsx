import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { DesignSession, newDesign, type DesignCommand } from "./application/design-session.ts";
import { LocalDesignRepository } from "./adapters/local-design-repository.ts";
import { PlanRenderer } from "./adapters/PlanRenderer.tsx";
import { analyzeClearances, type DesignSnapshot, type Opening, type ProductPlacement, type Room, type WallId } from "./domain/design.ts";

type RequestedCommand<T = DesignCommand> = T extends { expectedRevision: number } ? Omit<T, "expectedRevision"> : never;

const explainError = (code: string): string => {
  const copy: Record<string, string> = {
    PLACEMENT_OUT_OF_BOUNDS: "That fixture does not fit inside the room. Move it fully within the walls.",
    PLACEMENTS_OVERLAP: "That fixture overlaps another fixture. Move it to a clear area.",
    CLEARANCE_INVALID: "Enter positive whole millimetres and a valid direction for the clearance zone.",
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

export function RoomEditor() {
  const repository = useMemo(() => new LocalDesignRepository(), []);
  const [loadResult] = useState(() => repository.load());
  const [snapshot, setSnapshot] = useState<DesignSnapshot | null>(loadResult.status === "valid" ? loadResult.snapshot : null);
  const [recoveryCleared, setRecoveryCleared] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  if (loadResult.status === "invalid" && !recoveryCleared) {
    return <main className="setup-shell"><section className="setup-card"><p className="eyebrow">SAVED DESIGN RECOVERY</p><h1>Saved design needs attention</h1>
      <p>The saved data is unreadable or uses a format this editor cannot open. It has not been replaced.</p>
      {recoveryError && <p role="alert">{recoveryError}</p>}
      <button className="button button-primary" onClick={() => {
        try { repository.backupUnreadable(loadResult.raw); setRecoveryCleared(true); }
        catch { setRecoveryError("Could not back up the unreadable design. Free browser storage and try again."); }
      }}>Back up saved data and start a new design</button>
    </section></main>;
  }
  if (!snapshot) return <NewDesignForm
    notice={loadResult.status === "unavailable" ? "Browser storage is unavailable. You can create a design, but it cannot be saved in this browser." : undefined}
    onCreate={(room) => setSnapshot(newDesign(room))}
  />;
  return <DesignWorkspace key={snapshot.designId} initial={snapshot} repository={repository} onNewDesign={(room) => setSnapshot(newDesign(room))} />;
}

function NewDesignForm({ onCreate, notice }: { onCreate: (room: Room) => void; notice?: string }) {
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const room: Room = {
      shape: "rectangle",
      widthMm: Number(data.get("widthMm")),
      depthMm: Number(data.get("depthMm")),
      wallHeightMm: Number(data.get("wallHeightMm")),
      openings: [],
    };
    if (Object.values(room).some((value) => typeof value === "number" && (!Number.isInteger(value) || value <= 0))) {
      setError("Enter positive whole millimetre measurements for all room dimensions.");
      return;
    }
    onCreate(room);
  };
  return <main className="setup-shell"><form className="setup-card" onSubmit={submit}>
    <p className="eyebrow">NEW BATHROOM DESIGN</p><h1>Measure your room</h1><p>Enter the room dimensions before adding openings and fixtures.</p>
    {notice && <p role="status">{notice}</p>}
    <label>Room width (mm)<input name="widthMm" type="number" min="1" step="1" required /></label>
    <label>Room depth (mm)<input name="depthMm" type="number" min="1" step="1" required /></label>
    <label>Wall height (mm)<input name="wallHeightMm" type="number" min="1" step="1" required /></label>
    {error && <p role="alert">{error}</p>}<button className="button button-primary" type="submit">Create design</button>
  </form></main>;
}

function DesignWorkspace({ initial, repository, onNewDesign }: { initial: DesignSnapshot; repository: LocalDesignRepository; onNewDesign: (room: Room) => void }) {
  const sessionRef = useRef<DesignSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new DesignSession(initial);
  const [snapshot, setSnapshot] = useState(initial);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [status, setStatus] = useState("Design ready. Measurements are in millimetres.");
  const [error, setError] = useState("");
  const [positionDraft, setPositionDraft] = useState({ xMm: 0, yMm: 0 });
  const [openingKind, setOpeningKind] = useState<Opening["kind"] | "">("");
  const [openingError, setOpeningError] = useState("");
  const [fixtureError, setFixtureError] = useState("");
  const selectedPlacement = snapshot.placements.find((item) => item.placementId === selectedPlacementId) ?? null;
  const warnings = analyzeClearances(snapshot);

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

  const submitOpening = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const kind = String(data.get("kind")) as Opening["kind"];
    const opening: Opening = {
      openingId: crypto.randomUUID(),
      kind,
      wall: String(data.get("wall")) as WallId,
      offsetMm: Number(data.get("offsetMm")),
      widthMm: Number(data.get("widthMm")),
      heightMm: Number(data.get("heightMm")),
      ...(kind === "window" ? { sillHeightMm: Number(data.get("sillHeightMm")) } : { swing: String(data.get("swing")) as Opening["swing"] }),
    };
    if (dispatch({ type: "upsert-opening", opening })) {
      setOpeningError("");
      event.currentTarget.reset();
      setOpeningKind("");
    } else setOpeningError("Check the opening measurements, wall fit, and overlap warnings above.");
  };

  const submitFixture = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const clearanceWidth = data.get("clearanceWidthMm");
    const clearanceDepth = data.get("clearanceDepthMm");
    const clearanceDirection = data.get("clearanceDirection");
    const anyClearanceField = Boolean(clearanceWidth || clearanceDepth || clearanceDirection);
    if (anyClearanceField && (!clearanceWidth || !clearanceDepth || !clearanceDirection)) {
      setFixtureError("To define a clearance zone, enter its width, depth, and direction.");
      return;
    }
    const placement: ProductPlacement = {
      placementId: crypto.randomUUID(),
      productId: `custom-${crypto.randomUUID()}`,
      displayName: String(data.get("displayName")).trim(),
      productVersion: "user-defined",
      xMm: Number(data.get("xMm")),
      yMm: Number(data.get("yMm")),
      widthMm: Number(data.get("widthMm")),
      depthMm: Number(data.get("depthMm")),
      rotationDeg: Number(data.get("rotationDeg")) as ProductPlacement["rotationDeg"],
      ...(clearanceWidth && clearanceDepth ? {
        clearance: {
          widthMm: Number(clearanceWidth),
          depthMm: Number(clearanceDepth),
          direction: String(clearanceDirection) as WallId,
        },
      } : {}),
    };
    if (dispatch({ type: "place-product", placement })) {
      setSelectedPlacementId(placement.placementId);
      setFixtureError("");
      event.currentTarget.reset();
    } else setFixtureError("Check the name, dimensions, rotation, position, and available room area.");
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
    if (saved.status !== "valid") {
      setError(saved.status === "unavailable" ? "Browser storage is unavailable, so the saved design cannot be reopened." : "There is no readable saved design in this browser.");
      return;
    }
    sessionRef.current = new DesignSession(saved.snapshot);
    setSnapshot(saved.snapshot);
    setSelectedPlacementId(null);
    setError("");
    setStatus("Saved design reopened from this browser.");
  };

  const startNew = () => {
    onNewDesign({ ...snapshot.room, openings: [] });
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
            <form className="editor-form" onSubmit={submitOpening}>
              <label>Opening type<select name="kind" required value={openingKind} onChange={(event) => setOpeningKind(event.target.value as Opening["kind"] | "")}>
                <option value="">Choose type</option><option value="door">Door</option><option value="window">Window</option>
              </select></label>
              <label>Wall<select name="wall" required defaultValue=""><option value="">Choose wall</option>
                <option value="south">South</option><option value="east">East</option><option value="north">North</option><option value="west">West</option>
              </select></label>
              <label>Offset from wall start (mm)<input name="offsetMm" type="number" min="0" step="1" required /></label>
              <label>Width along wall (mm)<input name="widthMm" type="number" min="1" step="1" required /></label>
              <label>Height (mm)<input name="heightMm" type="number" min="1" step="1" required /></label>
              {openingKind === "window" && <label>Sill height (mm)<input name="sillHeightMm" type="number" min="0" step="1" required /></label>}
              {openingKind === "door" && <label>Door swing<select name="swing" required defaultValue=""><option value="">Choose swing</option><option value="inward-left">Inward left</option><option value="inward-right">Inward right</option><option value="none">No swing shown</option></select></label>}
              <button className="button button-outline" type="submit">Add opening</button>
              {openingError && <p className="form-error" role="alert">{openingError}</p>}
            </form>
            <p className="helper-copy">Wall offset begins at the inside start corner defined by the room plan.</p>
            {snapshot.room.openings.length > 0 ? (
              <ul className="item-list" aria-label="Room openings">
                {snapshot.room.openings.map((opening) => (
                  <li key={opening.openingId}>
                    <span className={`item-indicator ${opening.kind}`} />
                    <span>{opening.kind === "door" ? "Door" : "Window"}<small>{opening.wall} wall · offset {opening.offsetMm} mm · {opening.widthMm} × {opening.heightMm} mm</small></span>
                    <button className="icon-button" aria-label={`Remove ${opening.kind}`} onClick={() => removeOpening(opening)}>×</button>
                  </li>
                ))}
              </ul>
            ) : <p className="helper-copy">Add doors and windows to show where fixtures can go.</p>}
          </section>

          <section className="panel-section">
            <div className="section-heading"><span className="step-number">03</span><h2>Fixtures</h2></div>
            <form className="editor-form" onSubmit={submitFixture}>
              <label>Fixture name<input name="displayName" type="text" maxLength={128} required /></label>
              <label>Width (mm)<input name="widthMm" type="number" min="1" step="1" required /></label>
              <label>Depth (mm)<input name="depthMm" type="number" min="1" step="1" required /></label>
              <label>X position (mm)<input name="xMm" type="number" step="1" required /></label>
              <label>Y position (mm)<input name="yMm" type="number" step="1" required /></label>
              <label>Rotation<select name="rotationDeg" required defaultValue=""><option value="">Choose rotation</option><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>
              <fieldset><legend>Optional clearance zone</legend>
                <label>Zone width (mm)<input name="clearanceWidthMm" type="number" min="1" step="1" /></label>
                <label>Zone depth (mm)<input name="clearanceDepthMm" type="number" min="1" step="1" /></label>
                <label>Zone direction<select name="clearanceDirection" defaultValue=""><option value="">Choose direction</option><option value="south">South</option><option value="east">East</option><option value="north">North</option><option value="west">West</option></select></label>
              </fieldset>
              <p className="helper-copy">Enter a required clear area to receive warnings. The planner does not assume regulatory clearances.</p>
              {fixtureError && <p className="form-error" role="alert">{fixtureError}</p>}
              <button className="button button-outline" type="submit">Add fixture</button>
            </form>
            <ul className="item-list fixture-list" aria-label="Placed fixtures">
              {snapshot.placements.map((item) => {
                const label = item.displayName ?? item.productId;
                return <li key={item.placementId}>
                  <span className="item-indicator fixture-indicator" />
                  <button className="fixture-select" aria-pressed={selectedPlacementId === item.placementId} onClick={() => setSelectedPlacementId(item.placementId)}>
                    {label}<small>{item.widthMm} × {item.depthMm} mm · {item.xMm}, {item.yMm} mm · {item.rotationDeg}°</small>
                  </button>
                </li>;
              })}
            </ul>
            {warnings.length > 0 && <div className="warning-panel" role="status"><strong>Clearance warnings</strong><ul>{warnings.map((warning, index) => {
              const subject = snapshot.placements.find((item) => item.placementId === warning.placementId)?.displayName ?? "Fixture";
              const related = snapshot.placements.find((item) => item.placementId === warning.relatedPlacementId)?.displayName;
              return <li key={`${warning.code}-${warning.placementId}-${index}`}>{subject}: {warning.code === "CLEARANCE_OUT_OF_ROOM" ? "clearance zone extends beyond the room." : `clearance zone intersects ${related ?? "another fixture"}.`}</li>;
            })}</ul></div>}
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
