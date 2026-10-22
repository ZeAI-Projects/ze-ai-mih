from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator
import re

class Locked(BaseModel):
    model_config=ConfigDict(extra='forbid')

class Member(Locked):
    full_name:str=Field(min_length=2,max_length=200)
    email:str=Field(min_length=5,max_length=254)
    mobile:str=Field(min_length=7,max_length=30)

    @field_validator('full_name','email','mobile', mode='before')
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value,str) else value

    @field_validator('email')
    @classmethod
    def valid_email(cls, value):
        if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+',value):
            raise ValueError('Enter a valid email address')
        return value

    @field_validator('mobile')
    @classmethod
    def valid_mobile(cls, value):
        if not re.fullmatch(r'\+?[0-9 ()-]+',value) or not 7<=len(re.sub(r'\D','',value))<=15:
            raise ValueError('Enter a valid mobile number')
        return value

class TeamUpdate(Locked):
    team_name:str=Field(min_length=2,max_length=200)
    source_team_id:str|None=Field(default=None,max_length=100)
    participant_category:str|None=Field(default=None,max_length=60)
    domain_id:UUID|None=None
    investor_pitch_interest:bool|None=None
    members:list[Member]=Field(min_length=1,max_length=20)

class Answer(Locked):
    question_id:UUID
    member_order:int|None=Field(default=None,ge=1)
    value:object|None=None
    file_id:UUID|None=None
    clear:bool=False
    @model_validator(mode='after')
    def has_answer(self):
        if not self.clear and self.value is None and self.file_id is None: raise ValueError('Answer required')
        if self.clear and (self.value is not None or self.file_id is not None): raise ValueError('Cleared answers cannot contain a value')
        return self

class AnswersUpdate(Locked):
    answers:list[Answer]=Field(min_length=1,max_length=250)

class PaymentEvidence(Locked):
    transaction_id:str=Field(min_length=4,max_length=150)
    proof_file_id:UUID

class SubmissionView(Locked):
    errors:list[str]
    can_submit:bool
