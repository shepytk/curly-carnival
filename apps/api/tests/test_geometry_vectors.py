import json
import unittest
from pathlib import Path

from apps.api.app.domain.geometry import validate_geometry


ROOT = Path(__file__).resolve().parents[3]
VECTORS = ROOT / "contracts/design/v1/geometry-test-vectors.json"


class GeometryContractTests(unittest.TestCase):
    def test_shared_geometry_vectors(self) -> None:
        vectors = json.loads(VECTORS.read_text())["vectors"]
        for vector in vectors:
            with self.subTest(vector=vector["id"]):
                result = validate_geometry(
                    {
                        "snapshotSchemaVersion": vector.get("snapshotSchemaVersion"),
                        "room": vector.get("room", {"widthMm": 2400, "depthMm": 3000}),
                        "openings": vector.get("openings", []),
                        "placements": vector.get("placements", []),
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
                "room": {"widthMm": 2400, "depthMm": 3000},
                "placements": [
                    {"xMm": 0, "yMm": 0, "widthMm": 1000, "depthMm": 500, "rotationDeg": 0},
                    {"xMm": 1000, "yMm": 0, "widthMm": 1000, "depthMm": 500, "rotationDeg": 0},
                ],
            }
        )
        self.assertTrue(result["valid"])


if __name__ == "__main__":
    unittest.main()
