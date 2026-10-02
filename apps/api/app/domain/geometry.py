"""Pure geometry validation. No FastAPI, database, renderer, or AI dependencies."""

from __future__ import annotations

from typing import Any


def _is_integer(value: Any) -> bool:
    return type(value) is int


def _is_positive_mm(value: Any) -> bool:
    return _is_integer(value) and value > 0


def _is_non_negative_mm(value: Any) -> bool:
    return _is_integer(value) and value >= 0


def _wall_length(wall: str, space: dict[str, Any]) -> int:
    return space["widthMm"] if wall in ("south", "north") else space["depthMm"]


def _overlaps(a: dict[str, int], b: dict[str, int]) -> bool:
    return (
        a["xMm"] < b["xMm"] + b["widthMm"]
        and a["xMm"] + a["widthMm"] > b["xMm"]
        and a["yMm"] < b["yMm"] + b["depthMm"]
        and a["yMm"] + a["depthMm"] > b["yMm"]
    )


def validate_geometry(payload: dict[str, Any]) -> dict[str, Any]:
    """Return a stable validation result for the shared v2 space vectors."""
    schema_version = payload.get("snapshotSchemaVersion")
    if schema_version is not None and (type(schema_version) is not int or schema_version != 2):
        return {"valid": False, "errorCode": "UNSUPPORTED_SCHEMA_VERSION"}

    space = payload["space"]
    openings = payload.get("openings", [])
    items = payload.get("items", [])

    dimensions = [space.get("widthMm"), space.get("depthMm")]
    if "wallHeightMm" in space:
        dimensions.append(space["wallHeightMm"])
    for opening in openings:
        dimensions.extend(opening[key] for key in ("offsetMm", "widthMm", "heightMm", "sillHeightMm") if key in opening)
    for item in items:
        dimensions.extend(item[key] for key in ("xMm", "yMm", "widthMm", "depthMm") if key in item)
        clearance = item.get("clearance")
        if clearance:
            dimensions.extend(clearance[key] for key in ("widthMm", "depthMm") if key in clearance)
    if any(not _is_integer(value) for value in dimensions):
        return {"valid": False, "errorCode": "DIMENSION_MUST_BE_INTEGER_MM"}
    if not _is_positive_mm(space.get("widthMm")) or not _is_positive_mm(space.get("depthMm")):
        return {"valid": False, "errorCode": "DIMENSION_MUST_BE_POSITIVE_MM"}
    if "wallHeightMm" in space and not _is_positive_mm(space["wallHeightMm"]):
        return {"valid": False, "errorCode": "DIMENSION_MUST_BE_POSITIVE_MM"}

    for opening in openings:
        wall = opening.get("wall")
        offset = opening.get("offsetMm", -1)
        width = opening.get("widthMm", 0)
        if (
            wall not in ("south", "east", "north", "west")
            or opening.get("kind") not in ("door", "window")
            or not _is_non_negative_mm(offset)
            or not _is_positive_mm(width)
        ):
            return {"valid": False, "errorCode": "OPENING_OUT_OF_BOUNDS"}
        if offset + width > _wall_length(wall, space):
            return {"valid": False, "errorCode": "OPENING_OUT_OF_BOUNDS"}
        height = opening.get("heightMm")
        if height is not None:
            sill = opening.get("sillHeightMm") if opening.get("kind") == "window" else 0
            if not _is_positive_mm(height):
                return {"valid": False, "errorCode": "OPENING_OUT_OF_BOUNDS"}
            if opening.get("kind") == "window" and not _is_non_negative_mm(sill):
                return {"valid": False, "errorCode": "OPENING_OUT_OF_BOUNDS"}
            if "wallHeightMm" in space and sill + height > space["wallHeightMm"]:
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
    for item in items:
        clearance = item.get("clearance")
        if clearance is not None and (
            not _is_positive_mm(clearance.get("widthMm"))
            or not _is_positive_mm(clearance.get("depthMm"))
            or clearance.get("direction") not in ("south", "east", "north", "west")
        ):
            return {"valid": False, "errorCode": "CLEARANCE_INVALID"}
        rotation = item.get("rotationDeg")
        if rotation not in (0, 90, 180, 270):
            return {"valid": False, "errorCode": "UNSUPPORTED_ROTATION"}
        x, y, width, depth = item.get("xMm"), item.get("yMm"), item.get("widthMm"), item.get("depthMm")
        if not _is_integer(x) or not _is_integer(y) or not _is_positive_mm(width) or not _is_positive_mm(depth):
            return {"valid": False, "errorCode": "ITEM_OUT_OF_BOUNDS"}
        if rotation in (90, 270):
            width, depth = depth, width
        box = {"xMm": x, "yMm": y, "widthMm": width, "depthMm": depth}
        if x < 0 or y < 0 or x + width > space["widthMm"] or y + depth > space["depthMm"]:
            return {"valid": False, "errorCode": "ITEM_OUT_OF_BOUNDS"}
        if any(_overlaps(previous, box) for previous in boxes):
            return {"valid": False, "errorCode": "ITEMS_OVERLAP"}
        boxes.append(box)
        effective_footprints.append({"widthMm": width, "depthMm": depth})

    return {"valid": True, "effectiveFootprints": effective_footprints}


def analyze_clearances(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Report user-configured front-zone conflicts without rejecting an item placement."""
    space = payload["space"]
    items = payload.get("items", [])
    warnings: list[dict[str, Any]] = []
    for item in items:
        zone = item.get("clearance")
        if not zone:
            continue
        rotated = item["rotationDeg"] in (90, 270)
        width = item["depthMm"] if rotated else item["widthMm"]
        depth = item["widthMm"] if rotated else item["depthMm"]
        x = item["xMm"]
        y = item["yMm"]
        zone_width = zone["widthMm"]
        zone_depth = zone["depthMm"]
        centered_x = x + (width - zone_width) // 2
        centered_y = y + (depth - zone_width) // 2
        direction = zone["direction"]
        if direction == "north":
            box = {"xMm": centered_x, "yMm": y + depth, "widthMm": zone_width, "depthMm": zone_depth}
        elif direction == "south":
            box = {"xMm": centered_x, "yMm": y - zone_depth, "widthMm": zone_width, "depthMm": zone_depth}
        elif direction == "east":
            box = {"xMm": x + width, "yMm": centered_y, "widthMm": zone_depth, "depthMm": zone_width}
        else:
            box = {"xMm": x - zone_depth, "yMm": centered_y, "widthMm": zone_depth, "depthMm": zone_width}
        if (
            box["xMm"] < 0 or box["yMm"] < 0
            or box["xMm"] + box["widthMm"] > space["widthMm"]
            or box["yMm"] + box["depthMm"] > space["depthMm"]
        ):
            warnings.append({"code": "CLEARANCE_OUT_OF_SPACE", "itemId": item["itemId"]})
        for other in items:
            if other["itemId"] == item["itemId"]:
                continue
            other_rotated = other["rotationDeg"] in (90, 270)
            other_width = other["depthMm"] if other_rotated else other["widthMm"]
            other_depth = other["widthMm"] if other_rotated else other["depthMm"]
            if _overlaps(box, {"xMm": other["xMm"], "yMm": other["yMm"], "widthMm": other_width, "depthMm": other_depth}):
                warnings.append({
                    "code": "CLEARANCE_BLOCKED",
                    "itemId": item["itemId"],
                    "relatedItemId": other["itemId"],
                })
    return warnings
