from pptx import Presentation

TEMPLATE = "templates/mgm-Template-2024.pptx"

RENAME_MAP = {
    "Titel":   "Title Slide",
    "Content": "Title and Content",
    "Chapter": "Section Header",
}

prs = Presentation(TEMPLATE)
for layout in prs.slide_master.slide_layouts:
    if layout.name in RENAME_MAP:
        new_name = RENAME_MAP[layout.name]
        print(f"Renaming '{layout.name}' → '{new_name}'")
        layout.name = new_name

prs.save(TEMPLATE)
print("Done. Template saved.")
