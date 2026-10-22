"""Regression tests for MIIH conditional pitch questions and Storage config."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from config import Settings
from src.service.pitch_conditions import is_pitch_dependent
from src.service.storage_service import server_headers


@pytest.mark.parametrize('number', [20, 21, 22, 23, 24, 26])
def test_legacy_pitch_questions_are_conditional(number):
    assert is_pitch_dependent({
        'field_key': f'pitch_q{number}',
        'legacy_question_number': number,
        'answer_scope': 'TEAM',
        'visibility_rules': {},
    })


def test_pitch_interest_question_is_never_hidden():
    assert not is_pitch_dependent({
        'field_key': 'investor_pitch_interest',
        'legacy_question_number': 25,
        'answer_scope': 'TEAM',
        'visibility_rules': {},
    })


def test_explicit_rules_and_pitch_scope_work():
    assert is_pitch_dependent({'field_key': 'idea', 'visibility_rules': {'only_if_pitch_interest': True}})
    assert is_pitch_dependent({'field_key': 'idea', 'answer_scope': 'PITCH'})
    assert not is_pitch_dependent({'field_key': 'communication_consent', 'answer_scope': 'TEAM'})


def test_existing_service_role_key_is_storage_key():
    settings = Settings(
        supabase_url='https://example.supabase.co',
        supabase_publishable_key='test',
        database_url='postgresql://user:password@localhost:5432/test',
        supabase_service_role_key='test-service-role-token',
        supabase_secret_key='',
    )
    assert settings.storage_server_key == 'test-service-role-token'
    assert server_headers(settings)['Authorization'] == 'Bearer test-service-role-token'


def test_new_secret_key_is_supported():
    settings = SimpleNamespace(storage_server_key='sb_secret_example')
    assert server_headers(settings) == {'apikey': 'sb_secret_example'}


def test_storage_missing_key_gives_controlled_service_error():
    with pytest.raises(HTTPException) as ex:
        server_headers(SimpleNamespace(storage_server_key=''))
    assert ex.value.status_code == 503
