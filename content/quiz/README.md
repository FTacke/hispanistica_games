# Quiz Content

This directory contains all quiz content imported into the database at build/deploy time.

## Structure

```
content/quiz/
├── topics/          # Quiz unit JSON files (quiz_unit_v1/v2 schema)
│   ├── aussprache.json
│   ├── kreativitaet.json
│   ├── orthographie.json
│   └── variation_grammatik.json
└── media/           # Media assets (audio, images)
    ├── audio/
    └── images/
```

## Workflow

1. **Edit content:** Modify JSON files in `topics/`
2. **Normalize:** `python scripts/quiz_units_normalize.py --write --topics-dir content/quiz/topics`
3. **Seed database:** `python scripts/quiz_seed.py --topics-dir content/quiz/topics`

## Schema Documentation

See [docs/components/quiz/CONTENT.md](../../docs/components/quiz/CONTENT.md) for detailed schema and authoring guide.

## Template

See [docs/components/quiz/examples/quiz_template.json](../../docs/components/quiz/examples/quiz_template.json) for a template.
