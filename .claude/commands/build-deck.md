---
description: Convert a Marp markdown to report-render format and build the slides PDF (both written to output/)
argument-hint: [path/to/marp.md]
---

Run the project deck pipeline on the given Marp markdown (defaults to `presentation/present-milvus-original.md` when no argument is provided):

!bash scripts/build-deck.sh $ARGUMENTS

The script writes both artifacts into `output/`:
- `output/<name>.rendered.md` — converted to the `report-render` skill convention
- `output/<name>.pdf` — slides PDF using the mgm theme

The PDF opens automatically. Set `OPEN=0` to skip opening.
