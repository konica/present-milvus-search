---
name: report-render
description: 
Use this skill whenever the user wants to turn content, notes, or analysis into a professional PDF report or slide deck. Triggers include: "make a report", "turn this into slides", "generate a PDF", "write up a report on X", "create a presentation", or any request to produce a formatted document output. This skill renders Markdown into a branded PDF using pre-built HTML templates — no LLM token cost for templates, no regeneration. Always use this skill instead of ad-hoc document creation approaches.
---

# Report Renderer Skill

Converts Markdown content into professional branded PDF reports or slide decks using pre-built static HTML templates and Puppeteer.

## Architecture Overview

```
.claude/skills/report-render/
├── design-system.html      # Brand reference (generated once, never touched again)
├── report-template.html    # Template shell — fixed structure, content injected at render time
├── slides-template.html    # Template shell — fixed structure, content injected at render time
├── render.js               # Puppeteer renderer — the only thing that runs per call
└── package.json
```

**Key principle:** Templates are static files committed to disk. The skill never regenerates them. Only `render.js` runs per invocation, injecting the project’s Markdown into the existing template.

-----

## Per-Project Usage (Every Call)

### 1. Find or write the Markdown file

Each project has its own Markdown source. Check if one already exists (e.g. `docs/report.md`, `report.md` in cwd). If not, write it based on the user’s content.

Always include front-matter:

```markdown
---
title: ...
subtitle: ...
category: ...
author: ...
date: ...
doc_id: ...
version: ...
---
```

### 2. Writing conventions

Visual Pattern Library
Clean pipeline, flowers emoji icons, conversational labels, tagline at bottom.zone-based, more of an infographic feel with numbered badges.feedback loop arrow

#### Fan-Out (One-to-Many)
Central element with arrows radiating to multiple targets. Use for: sources, PRDs, root causes, central hubs.
```
        ○
       ↗
  □ → ○
       ↘
        ○
```

#### Convergence (Many-to-One)
Multiple inputs merging through arrows to single output. Use for: aggregation, funnels, synthesis.
```
  ○ ↘
  ○ → □
  ○ ↗
```

#### Tree (Hierarchy)
Parent-child branching with connecting lines and free-floating text (no boxes needed). Use for: file systems, org charts, taxonomies.
```
  label
  ├── label
  │   ├── label
  │   └── label
  └── label
```
Use `line` elements for the trunk and branches, free-floating text for labels.

#### Spiral/Cycle (Continuous Loop)
Elements in sequence with arrow returning to start. Use for: feedback loops, iterative processes, evolution.
```
  □ → □
  ↑     ↓
  □ ← □
```

#### Cloud (Abstract State)
Overlapping ellipses with varied sizes. Use for: context, memory, conversations, mental states.

#### Assembly Line (Transformation)
Input → Process Box → Output with clear before/after. Use for: transformations, processing, conversion.
```
  ○○○ → [PROCESS] → □□□
  chaos              order
```

#### Side-by-Side (Comparison)
Two parallel structures with visual contrast. Use for: before/after, options, trade-offs.

#### Gap/Break (Separation)
Visual whitespace or barrier between sections. Use for: phase changes, context resets, boundaries.

#### Lines as Structure
Use lines (type: `line`, not arrows) as primary structural elements instead of boxes:
- **Timelines**: Vertical or horizontal line with small dots (10-20px ellipses) at intervals, free-floating labels beside each dot
- **Tree structures**: Vertical trunk line + horizontal branch lines, with free-floating text labels (no boxes needed)
- **Dividers**: Thin dashed lines to separate sections
- **Flow spines**: A central line that elements relate to, rather than connecting boxes

```
Timeline:           Tree:
  ●─── Label 1        │
  │                   ├── item
  ●─── Label 2        │   ├── sub
  │                   │   └── sub
  ●─── Label 3        └── item
```

Lines + free-floating text often creates a cleaner result than boxes + contained text.

---

## Shape Meaning

Choose shape based on what it represents—or use no shape at all:

| Concept Type | Shape | Why |
|--------------|-------|-----|
| Labels, descriptions, details | **none** (free-floating text) | Typography creates hierarchy |
| Section titles, annotations | **none** (free-floating text) | Font size/weight is enough |
| Markers on a timeline | small `ellipse` (10-20px) | Visual anchor, not container |
| Start, trigger, input | `ellipse` | Soft, origin-like |
| End, output, result | `ellipse` | Completion, destination |
| Decision, condition | `diamond` | Classic decision symbol |
| Process, action, step | `rectangle` | Contained action |
| Abstract state, context | overlapping `ellipse` | Fuzzy, cloud-like |
| Hierarchy node | lines + text (no boxes) | Structure through lines |

**Rule**: Default to no container. Add shapes only when they carry meaning. Aim for <30% of text elements to be inside containers.

Template:
Variant: Clean pipeline, emoji icons, conversational labels, tagline at bottom.zone-based, more of an infographic feel with numbered badges.feedback loop arrow, examples under each step, and a "secret sauce" callout at the bottom.

**For reports** (`--format=report`):

- Detailed prose with subsections (H3), tables, code blocks
- Blockquotes render as callout boxes
- Each H2 becomes a new page

**For slides** (`--format=slides`):

- Concise bullet points only — slides clip if overloaded
- Each H2 becomes a new slide
- Sections with code blocks get dark code-slide layout automatically

### 3. Render to PDF

```bash
node .claude/skills/report-render/render.js <input>.md --format=report -o <output>.pdf
# or
node .claude/skills/report-render/render.js <input>.md --format=slides -o <output>.pdf
```

Then open the PDF for the user:

```bash
open -a "Google Chrome" <output>.pdf
# or on Linux:
xdg-open <output>.pdf
```

-----

## Resolving the Input File

When the skill is invoked, determine the Markdown source in this order:

1. **Explicit path** — user provided a file path → use it directly
2. **Current project** — look for `report.md`, `docs/report.md`, or `<project-name>.md` in cwd
3. **Generate from content** — user provided raw content or asked to "write a report on X" → write the `.md` file first, then render

Never regenerate templates. Never re-run Step 1 or Step 2 unless the user explicitly asks to update the brand or templates.

-----

## Troubleshooting

| Problem                   | Fix                                                                |
|---------------------------|--------------------------------------------------------------------|
| Content clipped on slides | Reduce bullet points per slide; split into multiple H2 sections    |
| Fonts not rendering       | Ensure template uses web-safe fonts or embeds via base64           |
| PDF page size wrong       | Check Puppeteer `format` option matches template (A4 vs custom)    |
| Template not found        | Verify `.claude/skills/report-render/` path; run setup steps if missing |