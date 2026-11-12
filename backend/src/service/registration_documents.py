# Registration documents. Issue a paid receipt only for a VERIFIED transaction.
from io import BytesIO
from functools import lru_cache
from decimal import Decimal
from pathlib import Path
from fastapi import HTTPException
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from src.repository.query_utils import one, many
from src.repository.registration_repository import RegistrationRepository
from src.service.registration_service import verify_draft_token

PURPLE = colors.HexColor('#8C52FF')
ASSET_PATH = Path(__file__).resolve().parents[2] / 'assets'
LOGO_PATH = ASSET_PATH / 'made-in-india-logo.png'
LABX_LOGO_PATH = ASSET_PATH / 'labx-original.webp'

@lru_cache(maxsize=1)
def _light_labx_logo():
    if not LABX_LOGO_PATH.is_file():
        raise FileNotFoundError(f'Registration PDF LabX logo is missing: {LABX_LOGO_PATH}')
    image=PILImage.open(LABX_LOGO_PATH).convert('RGBA')
    pixels=image.load()
    for y in range(image.height):
        for x in range(image.width):
            red,green,blue,alpha=pixels[x,y]
            if alpha and min(red,green,blue)>220 and max(red,green,blue)-min(red,green,blue)<24:
                pixels[x,y]=(48,40,62,alpha)
    output=BytesIO()
    image.save(output,format='PNG')
    return output.getvalue()

def _paragraph(value):
    from xml.sax.saxutils import escape
    return escape(str(value if value is not None else '—'))

def _make_pdf(title, rows, members=None, note=None):
    out = BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4, topMargin=19*mm,
                            leftMargin=18*mm, rightMargin=18*mm,
                            bottomMargin=19*mm, title=title)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='ZeaiBody',parent=styles['Normal'],fontSize=9,leading=14))
    if not LOGO_PATH.is_file():
        raise FileNotFoundError(f'Registration PDF logo is missing: {LOGO_PATH}')
    if not LABX_LOGO_PATH.is_file():
        raise FileNotFoundError(f'Registration PDF LabX logo is missing: {LABX_LOGO_PATH}')
    logo=Image(str(LOGO_PATH))
    logo._restrictSize(70*mm,25*mm)
    labx_buffer=BytesIO(_light_labx_logo())
    labx_buffer.seek(0)
    labx_logo=Image(labx_buffer)
    labx_logo._restrictSize(38*mm,18*mm)
    branding=Table([[logo,labx_logo]],colWidths=[115*mm,55*mm],rowHeights=[25*mm],hAlign='LEFT')
    branding.setStyle(TableStyle([
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('ALIGN',(0,0),(0,0),'LEFT'),
        ('ALIGN',(1,0),(1,0),'RIGHT'),
        ('LEFTPADDING',(0,0),(-1,-1),0),
        ('RIGHTPADDING',(0,0),(-1,-1),0),
        ('TOPPADDING',(0,0),(-1,-1),0),
        ('BOTTOMPADDING',(0,0),(-1,-1),0),
    ]))
    story=[branding,Spacer(1,6),
           Paragraph(_paragraph(title),styles['Heading2']),Spacer(1,9)]
    def table(lines):
        data=[[Paragraph(_paragraph(a),styles['ZeaiBody']),Paragraph(_paragraph(b),styles['ZeaiBody'])]
              for a,b in lines]
        t=Table(data,colWidths=[46*mm,125*mm],hAlign='LEFT',repeatRows=0)
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(0,-1),colors.HexColor('#F6F1FD')),
                               ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),
                               ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
                               ('LINEBELOW',(0,0),(-1,-1),0.3,colors.HexColor('#E2D8EA'))]))
        return t
    story.append(table(rows))
    if members:
        story.extend([Spacer(1,16),Paragraph('Team members',styles['Heading3'])])
        for index,member in enumerate(members,1):
            story.append(table([('Member '+str(index),member['full_name']),
                                ('Role',member['role']),('Email',member['email']),
                                ('Mobile',member['mobile'])]))
            story.append(Spacer(1,9))
    if note:
        story.extend([Spacer(1,14),Paragraph(_paragraph(note),styles['ZeaiBody'])])
    doc.build(story)
    return out.getvalue()

async def _authorized_registration(db,rid,token):
    reg=await RegistrationRepository(db).registration(rid)
    verify_draft_token(reg,token)
    if reg['status']=='DRAFT':
        raise HTTPException(409,'Submit registration before downloading documents')
    result=await one(db,"""SELECT r.id,r.team_id,r.team_name,r.registration_code,
         r.submitted_at,r.status,r.investor_pitch_interest,e.edition_code,e.title,
         d.domain_name, p.payment_required
         FROM public.team_registrations r
         JOIN public.hackathon_editions e ON e.id=r.edition_id
         LEFT JOIN public.domains d ON d.id=r.domain_id
         LEFT JOIN public.payment_settings p ON p.id=r.payment_setting_id
         WHERE r.id=:id""",{'id':rid})
    if not result or not result['team_id']:
        raise HTTPException(409,'Team ID has not been assigned')
    return result

async def confirmation(db,rid,token):
    r=await _authorized_registration(db,rid,token)
    members=await RegistrationRepository(db).members(rid)
    payment=await one(db,"""SELECT status,transaction_id,claimed_amount,currency FROM public.payment_submissions
       WHERE registration_id=:id ORDER BY submitted_at DESC LIMIT 1""",{'id':rid})
    payment_free=not r['payment_required'] and r['edition_code']=='MIIH_TEST_48H'
    stamp=r['submitted_at'].strftime('%d %b %Y %H:%M UTC') if r['submitted_at'] else '—'
    rows=[('Team ID',r['team_id']),('Registration reference',r['registration_code']),
          ('Team name',r['team_name']),('Domain',r['domain_name']),
          ('Edition',r['title']),('Submitted',stamp),('Registration','Submitted')]
    if payment_free:
        rows.extend([('Registration fee','INR 0.00 / Payment Not Required'),('Transaction ID','Not applicable')])
    elif payment:
        rows.extend([('Registration fee',
                      f"{payment['currency']} {Decimal(str(payment['claimed_amount'])):.2f}"),
                     ('Transaction ID',payment['transaction_id'])])
    return _make_pdf('Registration confirmation',rows,members,
        'Thank you for registering. The organizing team will contact you by email with selection updates.')

async def verified_payment_receipt(db,rid,token):
    r=await _authorized_registration(db,rid,token)
    payment=await one(db,"""SELECT p.transaction_id,p.claimed_amount,p.currency,p.verified_at
      FROM public.payment_submissions p
      WHERE p.registration_id=:id AND p.status='VERIFIED'
      ORDER BY p.verified_at DESC LIMIT 1""",{'id':rid})
    if not payment:
        raise HTTPException(409,'Paid receipt is unavailable until payment is verified')
    lines=[('Team ID',r['team_id']),('Registration reference',r['registration_code']),
           ('Team name',r['team_name']),('Transaction ID',payment['transaction_id']),
           ('Verified amount',f"{payment['currency']} {Decimal(str(payment['claimed_amount'])):.2f}"),
           ('Verification date',payment['verified_at'].strftime('%d %b %Y %H:%M UTC') if payment['verified_at'] else '—'),
           ('Status','VERIFIED')]
    return _make_pdf('Verified payment receipt',lines,note=
       'Organizer verification receipt. Not a tax invoice or an official Razorpay-issued receipt.')
