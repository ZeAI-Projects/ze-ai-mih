from src.repository.query_utils import one,many,scalar

class RegistrationRepository:
    def __init__(self,db): self.db=db

    async def registration(self,rid,lock=False):
        return await one(self.db,'''SELECT r.*,e.edition_code,e.min_team_size,e.max_team_size,
        e.default_team_size,e.status AS edition_status,e.is_published
        FROM public.team_registrations r JOIN public.hackathon_editions e ON e.id=r.edition_id
        WHERE r.id=:rid '''+('FOR UPDATE OF r' if lock else ''),{'rid':rid})

    async def questions(self,version):
        return await many(self.db,'''SELECT q.*,s.section_key FROM public.form_questions q
          JOIN public.form_sections s ON s.id=q.section_id
          WHERE s.form_version_id=:version AND q.is_active AND s.is_active''',{'version':version})

    async def members(self,rid):
        return await many(self.db,'''SELECT id,member_order,role,full_name,email,mobile
          FROM public.team_members WHERE registration_id=:rid ORDER BY member_order''',{'rid':rid})

    async def snapshot(self,rid):
        row=await self.registration(rid)
        if not row:return None
        return {'id':row['id'],'registration_code':row['registration_code'], 'status':row['status'],
            'team_name':row['team_name'],'domain_id':row['domain_id'],
            'investor_pitch_interest':row['investor_pitch_interest'],
            'edition_code':row['edition_code'],'members':await self.members(rid)}
