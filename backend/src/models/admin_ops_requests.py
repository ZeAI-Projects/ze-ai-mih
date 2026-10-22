from uuid import UUID
from datetime import datetime
from typing import Any
from pydantic import BaseModel,ConfigDict,Field

class Strict(BaseModel):model_config=ConfigDict(extra='forbid')
class EditionUpdate(Strict):
    title:str|None=None
    tagline:str|None=None
    description:str|None=None
    starts_at:datetime|None=None
    ends_at:datetime|None=None
    registration_opens_at:datetime|None=None
    registration_closes_at:datetime|None=None
    venue:str|None=None
    location:str|None=None
    event_mode:str|None=None
    eligibility_text:str|None=None
    guidelines_text:str|None=None
    min_team_size:int|None=Field(default=None,ge=1,le=20)
    max_team_size:int|None=Field(default=None,ge=1,le=20)
    default_team_size:int|None=Field(default=None,ge=1,le=20)
class ContentRevision(Strict):
    text_value:str|None=None
    link_url:str|None=None
    alt_text:str|None=None
    asset_file_id:UUID|None=None
    poster_file_id:UUID|None=None
    content_json:dict[str,Any]=Field(default_factory=dict)
    display_order:int=0
    is_visible:bool=True
class FormVersionRename(Strict):
    name: str = Field(min_length=2, max_length=150)

class QuestionUpdate(Strict):
    question_label:str|None=None
    description:str|None=None
    placeholder:str|None=None
    is_required:bool|None=None
    is_active:bool|None=None
    display_order:int|None=None
    validation_rules:dict[str,Any]|None=None
    visibility_rules:dict[str,Any]|None=None
class NewQuestion(Strict):
    field_key:str=Field(pattern=r'^[a-z][a-z0-9_]{1,88}$')
    question_label:str=Field(min_length=1,max_length=500)
    input_type:str
    answer_scope:str
    is_required:bool=True
    display_order:int=0
class OptionUpdate(Strict):
    option_value:str=Field(min_length=1,max_length=150)
    option_label:str=Field(min_length=1,max_length=255)
    display_order:int=0
    is_active:bool=True
class PaymentSettingsUpdate(Strict):
    button_label:str=Field(min_length=2,max_length=100)
    razorpay_payment_url:str|None=None
    fee_amount:float=Field(default=0,ge=0)
    payment_required:bool=False
    proof_required:bool=False
    activate:bool=False
    instructions:str|None=None
class PaymentReview(Strict):
    status:str=Field(pattern=r'^(VERIFIED|REJECTED)$')
    rejection_reason:str|None=None
class TeamReview(Strict):
    status:str=Field(pattern=r'^(APPROVED|REJECTED|REVIEW)$')
    reason:str|None=None
class ExportRequest(Strict):
    dataset:str=Field(pattern=r'^(TEAMS|MEMBERS|PAYMENTS|ANSWERS|STATISTICS|EDITION_HISTORY)$')
    file_format:str=Field(default='XLSX',pattern=r'^(CSV|XLSX|JSON)$')
    edition_id:UUID|None=None
    status:str|None=None
    domain_id:UUID|None=None
    date_from:datetime|None=None
    date_to:datetime|None=None
    columns:list[str]|None=None

class EventBlock(Strict):
    block_key:str=Field(pattern=r'^[a-zA-Z][a-zA-Z0-9_-]{0,99}$')
    block_type:str=Field(pattern=r'^(ANNOUNCEMENT|FAQ|DETAIL|INSTRUCTION)$')
    title:str|None=None
    body:str|None=None
    content_json:dict[str,Any]=Field(default_factory=dict)
    asset_file_id:UUID|None=None
    display_order:int=0
    is_visible:bool=True

class EditionHighlight(Strict):
    title:str=Field(min_length=1,max_length=255)
    description:str|None=None
    highlight_date:str|None=None
    media_file_id:UUID|None=None
    metrics_json:dict[str,Any]=Field(default_factory=dict)
    display_order:int=0
    is_visible:bool=True
