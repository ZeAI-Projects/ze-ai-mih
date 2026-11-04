from fastapi import HTTPException
from src.repository.query_utils import one,many
from src.service.access_service import require
from pydantic import BaseModel,Field,ConfigDict

class Preset(BaseModel):
    model_config=ConfigDict(extra='forbid')
    name:str=Field(min_length=2,max_length=150)
    dataset:str=Field(pattern=r'^(TEAMS|MEMBERS|PAYMENTS|ANSWERS)$')
    file_format:str=Field(default='XLSX',pattern=r'^(XLSX|CSV)$')
    filters:dict=Field(default_factory=dict)
    columns:list[str]=Field(default_factory=list)
    is_shared:bool=False

async def all_presets(db,admin):
    await require(db,admin,'EXPORT_VIEW')
    return await many(db,'''SELECT id,preset_name,dataset,filter_definition,column_definition,
      default_format,header_hex,is_shared,created_at FROM public.export_presets
      WHERE created_by_admin_id=:actor OR is_shared ORDER BY created_at DESC''',{'actor':admin['id']})

async def save(db,admin,payload):
    await require(db,admin,'EXPORT_CREATE')
    if payload.dataset=='PAYMENTS' and admin['role']!='SUPER_ADMIN':
        raise HTTPException(403,'Cannot save payment exports')
    # The preset is data only. Exports recheck dataset permissions on every request.
    import json
    row=await one(db,'''INSERT INTO public.export_presets
     (created_by_admin_id,preset_name,dataset,filter_definition,column_definition,
      default_format,is_shared,created_by)
     VALUES (:actor,:name,:dataset,cast(:filters AS jsonb),cast(:columns AS jsonb),
       :format,:shared,:actor) RETURNING id,preset_name,dataset,is_shared''',
      {'actor':admin['id'],'name':payload.name,'dataset':payload.dataset,
       'filters':json.dumps(payload.filters),'columns':json.dumps(payload.columns),
       'format':payload.file_format,'shared':payload.is_shared})
    await db.commit()
    return row
