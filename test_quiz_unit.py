"""Test quiz unit loading and validation."""
import json
from pathlib import Path

unit_file = Path('game_modules/quiz/quiz_units/topics/variation_in_der_aussprache.json')
data = json.loads(unit_file.read_text(encoding='utf-8'))

print(f"✓ Loaded unit: {data['slug']}")
print(f"✓ Title: {data['title']}")
print(f"✓ Authors: {', '.join(data['authors'])}")
print(f"✓ Questions: {len(data['questions'])}")
print(f"✓ Description length: {len(data['description'])} chars")

# Validate schema
assert data['schema_version'] == 'quiz_unit_v1'
assert len(data['authors']) >= 1
assert len(data['questions']) >= 1

# Check first question
q1 = data['questions'][0]
assert 'prompt' in q1
assert 'explanation' in q1
assert len(q1['answers']) == 4

print("\n✓✓✓ JSON validation successful! ✓✓✓")
