from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import io
import base64
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Helpers ──
def normalize_phone(phone: str) -> str:
    cleaned = re.sub(r'[\s\-\(\)\+]', '', phone)
    if len(cleaned) == 10 and cleaned.isdigit():
        return f"+91{cleaned}"
    if len(cleaned) == 12 and cleaned.startswith("91"):
        return f"+{cleaned}"
    if len(cleaned) == 13 and cleaned.startswith("+91"):
        return cleaned
    return f"+91{cleaned[-10:]}" if len(cleaned) >= 10 else cleaned

async def get_next_visitor_id() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"VIS-{today}-"
    last = await db.visitors.find(
        {"visitor_id": {"$regex": f"^{prefix}"}},
        {"_id": 0, "visitor_id": 1}
    ).sort("visitor_id", -1).limit(1).to_list(1)
    if last:
        seq = int(last[0]["visitor_id"].split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"

async def log_audit(action: str, visitor_id: str, details: str = ""):
    await db.audit_log.insert_one({
        "action": action,
        "visitor_id": visitor_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

# ── Models ──
class HostCreate(BaseModel):
    name: str
    email: str
    department: str
    phone: str = ""
    active: bool = True

class HostUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    active: Optional[bool] = None

class CheckInRequest(BaseModel):
    name: str
    phone: str
    company: str = ""
    purpose: str
    department: str
    host_id: str
    host_name: str
    host_email: str
    photo: str  # base64 encoded

class CheckOutRequest(BaseModel):
    visitor_id: str

class BlacklistCreate(BaseModel):
    phone: str
    name: str = ""
    reason: str = ""

class BlacklistUpdate(BaseModel):
    reason: Optional[str] = None
    active: Optional[bool] = None

# ── Phone Lookup (returning visitor) ──
@api_router.get("/visitors/lookup")
async def lookup_visitor_by_phone(phone: str):
    normalized = normalize_phone(phone)
    # Check blacklist first
    blacklisted = await db.blacklist.find_one({"phone": normalized, "active": True}, {"_id": 0})
    if blacklisted:
        return {"found": False, "blacklisted": True, "blacklist_reason": blacklisted.get("reason", ""), "blacklist_name": blacklisted.get("name", "")}

    visits = await db.visitors.find(
        {"phone": normalized},
        {"_id": 0, "photo": 0}
    ).sort("in_time", -1).to_list(100)

    if not visits:
        return {"found": False, "blacklisted": False, "visits": []}

    latest = visits[0]
    return {
        "found": True,
        "blacklisted": False,
        "name": latest.get("name", ""),
        "company": latest.get("company", ""),
        "visit_count": len(visits),
        "visits": visits
    }

# ── Blacklist Routes ──
@api_router.get("/blacklist")
async def get_blacklist():
    items = await db.blacklist.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"blacklist": items}

@api_router.post("/blacklist")
async def add_to_blacklist(req: BlacklistCreate):
    normalized = normalize_phone(req.phone)
    existing = await db.blacklist.find_one({"phone": normalized})
    if existing:
        await db.blacklist.update_one({"phone": normalized}, {"$set": {"active": True, "reason": req.reason, "name": req.name}})
        return {"message": "Blacklist entry updated"}
    entry = {
        "id": str(ObjectId()),
        "phone": normalized,
        "name": req.name,
        "reason": req.reason,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.blacklist.insert_one(entry)
    await log_audit("BLACKLIST_ADD", "", f"Phone {normalized} ({req.name}) blacklisted: {req.reason}")
    return {"message": "Added to blacklist", "entry": {k: v for k, v in entry.items() if k != "_id"}}

@api_router.put("/blacklist/{item_id}")
async def update_blacklist(item_id: str, update: BlacklistUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    result = await db.blacklist.update_one({"id": item_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Blacklist entry not found")
    return {"message": "Blacklist entry updated"}

@api_router.delete("/blacklist/{item_id}")
async def remove_from_blacklist(item_id: str):
    result = await db.blacklist.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blacklist entry not found")
    await log_audit("BLACKLIST_REMOVE", "", f"Blacklist entry {item_id} removed")
    return {"message": "Removed from blacklist"}

# ── Department Routes ──
DEPARTMENTS = [
    "HR", "Accounts", "IT", "Shipping", "Marketing",
    "Management", "Engineering", "Quality", "Production",
    "Tool Room", "Store"
]

@api_router.get("/departments")
async def get_departments():
    return {"departments": DEPARTMENTS}

# ── Host Routes ──
@api_router.get("/hosts")
async def get_hosts(department: Optional[str] = None, active_only: bool = True):
    query = {}
    if department:
        query["department"] = department
    if active_only:
        query["active"] = True
    hosts = await db.hosts.find(query, {"_id": 0}).to_list(500)
    return {"hosts": hosts}

@api_router.post("/hosts")
async def create_host(host: HostCreate):
    host_dict = host.model_dump()
    host_dict["id"] = str(ObjectId())
    host_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    doc = {**host_dict}
    await db.hosts.insert_one(doc)
    return {"host": host_dict}

@api_router.put("/hosts/{host_id}")
async def update_host(host_id: str, update: HostUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.hosts.update_one({"id": host_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Host not found")
    host = await db.hosts.find_one({"id": host_id}, {"_id": 0})
    return {"host": host}

@api_router.delete("/hosts/{host_id}")
async def delete_host(host_id: str):
    result = await db.hosts.delete_one({"id": host_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Host not found")
    return {"message": "Host deleted"}

# ── Visitor Routes ──
@api_router.post("/visitors/checkin")
async def checkin_visitor(req: CheckInRequest):
    visitor_id = await get_next_visitor_id()
    normalized_phone = normalize_phone(req.phone)

    # Check blacklist
    blacklisted = await db.blacklist.find_one({"phone": normalized_phone, "active": True})
    if blacklisted:
        raise HTTPException(status_code=403, detail=f"This visitor is BLACKLISTED. Reason: {blacklisted.get('reason', 'No reason specified')}")

    # Check for returning visitor
    prev = await db.visitors.find(
        {"phone": normalized_phone},
        {"_id": 0, "name": 1, "company": 1, "visit_count": 1}
    ).sort("in_time", -1).limit(1).to_list(1)
    visit_count = (prev[0].get("visit_count", 1) + 1) if prev else 1

    visitor = {
        "visitor_id": visitor_id,
        "name": req.name,
        "phone": normalized_phone,
        "company": req.company,
        "purpose": req.purpose,
        "department": req.department,
        "host_id": req.host_id,
        "host_name": req.host_name,
        "host_email": req.host_email,
        "photo": req.photo,
        "in_time": datetime.now(timezone.utc).isoformat(),
        "out_time": None,
        "status": "IN",
        "visit_count": visit_count,
    }
    await db.visitors.insert_one({**visitor})
    await log_audit("CHECK_IN", visitor_id, f"{req.name} checked in to meet {req.host_name}")

    # Mock email notification
    logger.info(f"[EMAIL] To: {req.host_email} | Subject: Visitor {req.name} has arrived | Body: {req.name} from {req.company} is here to see you. Purpose: {req.purpose}. Visitor ID: {visitor_id}")
    await db.email_log.insert_one({
        "to": req.host_email,
        "subject": f"Visitor {req.name} has arrived - {visitor_id}",
        "body": f"{req.name} from {req.company} is here to see you.\nPurpose: {req.purpose}\nVisitor ID: {visitor_id}\nPhone: {normalized_phone}",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "status": "MOCKED"
    })

    # Remove photo from response (too large), and _id
    response_visitor = {k: v for k, v in visitor.items() if k not in ("photo", "_id")}
    response_visitor["has_photo"] = True
    return {"visitor": response_visitor, "message": f"Visitor checked in successfully. Email notification sent to {req.host_email}"}

@api_router.post("/visitors/checkout")
async def checkout_visitor(req: CheckOutRequest):
    out_time = datetime.now(timezone.utc).isoformat()
    result = await db.visitors.update_one(
        {"visitor_id": req.visitor_id, "status": "IN"},
        {"$set": {"out_time": out_time, "status": "OUT"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Active visitor not found")
    await log_audit("CHECK_OUT", req.visitor_id, f"Visitor checked out")
    return {"message": "Visitor checked out", "out_time": out_time}

@api_router.get("/visitors/active")
async def get_active_visitors():
    visitors = await db.visitors.find(
        {"status": "IN"},
        {"_id": 0, "photo": 0}
    ).sort("in_time", -1).to_list(500)
    return {"visitors": visitors}

@api_router.get("/visitors/search")
async def search_visitors(
    phone: Optional[str] = None,
    visitor_id: Optional[str] = None,
    name: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    query = {}
    if phone:
        normalized = normalize_phone(phone)
        query["phone"] = {"$regex": re.escape(normalized[-10:]), "$options": "i"}
    if visitor_id:
        query["visitor_id"] = {"$regex": re.escape(visitor_id), "$options": "i"}
    if name:
        query["name"] = {"$regex": re.escape(name), "$options": "i"}
    if status:
        query["status"] = status
    if date_from:
        query.setdefault("in_time", {})["$gte"] = date_from
    if date_to:
        query.setdefault("in_time", {})["$lte"] = date_to

    skip = (page - 1) * limit
    total = await db.visitors.count_documents(query)
    visitors = await db.visitors.find(
        query, {"_id": 0, "photo": 0}
    ).sort("in_time", -1).skip(skip).limit(limit).to_list(limit)
    return {"visitors": visitors, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.get("/visitors/{visitor_id}")
async def get_visitor(visitor_id: str):
    visitor = await db.visitors.find_one({"visitor_id": visitor_id}, {"_id": 0})
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    return {"visitor": visitor}

@api_router.get("/visitors/{visitor_id}/photo")
async def get_visitor_photo(visitor_id: str):
    visitor = await db.visitors.find_one({"visitor_id": visitor_id}, {"_id": 0, "photo": 1})
    if not visitor or not visitor.get("photo"):
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"photo": visitor["photo"]}

# ── PDF Slip Generation (Gate Pass Template) ──
@api_router.get("/visitors/{visitor_id}/slip")
async def get_visitor_slip(visitor_id: str):
    visitor = await db.visitors.find_one({"visitor_id": visitor_id}, {"_id": 0})
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm, cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Spacer, Paragraph, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from PIL import Image as PILImage
    import qrcode

    PAGE_W, PAGE_H = A4
    buf = io.BytesIO()
    margin = 15*mm
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=10*mm, bottomMargin=10*mm, leftMargin=margin, rightMargin=margin)
    elements = []

    navy = colors.HexColor('#003366')
    orange = colors.HexColor('#ff6b35')
    dark = colors.HexColor('#333333')
    gray = colors.HexColor('#666666')
    light_blue = colors.HexColor('#f0f7ff')
    white = colors.HexColor('#FFFFFF')
    light_gray = colors.HexColor('#fafafa')
    border_gray = colors.HexColor('#e0e0e0')

    usable_w = PAGE_W - 2 * margin

    # ── Header with Logo ──
    logo_path = ROOT_DIR / "king_logo.png"
    logo_cell = ""
    try:
        if logo_path.exists():
            logo_img = Image(str(logo_path), width=18*mm, height=18*mm)
            logo_cell = logo_img
    except Exception:
        pass

    company_style = ParagraphStyle('CompanyName', fontName='Helvetica-Bold', fontSize=20, textColor=white, leading=24, spaceAfter=0)
    loc_style = ParagraphStyle('CompanyLoc', fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#cccccc'), leading=12)
    company_para = Paragraph("KING GROUP", company_style)
    loc_para = Paragraph("kinggroup.in", loc_style)

    header_data = [[company_para, logo_cell], [loc_para, ""]]
    header_table = Table(header_data, colWidths=[usable_w - 22*mm, 22*mm])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), navy),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8*mm),
        ('RIGHTPADDING', (-1, 0), (-1, -1), 5*mm),
        ('TOPPADDING', (0, 0), (-1, 0), 6*mm),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 3*mm),
        ('SPAN', (-1, 0), (-1, -1)),
        ('LINEBELOW', (0, -1), (-1, -1), 4, orange),
        ('LINEABOVE', (0, 0), (-1, 0), 4, white),
    ]))
    elements.append(header_table)

    # ── Title: GATE PASS ──
    title_style = ParagraphStyle('GatePassTitle', fontName='Helvetica-Bold', fontSize=32, textColor=navy, alignment=TA_CENTER, spaceAfter=2*mm, spaceBefore=5*mm, leading=38)
    pass_num_style = ParagraphStyle('PassNum', fontName='Courier', fontSize=11, textColor=gray, alignment=TA_CENTER, spaceAfter=3*mm)

    elements.append(Spacer(1, 3*mm))
    title_table_data = [
        [Paragraph("GATE PASS", title_style)],
        [Paragraph(f"ID: {visitor_id}", pass_num_style)]
    ]
    title_table = Table(title_table_data, colWidths=[usable_w])
    title_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f5f7fa')),
        ('TOPPADDING', (0, 0), (0, 0), 5*mm),
        ('BOTTOMPADDING', (0, -1), (0, -1), 3*mm),
        ('LINEBELOW', (0, -1), (-1, -1), 2, navy),
    ]))
    elements.append(title_table)
    elements.append(Spacer(1, 5*mm))

    # ── Section Helper ──
    sect_style = ParagraphStyle('SectionTitle', fontName='Helvetica-Bold', fontSize=11, textColor=navy, spaceBefore=3*mm, spaceAfter=2*mm, leading=14)
    label_style = ParagraphStyle('Label', fontName='Helvetica-Bold', fontSize=10, textColor=dark, leading=14)
    value_style = ParagraphStyle('Value', fontName='Helvetica', fontSize=10, textColor=colors.HexColor('#444444'), leading=14)

    def make_section(title, rows):
        section_title_data = [[Paragraph(title, sect_style)]]
        section_title_table = Table(section_title_data, colWidths=[usable_w])
        section_title_table.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
            ('LINEBELOW', (0, 0), (-1, -1), 1.5, orange),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
        ]))
        elements.append(section_title_table)
        elements.append(Spacer(1, 2*mm))

        table_data = []
        for lbl, val in rows:
            table_data.append([Paragraph(lbl, label_style), Paragraph(str(val), value_style)])

        col1 = usable_w * 0.35
        col2 = usable_w * 0.65
        info_table = Table(table_data, colWidths=[col1, col2])
        row_styles = [
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3*mm),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3*mm),
            ('LEFTPADDING', (0, 0), (0, -1), 3*mm),
            ('LEFTPADDING', (1, 0), (1, -1), 3*mm),
            ('RIGHTPADDING', (-1, 0), (-1, -1), 3*mm),
        ]
        for i in range(len(table_data)):
            bg = light_blue if i % 2 == 0 else light_gray
            row_styles.append(('BACKGROUND', (0, i), (0, i), bg))
            row_styles.append(('BACKGROUND', (1, i), (1, i), light_gray))
            if i < len(table_data) - 1:
                row_styles.append(('LINEBELOW', (0, i), (-1, i), 0.5, border_gray))
        info_table.setStyle(TableStyle(row_styles))
        elements.append(info_table)

    # ── Visitor Details ──
    in_time_str = visitor.get("in_time", "")
    try:
        in_dt = datetime.fromisoformat(in_time_str)
        in_display = in_dt.strftime("%d %b %Y, %I:%M %p")
    except Exception:
        in_display = in_time_str

    make_section("Visitor Details", [
        ("Visitor Name", visitor.get("name", "")),
        ("Mobile Number", visitor.get("phone", "")),
        ("Company/Organization", visitor.get("company", "N/A")),
        ("Purpose of Visit", visitor.get("purpose", "")),
    ])
    elements.append(Spacer(1, 3*mm))

    # ── Host Details ──
    make_section("Host Details", [
        ("Host Name", visitor.get("host_name", "")),
        ("Department", visitor.get("department", "")),
        ("Gate In Time", in_display),
    ])
    elements.append(Spacer(1, 4*mm))

    # ── Photo + QR Code side by side ──
    photo_img = None
    if visitor.get("photo"):
        try:
            photo_data = visitor["photo"]
            if "," in photo_data:
                photo_data = photo_data.split(",")[1]
            img_bytes = base64.b64decode(photo_data)
            pil_img = PILImage.open(io.BytesIO(img_bytes)).convert("RGB")
            clean_buf_photo = io.BytesIO()
            pil_img.save(clean_buf_photo, format="PNG")
            clean_buf_photo.seek(0)
            photo_img = Image(clean_buf_photo, width=30*mm, height=30*mm)
        except Exception as e:
            logger.error(f"Photo error: {e}")

    qr_img = None
    try:
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
        qr.add_data(visitor_id)
        qr.make(fit=True)
        qr_pil = qr.make_image(fill_color="#003366", back_color="white").convert("RGB")
        qr_buf = io.BytesIO()
        qr_pil.save(qr_buf, format="PNG")
        qr_buf.seek(0)
        qr_img = Image(qr_buf, width=30*mm, height=30*mm)
    except Exception as e:
        logger.error(f"QR error: {e}")

    qr_label_style = ParagraphStyle('QRLabel', fontName='Helvetica-Bold', fontSize=9, textColor=navy, alignment=TA_CENTER, spaceAfter=2*mm)
    vid_style = ParagraphStyle('VID', fontName='Courier-Bold', fontSize=10, textColor=navy, alignment=TA_CENTER, spaceBefore=2*mm)

    photo_cell = photo_img if photo_img else Paragraph("No Photo", ParagraphStyle('NP', fontSize=8, alignment=TA_CENTER, textColor=gray))
    qr_cell = qr_img if qr_img else Paragraph("No QR", ParagraphStyle('NQ', fontSize=8, alignment=TA_CENTER, textColor=gray))

    visual_data = [
        [Paragraph("Visitor Photo", qr_label_style), Paragraph("Quick Verification Code", qr_label_style)],
        [photo_cell, qr_cell],
        ["", Paragraph(visitor_id, vid_style)],
    ]
    visual_table = Table(visual_data, colWidths=[usable_w * 0.5, usable_w * 0.5])
    visual_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0f7ff')),
        ('BOX', (0, 0), (-1, -1), 1, border_gray),
        ('LEFTPADDING', (0, 0), (-1, -1), 5*mm),
        ('RIGHTPADDING', (-1, 0), (-1, -1), 5*mm),
    ]))
    elements.append(visual_table)
    elements.append(Spacer(1, 4*mm))

    # ── Authorization & Signatures ──
    sig_label = ParagraphStyle('SigLabel', fontName='Helvetica-Bold', fontSize=9, textColor=dark, leading=12)
    sig_sect_data = [[Paragraph("Authorization &amp; Records", sect_style)]]
    sig_sect_table = Table(sig_sect_data, colWidths=[usable_w])
    sig_sect_table.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
        ('LINEBELOW', (0, 0), (-1, -1), 1.5, orange),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ]))
    elements.append(sig_sect_table)
    elements.append(Spacer(1, 2*mm))

    out_time_str = visitor.get("out_time", "")
    try:
        if out_time_str:
            out_dt = datetime.fromisoformat(out_time_str)
            out_display = out_dt.strftime("%d %b %Y, %I:%M %p")
        else:
            out_display = ""
    except Exception:
        out_display = out_time_str or ""

    sig_data = [
        [Paragraph("Visitor Signature", sig_label), ""],
        [Paragraph("Security Personnel Signature", sig_label), ""],
        [Paragraph("Gate Out Time", sig_label), Paragraph(out_display, value_style)],
    ]
    sig_table = Table(sig_data, colWidths=[usable_w * 0.4, usable_w * 0.6])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ('TOPPADDING', (0, 0), (-1, -1), 5*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
        ('BACKGROUND', (0, 0), (0, -1), light_blue),
        ('BACKGROUND', (1, 0), (1, -1), light_gray),
    ]))
    elements.append(sig_table)
    elements.append(Spacer(1, 4*mm))

    # ── Instructions ──
    instr_title = ParagraphStyle('InstrTitle', fontName='Helvetica-Bold', fontSize=10, textColor=dark, leading=14, spaceBefore=2*mm)
    instr_style = ParagraphStyle('Instr', fontName='Helvetica', fontSize=8, textColor=colors.HexColor('#555555'), leading=12, leftIndent=5*mm)

    instructions = [
        "Keep this pass with you during your visit.",
        "Do not share or transfer this pass to any other person.",
        "In case of emergency, follow all security personnel instructions.",
        "Do not enter areas marked as 'Restricted Access'.",
        "Return this pass to the security gate upon exit.",
    ]
    instr_items = [[Paragraph("Important Instructions", instr_title)]]
    for i, inst in enumerate(instructions):
        instr_items.append([Paragraph(f"{i+1}. {inst}", instr_style)])

    instr_table = Table(instr_items, colWidths=[usable_w])
    instr_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff8e1')),
        ('LEFTPADDING', (0, 0), (-1, -1), 5*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5*mm),
        ('TOPPADDING', (0, 0), (0, 0), 3*mm),
        ('BOTTOMPADDING', (0, -1), (0, -1), 3*mm),
    ]))
    elements.append(instr_table)
    elements.append(Spacer(1, 3*mm))

    # ── Footer ──
    footer_style = ParagraphStyle('Footer', fontName='Helvetica', fontSize=7, textColor=colors.HexColor('#999999'), alignment=TA_CENTER, leading=10)
    elements.append(Paragraph("King Group | kinggroup.in | Visitor Management System", footer_style))
    elements.append(Paragraph(f"Pass generated: {datetime.now(timezone.utc).strftime('%d %b %Y, %I:%M %p UTC')}", footer_style))

    doc.build(elements)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=gatepass_{visitor_id}.pdf"}
    )

# ── Stats ──
@api_router.get("/stats")
async def get_stats():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    active_count = await db.visitors.count_documents({"status": "IN"})
    today_count = await db.visitors.count_documents({"in_time": {"$regex": f"^{today}"}})
    total_count = await db.visitors.count_documents({})
    today_checkout = await db.visitors.count_documents({"in_time": {"$regex": f"^{today}"}, "status": "OUT"})
    return {
        "active_visitors": active_count,
        "today_visitors": today_count,
        "today_checkouts": today_checkout,
        "total_visitors": total_count
    }

# ── Audit Log ──
@api_router.get("/audit-log")
async def get_audit_log(page: int = 1, limit: int = 50):
    skip = (page - 1) * limit
    total = await db.audit_log.count_documents({})
    logs = await db.audit_log.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return {"logs": logs, "total": total}

# ── Email Log ──
@api_router.get("/email-log")
async def get_email_log():
    logs = await db.email_log.find({}, {"_id": 0}).sort("sent_at", -1).to_list(100)
    return {"emails": logs}

# ── Seed Data ──
@api_router.post("/seed")
async def seed_data():
    existing = await db.hosts.count_documents({})
    if existing >= 17:
        return {"message": "Data already seeded", "hosts_count": existing}
    if existing > 0:
        await db.hosts.drop()


    hosts = [
        {"id": str(ObjectId()), "name": "Rajesh Kumar", "email": "rajesh@kinggroup.in", "department": "HR", "phone": "+919876543210", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Priya Sharma", "email": "priya@kinggroup.in", "department": "HR", "phone": "+919876543211", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Amit Patel", "email": "amit@kinggroup.in", "department": "Accounts", "phone": "+919876543212", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Sunita Verma", "email": "sunita@kinggroup.in", "department": "Accounts", "phone": "+919876543213", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Vikram Singh", "email": "vikram@kinggroup.in", "department": "IT", "phone": "+919876543214", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Neha Gupta", "email": "neha@kinggroup.in", "department": "IT", "phone": "+919876543215", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Deepak Joshi", "email": "deepak@kinggroup.in", "department": "Shipping", "phone": "+919876543216", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Kavita Reddy", "email": "kavita@kinggroup.in", "department": "Marketing", "phone": "+919876543217", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Suresh Mehta", "email": "suresh@kinggroup.in", "department": "Management", "phone": "+919876543218", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Anita Desai", "email": "anita@kinggroup.in", "department": "Management", "phone": "+919876543219", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Rohit Agarwal", "email": "rohit@kinggroup.in", "department": "Engineering", "phone": "+919876543220", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Pooja Nair", "email": "pooja@kinggroup.in", "department": "Engineering", "phone": "+919876543221", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Manoj Tiwari", "email": "manoj@kinggroup.in", "department": "Quality", "phone": "+919876543222", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Ritu Saxena", "email": "ritu@kinggroup.in", "department": "Production", "phone": "+919876543223", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Sanjay Yadav", "email": "sanjay@kinggroup.in", "department": "Production", "phone": "+919876543224", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Geeta Iyer", "email": "geeta@kinggroup.in", "department": "Tool Room", "phone": "+919876543225", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(ObjectId()), "name": "Rakesh Pandey", "email": "rakesh@kinggroup.in", "department": "Store", "phone": "+919876543226", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.hosts.insert_many(hosts)
    return {"message": "Seed data created", "hosts_count": len(hosts)}

# ── Include router ──
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
