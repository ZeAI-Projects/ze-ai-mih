"""Investor pitch question visibility shared by API validation and saving.

Q25 is the switch; Q20-Q24 and Q26 are conditional according to the
approved MIIH questionnaire. Existing form versions may be missing the
visibility_rules flag, so preserve compatibility with legacy numbering.
"""

PITCH_LEGACY_NUMBERS = frozenset({20, 21, 22, 23, 24, 26})


def is_pitch_dependent(question: dict) -> bool:
    if question.get('field_key') == 'investor_pitch_interest':
        return False
    rules = question.get('visibility_rules') or {}
    legacy = question.get('legacy_question_number')
    try:
        legacy = int(legacy) if legacy is not None else None
    except (ValueError, TypeError):
        legacy = None
    return (rules.get('only_if_pitch_interest') is True
            or question.get('answer_scope') == 'PITCH'
            or legacy in PITCH_LEGACY_NUMBERS)
