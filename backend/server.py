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
    await db.hosts.insert_one({**host_dict, "_id": ObjectId(host_dict["id"])})
    del host_dict["_id"] if "_id" in host_dict else None
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

# ── PDF Slip Generation ──
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
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5*cm, bottomMargin=1.5*cm, leftMargin=2*cm, rightMargin=2*cm)
    styles = getSampleStyleSheet()
    elements = []

    # Title style
    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=24, spaceAfter=6, textColor=colors.HexColor('#0F172A'), fontName='Helvetica-Bold')
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#64748B'), alignment=TA_CENTER, spaceAfter=12)
    header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=12, textColor=colors.HexColor('#0F172A'), fontName='Helvetica-Bold', spaceAfter=4)
    value_style = ParagraphStyle('Value', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor('#334155'), spaceBefore=2, spaceAfter=8)
    id_style = ParagraphStyle('ID', parent=styles['Normal'], fontSize=18, textColor=colors.HexColor('#2563EB'), fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=12)

    # Company header
    elements.append(Paragraph("KING GROUP", title_style))
    elements.append(Paragraph("kinggroup.in | Visitor Management System", subtitle_style))
    elements.append(Spacer(1, 4*mm))

    # Line separator
    line_data = [['']]
    line_table = Table(line_data, colWidths=[doc.width])
    line_table.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 2, colors.HexColor('#0F172A'))]))
    elements.append(line_table)
    elements.append(Spacer(1, 6*mm))

    # Visitor ID
    elements.append(Paragraph(f"VISITOR PASS: {visitor_id}", id_style))
    elements.append(Spacer(1, 4*mm))

    # Photo
    if visitor.get("photo"):
        try:
            photo_data = visitor["photo"]
            if "," in photo_data:
                photo_data = photo_data.split(",")[1]
            img_bytes = base64.b64decode(photo_data)
            img_buf = io.BytesIO(img_bytes)
            img = Image(img_buf, width=4*cm, height=4*cm)
            img.hAlign = 'CENTER'
            elements.append(img)
            elements.append(Spacer(1, 6*mm))
        except Exception as e:
            logger.error(f"Error adding photo to PDF: {e}")

    # Visitor details table
    in_time = visitor.get("in_time", "")
    out_time = visitor.get("out_time", "N/A")

    detail_data = [
        ["Visitor Name", visitor.get("name", "")],
        ["Phone", visitor.get("phone", "")],
        ["Company", visitor.get("company", "N/A")],
        ["Purpose", visitor.get("purpose", "")],
        ["Department", visitor.get("department", "")],
        ["Host", visitor.get("host_name", "")],
        ["Check-In", in_time],
        ["Check-Out", out_time if out_time else "Still Inside"],
        ["Status", visitor.get("status", "")],
        ["Visit #", str(visitor.get("visit_count", 1))],
    ]

    detail_table = Table(detail_data, colWidths=[5*cm, doc.width - 5*cm])
    detail_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#334155')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, colors.HexColor('#E2E8F0')),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#0F172A')),
    ]))
    elements.append(detail_table)
    elements.append(Spacer(1, 10*mm))

    # Footer
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#94A3B8'), alignment=TA_CENTER)
    elements.append(Paragraph("This is a computer-generated visitor pass. Please return this pass at the security gate upon exit.", footer_style))
    elements.append(Paragraph(f"Generated: {datetime.now(timezone.utc).isoformat()}", footer_style))

    doc.build(elements)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=visitor_slip_{visitor_id}.pdf"}
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
    if existing > 0:
        return {"message": "Data already seeded", "hosts_count": existing}

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
