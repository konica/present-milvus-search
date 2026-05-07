#!/bin/bash

INPUT="presentation/present-milvus.md"
TEMPLATE="templates/mgm-Template-2024.pptx"
OUTPUT="output/present-milvus.pptx"

mkdir -p output

pandoc "$INPUT" \
  --reference-doc="$TEMPLATE" \
  --resource-path="presentation" \
  -o "$OUTPUT"

echo "Exported to $OUTPUT"
