"""Pure geometry validation. No FastAPI, database, renderer, or AI dependencies."""

from __future__ import annotations

from typing import Any


def _is_integer(value: Any) -> bool:
    return type(value) is int


def _is_positive_mm(value: Any) -> bool:
    return _is_integer(value) and value > 0


def _is_non_negative_mm(value: Any) -> bool:
    return _is_integer(value) and value >= 0


def _wall_length(wall: str, room: dict[str, Any]) -> int:
    return room["widthMm"] if wall in ("south", "north") else room["depthMm"]


def _overlaps(a: dict[str, int], b: dict[str, int]) -> bool:
    return (
        a["xMm"] < b["xMm"] + b["widthMm"]
        and a["xMm"] + a["widthMm"] > b["xMm"]
        and a["yMm"] < b["yMm"] + b["depthMm"]
        and a["yMm"] + a["depthMm"] > b["yMm"]
    )


def validate_geometry(payload: dict[str, Any]) -> dict[str, Any]:
    """Return a stable validation result for the shared v1 geometry vectors."""
    schema_version = payload.get("snapshotSchemaVersion")
    if schema_version is not None and (type(schema_version) is not int or schema_version != 1):
        return {"valid": False, "errorCode": "UNSUPPORTED_SCHEMA_VERSION"}

    room = payload["room"]
    openings = payload.get("openings", [])
    placements = payload.get("placements", [])

    dimensions = [room.get("widthMm"), room.get("depthMm")]
    if "wallHeightMm" in room:
        dimensions.append(room["wallHeightMm"])
    for opening in openings:
        dimensions.extend(opening[key] for key in ("offsetMm", "widthMm", "heightMm", "sillHeightMm") if key in opening)
    for placement in placements:
        dimensions.extend(placement[key] for key in ("xMm", "yMm", "widthMm", "depthMm") if key in placement)
    if any(not _is_integer(value) for value in dimensions):
        return {"valid": False, "errorCode": "DIMENSION_MUST_BE_INTEGER_MM"}
    if not _is_positive_mm(room.get("widthMm")) or not _is_positive_mm(room.get("depthMm")):
        return {"valid": False, "errorCode": "DIMENSION_MUST_BE_POSITIVE_MM"}
    if "wallHeightMm" in room and not _is_positive_mm(room["wallHeightMm"]):
        return {"valid": False, "errorCode": "DIMENSION_MUST_BE_POSITIVE_MM"}

    for opening in openings:
        wall = opening.get("wall")
        offset = opening.get("offsetMm", -1)
        width = opening.get("widthMm", 0)
        if wall not in ("south", "east", "north", "west") or not _is_non_negative_mm(offset) or not _is_positive_mm(width):
            return {"valid": False, "errorCode": "OPENING_OUT_OF_BOUNDS"}
        if offset + width > _wall_length(wall, room):
            return {"valid": False, "errorCode": "OPENING_OUT_OF_BOUNDS"}
        height = opening.get("heightMm")
        if height is not None:
            sill = opening.get("sillHeightMm") if opening.get("kind") == "window" else 0
            if not _is_positive_mm(height):
                return {"valid": False, "errorCode": "OPENING_OUT_OF_BOUNDS"}
            if opening.get("kind") == "window" and not _is_non_negative_mm(sill):
                return {"valid": False, "errorCode": "OPENING_OUT_OF_BOUNDS"}
            if "wallHeightMm" in room and sill + height > room["wallHeightMm"]:
                return {"valid": False, "errorCode": "OPENING_OUT_OF_BOUNDS"}

    for index, opening in enumerate(openings):
        for other in openings[index + 1 :]:
            if opening["wall"] == other["wall"] and (
                opening["offsetMm"] < other["offsetMm"] + other["widthMm"]
                and opening["offsetMm"] + opening["widthMm"] > other["offsetMm"]
            ):
                return {"valid": False, "errorCode": "OPENINGS_OVERLAP"}

    boxes: list[dict[str, int]] = []
    effective_footprints: list[dict[str, int]] = []
    for item in placements:
        rotation = item.get("rotationDeg")
        if rotation not in (0, 90, 180, 270):
            return {"valid": False, "errorCode": "UNSUPPORTED_ROTATION"}
        x, y, width, depth = item.get("xMm"), item.get("yMm"), item.get("widthMm"), item.get("depthMm")
        if not _is_integer(x) or not _is_integer(y) or not _is_positive_mm(width) or not _is_positive_mm(depth):
            return {"valid": False, "errorCode": "PLACEMENT_OUT_OF_BOUNDS"}
        if rotation in (90, 270):
            width, depth = depth, width
        box = {"xMm": x, "yMm": y, "widthMm": width, "depthMm": depth}
        if x < 0 or y < 0 or x + width > room["widthMm"] or y + depth > room["depthMm"]:
            return {"valid": False, "errorCode": "PLACEMENT_OUT_OF_BOUNDS"}
        if any(_overlaps(previous, box) for previous in boxes):
            return {"valid": False, "errorCode": "PLACEMENTS_OVERLAP"}
        boxes.append(box)
        effective_footprints.append({"widthMm": width, "depthMm": depth})

    return {"valid": True, "effectiveFootprints": effective_footprints}
