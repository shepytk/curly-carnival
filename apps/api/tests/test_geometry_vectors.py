import json
import unittest
from pathlib import Path

from apps.api.app.domain.geometry import analyze_clearances, validate_geometry


ROOT = Path(__file__).resolve().parents[3]
VECTORS = ROOT / "contracts/design/v2/geometry-test-vectors.json"


class GeometryContractTests(unittest.TestCase):
    def test_shared_geometry_vectors(self) -> None:
        vectors = json.loads(VECTORS.read_text())["vectors"]
        for vector in vectors:
            with self.subTest(vector=vector["id"]):
                result = validate_geometry(
                    {
                        "snapshotSchemaVersion": vector.get("snapshotSchemaVersion"),
                        "space": vector.get("space", {"widthMm": 2400, "depthMm": 3000}),
                        "openings": vector.get("openings", []),
                        "items": vector.get("items", []),
                    }
                )
                expected = vector["expected"]
                self.assertEqual(result["valid"], expected["valid"])
                if not expected["valid"]:
                    self.assertEqual(result["errorCode"], expected["errorCode"])
                if "effectiveWidthMm" in expected:
                    self.assertEqual(result["effectiveFootprints"][0]["widthMm"], expected["effectiveWidthMm"])
                    self.assertEqual(result["effectiveFootprints"][0]["depthMm"], expected["effectiveDepthMm"])

    def test_edge_touch_is_not_overlap(self) -> None:
        result = validate_geometry(
            {
                "space": {"widthMm": 2400, "depthMm": 3000},
                "items": [
                    {"xMm": 0, "yMm": 0, "widthMm": 1000, "depthMm": 500, "rotationDeg": 0},
                    {"xMm": 1000, "yMm": 0, "widthMm": 1000, "depthMm": 500, "rotationDeg": 0},
                ],
            }
        )
        self.assertTrue(result["valid"])

    def test_configured_clearance_conflict_is_a_warning(self) -> None:
        payload = {
            "space": {"widthMm": 2400, "depthMm": 3000},
            "items": [
                {"itemId": "vanity", "xMm": 100, "yMm": 100, "widthMm": 1000, "depthMm": 500, "rotationDeg": 0, "clearance": {"widthMm": 1000, "depthMm": 700, "direction": "north"}},
                {"itemId": "other", "xMm": 100, "yMm": 700, "widthMm": 1000, "depthMm": 400, "rotationDeg": 0},
            ],
        }
        self.assertTrue(validate_geometry(payload)["valid"])
        self.assertEqual(analyze_clearances(payload), [{"code": "CLEARANCE_BLOCKED", "itemId": "vanity", "relatedItemId": "other"}])

    def test_configured_clearance_extending_outside_space_is_a_warning(self) -> None:
        payload = {
            "space": {"widthMm": 1000, "depthMm": 1000},
            "items": [
                {"itemId": "sink", "xMm": 0, "yMm": 0, "widthMm": 400, "depthMm": 300, "rotationDeg": 0, "clearance": {"widthMm": 400, "depthMm": 600, "direction": "south"}},
            ],
        }
        self.assertTrue(validate_geometry(payload)["valid"])
        self.assertEqual(analyze_clearances(payload), [{"code": "CLEARANCE_OUT_OF_SPACE", "itemId": "sink"}])

    def test_invalid_configured_clearance_fails_space_validation(self) -> None:
        result = validate_geometry({
            "space": {"widthMm": 2400, "depthMm": 3000},
            "items": [{"xMm": 1, "yMm": 1, "widthMm": 10, "depthMm": 10, "rotationDeg": 0, "clearance": {}}],
        })
        self.assertEqual(result, {"valid": False, "errorCode": "CLEARANCE_INVALID"})


if __name__ == "__main__":
    unittest.main()
