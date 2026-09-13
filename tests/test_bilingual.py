"""Run with python tests/test_bilingual.py (requires numpy)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import relight

for name, cls in relight.NODE_CLASS_MAPPINGS.items():
    assert cls.CATEGORY == 'BruxosDoVFX/Relight H3'
    assert 'BruxosDoVFX' in relight.NODE_DISPLAY_NAME_MAPPINGS[name]
    assert 'EN:' in cls.DESCRIPTION
    for group in cls.INPUT_TYPES().values():
        for field, spec in group.items():
            tip = spec[1]['tooltip']
            assert tip.startswith('PT: ') and '\n\nEN: ' in tip, field
    assert len(cls.OUTPUT_TOOLTIPS) == len(cls.RETURN_TYPES)
    for tip in cls.OUTPUT_TOOLTIPS:
        assert tip.startswith('PT: ') and '\n\nEN: ' in tip
print('ok bilingual metadata for both nodes and every input/output')
