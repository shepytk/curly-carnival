# Renovation project contract v2

This contract is the canonical browser and API boundary for the home renovation platform. A project contains one or more spaces. Each space owns reusable geometry and generic design-item placements. Bathroom planning is the first workflow using this contract.

```json
{
  "schemaVersion": 2,
  "projectId": "project-001",
  "revision": 1,
  "units": "mm",
  "spaces": [
    {
      "spaceId": "space-001",
      "name": "Bathroom",
      "spaceType": "bathroom",
      "geometry": {
        "shape": "rectangle",
        "widthMm": 2400,
        "depthMm": 3000,
        "wallHeightMm": 2400,
        "openings": []
      },
      "items": []
    }
  ]
}
```

`spaceType` selects workflow-specific presentation and policies; it does not change the shared geometry representation. A design item may have a catalogue reference, but user-defined items do not need fake product identifiers. Clearance zones remain user-entered advisory data.

V1 bathroom snapshots are read only as migration input. The browser migrates them to a one-space v2 project before the next save. New writes use v2.

## Versioning

- Additive optional fields may be introduced when readers ignore unknown fields.
- Changes to units, coordinates, required fields, or invariant meanings require another schema version and an explicit migration.
- API DTOs, persistence records, and renderer objects remain separate representations mapped at their boundaries.
