import { Layer, Line, Rect, Stage, Text } from "react-konva";
import { Fragment } from "react";
import type Konva from "konva";
import type { DesignSnapshot, Opening, ProductPlacement, WallId } from "../domain/design.ts";

const STAGE_WIDTH = 780;
const STAGE_HEIGHT = 620;
const PAD = 70;
const INNER_WIDTH = STAGE_WIDTH - PAD * 2;
const INNER_HEIGHT = STAGE_HEIGHT - PAD * 2;
const SNAP_MM = 50;

const snapToGrid = (valueMm: number) => Math.round(valueMm / SNAP_MM) * SNAP_MM;

function effectiveSize(item: ProductPlacement) {
  return item.rotationDeg === 90 || item.rotationDeg === 270
    ? { widthMm: item.depthMm, depthMm: item.widthMm }
    : { widthMm: item.widthMm, depthMm: item.depthMm };
}

function openingSegment(opening: Opening, snapshot: DesignSnapshot, scale: number): [number, number, number, number] {
  const { widthMm: roomWidth, depthMm: roomDepth } = snapshot.room;
  const start = opening.offsetMm * scale;
  const end = (opening.offsetMm + opening.widthMm) * scale;
  const west = PAD;
  const east = PAD + roomWidth * scale;
  const south = PAD + roomDepth * scale;
  const north = PAD;
  const starts: Record<WallId, [number, number, number, number]> = {
    south: [west + start, south, west + end, south],
    east: [east, south - start, east, south - end],
    north: [east - start, north, east - end, north],
    west: [west, north + start, west, north + end],
  };
  return starts[opening.wall];
}

interface PlanRendererProps {
  snapshot: DesignSnapshot;
  selectedPlacementId: string | null;
  onSelect: (placementId: string | null) => void;
  onMove: (placementId: string, xMm: number, yMm: number) => void;
}

export function PlanRenderer({ snapshot, selectedPlacementId, onSelect, onMove }: PlanRendererProps) {
  const scale = Math.min(INNER_WIDTH / snapshot.room.widthMm, INNER_HEIGHT / snapshot.room.depthMm);
  const planWidth = snapshot.room.widthMm * scale;
  const planDepth = snapshot.room.depthMm * scale;
  const planX = PAD + (INNER_WIDTH - planWidth) / 2;
  const planY = PAD + (INNER_HEIGHT - planDepth) / 2;
  const xOffset = planX - PAD;
  const yOffset = planY - PAD;

  const moveFromCanvas = (item: ProductPlacement, node: Konva.Node) => {
    const size = effectiveSize(item);
    const xMm = snapToGrid((node.x() - planX) / scale);
    const topMm = snapToGrid((node.y() - planY) / scale);
    const yMm = snapToGrid(snapshot.room.depthMm - topMm - size.depthMm);
    onMove(item.placementId, xMm, yMm);
  };

  return (
    <div className="plan-frame" role="img" aria-label={`2D room plan, ${snapshot.room.widthMm} by ${snapshot.room.depthMm} millimetres`}>
      <Stage
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) onSelect(null);
        }}
      >
        <Layer>
          <Rect x={0} y={0} width={STAGE_WIDTH} height={STAGE_HEIGHT} fill="#f8f8f5" listening={false} />
          <Rect
            x={planX}
            y={planY}
            width={planWidth}
            height={planDepth}
            fill="#efeee9"
            stroke="#303936"
            strokeWidth={5}
            listening={false}
          />
          {snapshot.room.openings.map((opening) => {
            const points = openingSegment(opening, snapshot, scale).map((value, index) => {
              if (index === 0 || index === 2) return value + xOffset;
              return value + yOffset;
            });
            return (
              <Line
                key={opening.openingId}
                points={points}
                stroke="#f8f8f5"
                strokeWidth={9}
                lineCap="square"
                listening={false}
              />
            );
          })}
          <Text
            x={planX}
            y={Math.max(8, planY - 34)}
            width={planWidth}
            text={`${snapshot.room.widthMm} mm`}
            align="center"
            fontSize={14}
            fill="#56625c"
            listening={false}
          />
          <Text
            x={Math.max(6, planX - 64)}
            y={planY + planDepth / 2 - 9}
            width={56}
            text={`${snapshot.room.depthMm} mm`}
            align="right"
            fontSize={13}
            fill="#56625c"
            listening={false}
          />
          {snapshot.room.openings.map((opening) => {
            const points = openingSegment(opening, snapshot, scale).map((value, index) => {
              if (index === 0 || index === 2) return value + xOffset;
              return value + yOffset;
            });
            return (
              <Line
                key={`${opening.openingId}-mark`}
                points={points}
                stroke={opening.kind === "door" ? "#b9793d" : "#508c9b"}
                strokeWidth={3}
                lineCap="square"
                listening={false}
              />
            );
          })}
          {snapshot.placements.map((item) => {
            const size = effectiveSize(item);
            const x = planX + item.xMm * scale;
            const y = planY + (snapshot.room.depthMm - item.yMm - size.depthMm) * scale;
            const selected = selectedPlacementId === item.placementId;
            const isShower = item.productId.includes("shower");
            return (
              <Fragment key={item.placementId}>
                <Rect
                  x={x}
                  y={y}
                  width={size.widthMm * scale}
                  height={size.depthMm * scale}
                  fill={isShower ? "#d7e7e6" : "#e5dfd2"}
                  stroke={selected ? "#cf6a3b" : isShower ? "#508c9b" : "#827862"}
                  strokeWidth={selected ? 3 : 2}
                  cornerRadius={4}
                  draggable
                  onClick={() => onSelect(item.placementId)}
                  onTap={() => onSelect(item.placementId)}
                  onDragStart={() => onSelect(item.placementId)}
                  onDragEnd={(event) => moveFromCanvas(item, event.target)}
                />
                <Text
                  x={x + 6}
                  y={y + 7}
                  width={Math.max(40, size.widthMm * scale - 12)}
                  text={isShower ? "Shower" : "Vanity"}
                  fontSize={13}
                  fill="#26332e"
                  align="center"
                  listening={false}
                />
                <Text
                  x={x + 5}
                  y={y + 25}
                  width={Math.max(40, size.widthMm * scale - 10)}
                  text={`${size.widthMm} × ${size.depthMm}`}
                  fontSize={10}
                  fill="#56625c"
                  align="center"
                  listening={false}
                />
              </Fragment>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
