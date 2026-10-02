import { Layer, Line, Rect, Stage, Text } from "react-konva";
import { Fragment } from "react";
import type Konva from "konva";
import type { DesignItemPlacement, Opening, RenovationSpace, WallId } from "../domain/design.ts";

const STAGE_WIDTH = 780;
const STAGE_HEIGHT = 620;
const PAD = 70;
const INNER_WIDTH = STAGE_WIDTH - PAD * 2;
const INNER_HEIGHT = STAGE_HEIGHT - PAD * 2;
const SNAP_MM = 50;

const snapToGrid = (valueMm: number) => Math.round(valueMm / SNAP_MM) * SNAP_MM;

function effectiveSize(item: DesignItemPlacement) {
  return item.rotationDeg === 90 || item.rotationDeg === 270
    ? { widthMm: item.depthMm, depthMm: item.widthMm }
    : { widthMm: item.widthMm, depthMm: item.depthMm };
}

function openingSegment(opening: Opening, space: RenovationSpace, scale: number): [number, number, number, number] {
  const { widthMm: roomWidth, depthMm: roomDepth } = space.geometry;
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
  space: RenovationSpace;
  selectedItemId: string | null;
  onSelect: (itemId: string | null) => void;
  onMove: (itemId: string, xMm: number, yMm: number) => void;
}

export function PlanRenderer({ space, selectedItemId, onSelect, onMove }: PlanRendererProps) {
  const scale = Math.min(INNER_WIDTH / space.geometry.widthMm, INNER_HEIGHT / space.geometry.depthMm);
  const planWidth = space.geometry.widthMm * scale;
  const planDepth = space.geometry.depthMm * scale;
  const planX = PAD + (INNER_WIDTH - planWidth) / 2;
  const planY = PAD + (INNER_HEIGHT - planDepth) / 2;
  const xOffset = planX - PAD;
  const yOffset = planY - PAD;

  const moveFromCanvas = (item: DesignItemPlacement, node: Konva.Node) => {
    const size = effectiveSize(item);
    const xMm = snapToGrid((node.x() - planX) / scale);
    const topMm = snapToGrid((node.y() - planY) / scale);
    const yMm = snapToGrid(space.geometry.depthMm - topMm - size.depthMm);
    onMove(item.itemId, xMm, yMm);
  };

  return (
    <div className="plan-frame" role="img" aria-label={`2D room plan, ${space.geometry.widthMm} by ${space.geometry.depthMm} millimetres`}>
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
          {space.geometry.openings.map((opening) => {
            const points = openingSegment(opening, space, scale).map((value, index) => {
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
            text={`${space.geometry.widthMm} mm`}
            align="center"
            fontSize={14}
            fill="#56625c"
            listening={false}
          />
          <Text
            x={Math.max(6, planX - 64)}
            y={planY + planDepth / 2 - 9}
            width={56}
            text={`${space.geometry.depthMm} mm`}
            align="right"
            fontSize={13}
            fill="#56625c"
            listening={false}
          />
          {space.geometry.openings.map((opening) => {
            const points = openingSegment(opening, space, scale).map((value, index) => {
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
          {space.items.map((item) => {
            const size = effectiveSize(item);
            const x = planX + item.xMm * scale;
            const y = planY + (space.geometry.depthMm - item.yMm - size.depthMm) * scale;
            const selected = selectedItemId === item.itemId;
            return (
              <Fragment key={item.itemId}>
                <Rect
                  x={x}
                  y={y}
                  width={size.widthMm * scale}
                  height={size.depthMm * scale}
                  fill="#e5dfd2"
                  stroke={selected ? "#cf6a3b" : "#827862"}
                  strokeWidth={selected ? 3 : 2}
                  cornerRadius={4}
                  draggable
                  onClick={() => onSelect(item.itemId)}
                  onTap={() => onSelect(item.itemId)}
                  onDragStart={() => onSelect(item.itemId)}
                  onDragEnd={(event) => moveFromCanvas(item, event.target)}
                />
                <Text
                  x={x + 6}
                  y={y + 7}
                  width={Math.max(40, size.widthMm * scale - 12)}
                  text={item.displayName ?? "Item"}
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
