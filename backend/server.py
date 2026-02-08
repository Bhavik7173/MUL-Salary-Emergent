from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date
import io
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="MUL Salary Tracker API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Constants
DEFAULT_HOURLY_RATE = 14.53
DEFAULT_CONTRACT_HOURS = 151.67
DEFAULT_TAX_RATE = 0.2764
BONUS_THRESHOLD_HOURS = 6
BONUS_AMOUNT = 6.0

# ============= MODELS =============

class WorkEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    break_hours: float = 0.0
    travel_allowance: float = 0.0
    is_public_holiday: bool = False
    notes: str = ""
    working_hours: float = 0.0
    bonus: float = 0.0
    gross_pay: float = 0.0
    tax: float = 0.0
    net_pay: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class WorkEntryCreate(BaseModel):
    date: str
    start_time: str
    end_time: str
    break_hours: float = 0.0
    travel_allowance: float = 0.0
    is_public_holiday: bool = False
    notes: str = ""

class WorkEntryUpdate(BaseModel):
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    break_hours: Optional[float] = None
    travel_allowance: Optional[float] = None
    is_public_holiday: Optional[bool] = None
    notes: Optional[str] = None

class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "settings"
    hourly_rate: float = DEFAULT_HOURLY_RATE
    contract_hours: float = DEFAULT_CONTRACT_HOURS
    tax_rate: float = DEFAULT_TAX_RATE
    company_name: str = "MUL Company"
    company_logo: Optional[str] = None
    email_address: str = ""
    email_password: str = ""
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    auto_email_day: int = 1
    dark_mode: bool = False
    manual_azk_adjustment: float = 0.0  # Manual AZK bank adjustment

class SettingsUpdate(BaseModel):
    hourly_rate: Optional[float] = None
    contract_hours: Optional[float] = None
    tax_rate: Optional[float] = None
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    email_address: Optional[str] = None
    email_password: Optional[str] = None
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    auto_email_day: Optional[int] = None
    manual_azk_adjustment: Optional[float] = None
    dark_mode: Optional[bool] = None

class MonthlySummary(BaseModel):
    year: int
    month: int
    total_worked_hours: float
    payable_hours: float
    azk_change: float
    azk_bank_total: float
    gross_pay: float
    tax: float
    bonus_total: float
    travel_total: float
    net_pay: float
    entries: List[WorkEntry]
    daily_hours: List[dict]

class EmailRequest(BaseModel):
    recipient_email: str
    year: int
    month: int

# ============= HELPER FUNCTIONS =============

def calculate_working_hours(start_time: str, end_time: str, break_hours: float) -> float:
    """Calculate working hours from start and end time minus breaks."""
    try:
        start = datetime.strptime(start_time, "%H:%M")
        end = datetime.strptime(end_time, "%H:%M")
        if end < start:
            # Handle overnight shifts
            end = end.replace(day=2)
            start = start.replace(day=1)
        total_hours = (end - start).seconds / 3600
        working_hours = max(0, total_hours - break_hours)
        return round(working_hours, 2)
    except:
        return 0.0

async def get_settings() -> Settings:
    """Get settings from database or return defaults."""
    settings_doc = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    if settings_doc:
        return Settings(**settings_doc)
    return Settings()

def calculate_entry_pay(entry_data: dict, settings: Settings) -> dict:
    """Calculate all pay fields for a work entry."""
    working_hours = calculate_working_hours(
        entry_data.get("start_time", "00:00"),
        entry_data.get("end_time", "00:00"),
        entry_data.get("break_hours", 0)
    )
    
    # Bonus if worked 6+ hours
    bonus = BONUS_AMOUNT if working_hours >= BONUS_THRESHOLD_HOURS else 0.0
    
    # Holiday multiplier (1.5x for public holidays)
    multiplier = 1.5 if entry_data.get("is_public_holiday", False) else 1.0
    
    # Calculate pay
    base_pay = working_hours * settings.hourly_rate * multiplier
    travel = entry_data.get("travel_allowance", 0)
    gross_pay = base_pay + travel + bonus
    tax = gross_pay * settings.tax_rate
    net_pay = gross_pay - tax
    
    return {
        "working_hours": round(working_hours, 2),
        "bonus": round(bonus, 2),
        "gross_pay": round(gross_pay, 2),
        "tax": round(tax, 2),
        "net_pay": round(net_pay, 2)
    }

async def get_azk_bank_total(exclude_year: int = None, exclude_month: int = None) -> float:
    """Calculate total AZK bank from all previous months."""
    pipeline = [
        {"$group": {
            "_id": {"year": {"$year": {"$dateFromString": {"dateString": "$date"}}},
                    "month": {"$month": {"$dateFromString": {"dateString": "$date"}}}},
            "total_hours": {"$sum": "$working_hours"}
        }}
    ]
    
    cursor = db.work_entries.aggregate(pipeline)
    results = await cursor.to_list(100)
    
    settings = await get_settings()
    azk_total = 0.0
    
    for r in results:
        if exclude_year and exclude_month:
            if r["_id"]["year"] == exclude_year and r["_id"]["month"] == exclude_month:
                continue
        azk_total += r["total_hours"] - settings.contract_hours
    
    # Add manual adjustment
    azk_total += settings.manual_azk_adjustment
    
    return round(azk_total, 2)

# ============= WORK ENTRIES ROUTES =============

@api_router.get("/")
async def root():
    return {"message": "MUL Salary Tracker API"}

@api_router.post("/entries", response_model=WorkEntry)
async def create_work_entry(entry: WorkEntryCreate):
    """Create a new work entry."""
    settings = await get_settings()
    
    entry_dict = entry.model_dump()
    pay_data = calculate_entry_pay(entry_dict, settings)
    
    work_entry = WorkEntry(
        **entry_dict,
        **pay_data
    )
    
    doc = work_entry.model_dump()
    await db.work_entries.insert_one(doc)
    return work_entry

@api_router.get("/entries", response_model=List[WorkEntry])
async def get_work_entries(year: Optional[int] = None, month: Optional[int] = None):
    """Get all work entries, optionally filtered by year and month."""
    query = {}
    
    if year and month:
        # Filter by year-month prefix
        month_str = f"{year}-{month:02d}"
        query["date"] = {"$regex": f"^{month_str}"}
    
    entries = await db.work_entries.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return entries

@api_router.get("/entries/{entry_id}", response_model=WorkEntry)
async def get_work_entry(entry_id: str):
    """Get a single work entry by ID."""
    entry = await db.work_entries.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry

@api_router.put("/entries/{entry_id}", response_model=WorkEntry)
async def update_work_entry(entry_id: str, update: WorkEntryUpdate):
    """Update a work entry."""
    entry = await db.work_entries.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    
    if update_dict:
        entry.update(update_dict)
        settings = await get_settings()
        pay_data = calculate_entry_pay(entry, settings)
        entry.update(pay_data)
        entry["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.work_entries.update_one(
            {"id": entry_id},
            {"$set": entry}
        )
    
    return WorkEntry(**entry)

@api_router.delete("/entries/{entry_id}")
async def delete_work_entry(entry_id: str):
    """Delete a work entry."""
    result = await db.work_entries.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted successfully"}

# ============= MONTHLY SUMMARY ROUTE =============

@api_router.get("/summary/{year}/{month}", response_model=MonthlySummary)
async def get_monthly_summary(year: int, month: int):
    """Get monthly summary with all calculations."""
    settings = await get_settings()
    
    # Get entries for the month
    month_str = f"{year}-{month:02d}"
    entries = await db.work_entries.find(
        {"date": {"$regex": f"^{month_str}"}},
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Calculate totals
    total_hours = sum(e.get("working_hours", 0) for e in entries)
    payable_hours = min(total_hours, settings.contract_hours)
    azk_change = total_hours - settings.contract_hours
    azk_bank = await get_azk_bank_total(year, month)
    azk_bank_total = azk_bank + azk_change
    
    bonus_total = sum(e.get("bonus", 0) for e in entries)
    travel_total = sum(e.get("travel_allowance", 0) for e in entries)
    gross_pay = sum(e.get("gross_pay", 0) for e in entries)
    tax = sum(e.get("tax", 0) for e in entries)
    net_pay = sum(e.get("net_pay", 0) for e in entries)
    
    # Prepare daily hours for chart
    daily_hours = [
        {"date": e["date"], "hours": e.get("working_hours", 0), "day": e["date"][-2:]}
        for e in entries
    ]
    
    return MonthlySummary(
        year=year,
        month=month,
        total_worked_hours=round(total_hours, 2),
        payable_hours=round(payable_hours, 2),
        azk_change=round(azk_change, 2),
        azk_bank_total=round(azk_bank_total, 2),
        gross_pay=round(gross_pay, 2),
        tax=round(tax, 2),
        bonus_total=round(bonus_total, 2),
        travel_total=round(travel_total, 2),
        net_pay=round(net_pay, 2),
        entries=[WorkEntry(**e) for e in entries],
        daily_hours=daily_hours
    )

# ============= SETTINGS ROUTES =============

@api_router.get("/settings", response_model=Settings)
async def get_app_settings():
    """Get application settings."""
    return await get_settings()

@api_router.put("/settings", response_model=Settings)
async def update_settings(update: SettingsUpdate):
    """Update application settings."""
    settings = await get_settings()
    settings_dict = settings.model_dump()
    
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    settings_dict.update(update_dict)
    
    await db.settings.update_one(
        {"id": "settings"},
        {"$set": settings_dict},
        upsert=True
    )
    
    # Recalculate all entries with new rates if rate changed
    if "hourly_rate" in update_dict or "tax_rate" in update_dict:
        new_settings = Settings(**settings_dict)
        entries = await db.work_entries.find({}, {"_id": 0}).to_list(10000)
        for entry in entries:
            pay_data = calculate_entry_pay(entry, new_settings)
            await db.work_entries.update_one(
                {"id": entry["id"]},
                {"$set": pay_data}
            )
    
    return Settings(**settings_dict)

# ============= UPLOAD ROUTE =============

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload CSV or Excel file and parse entries."""
    try:
        contents = await file.read()
        
        # Determine file type
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV or Excel.")
        
        # Try to map columns
        column_mapping = {
            'date': ['date', 'Date', 'DATE', 'datum', 'Datum'],
            'start_time': ['start_time', 'Start Time', 'start', 'Start', 'START', 'begin', 'Begin'],
            'end_time': ['end_time', 'End Time', 'end', 'End', 'END', 'einde', 'Einde'],
            'break_hours': ['break_hours', 'Break', 'break', 'Break Hours', 'pauze', 'Pauze'],
            'travel_allowance': ['travel_allowance', 'Travel', 'travel', 'reiskosten', 'Reiskosten'],
            'is_public_holiday': ['is_public_holiday', 'Holiday', 'holiday', 'feestdag', 'Feestdag'],
            'notes': ['notes', 'Notes', 'NOTES', 'opmerkingen', 'Opmerkingen']
        }
        
        # Find matching columns
        mapped_cols = {}
        for target, options in column_mapping.items():
            for opt in options:
                if opt in df.columns:
                    mapped_cols[target] = opt
                    break
        
        if 'date' not in mapped_cols:
            raise HTTPException(status_code=400, detail="Could not find date column in file")
        
        # Parse entries
        entries_preview = []
        settings = await get_settings()
        
        for _, row in df.iterrows():
            entry_data = {
                'date': str(row.get(mapped_cols.get('date', 'date'), '')),
                'start_time': str(row.get(mapped_cols.get('start_time', 'start_time'), '09:00')),
                'end_time': str(row.get(mapped_cols.get('end_time', 'end_time'), '17:00')),
                'break_hours': float(row.get(mapped_cols.get('break_hours', 'break_hours'), 0) or 0),
                'travel_allowance': float(row.get(mapped_cols.get('travel_allowance', 'travel_allowance'), 0) or 0),
                'is_public_holiday': bool(row.get(mapped_cols.get('is_public_holiday', 'is_public_holiday'), False)),
                'notes': str(row.get(mapped_cols.get('notes', 'notes'), '') or '')
            }
            
            # Format date if needed
            try:
                if pd.notna(entry_data['date']):
                    parsed_date = pd.to_datetime(entry_data['date'])
                    entry_data['date'] = parsed_date.strftime('%Y-%m-%d')
            except:
                continue
            
            pay_data = calculate_entry_pay(entry_data, settings)
            entry_data.update(pay_data)
            entries_preview.append(entry_data)
        
        return {
            "message": "File parsed successfully",
            "columns_found": list(mapped_cols.keys()),
            "entries_count": len(entries_preview),
            "entries_preview": entries_preview
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@api_router.post("/upload/save")
async def save_uploaded_entries(entries: List[WorkEntryCreate]):
    """Save uploaded entries to database, avoiding duplicates."""
    settings = await get_settings()
    saved = 0
    skipped = 0
    
    for entry in entries:
        # Check for existing entry on same date
        existing = await db.work_entries.find_one({"date": entry.date})
        
        if existing:
            skipped += 1
            continue
        
        entry_dict = entry.model_dump()
        pay_data = calculate_entry_pay(entry_dict, settings)
        
        work_entry = WorkEntry(
            **entry_dict,
            **pay_data
        )
        
        await db.work_entries.insert_one(work_entry.model_dump())
        saved += 1
    
    return {"message": f"Saved {saved} entries, skipped {skipped} duplicates"}

# ============= PDF GENERATION =============

@api_router.get("/payslip/{year}/{month}/pdf")
async def generate_payslip_pdf(year: int, month: int):
    """Generate PDF payslip for a month."""
    summary = await get_monthly_summary(year, month)
    settings = await get_settings()
    
    # Create PDF buffer
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=30, bottomMargin=30)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=20,
        textColor=colors.HexColor('#0F172A')
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#64748B')
    )
    
    elements = []
    
    # Header
    elements.append(Paragraph(settings.company_name, title_style))
    elements.append(Paragraph(f"Payslip - {datetime(year, month, 1).strftime('%B %Y')}", subtitle_style))
    elements.append(Spacer(1, 30))
    
    # Summary Table
    summary_data = [
        ['Description', 'Hours/Amount', 'Value (€)'],
        ['Total Worked Hours', f'{summary.total_worked_hours:.2f} hrs', ''],
        ['Payable Hours', f'{summary.payable_hours:.2f} hrs', ''],
        ['AZK Change', f'{summary.azk_change:+.2f} hrs', ''],
        ['AZK Bank Total', f'{summary.azk_bank_total:.2f} hrs', ''],
        ['', '', ''],
        ['Hourly Rate', '', f'€{settings.hourly_rate:.2f}'],
        ['Base Pay', f'{summary.payable_hours:.2f} × €{settings.hourly_rate:.2f}', f'€{summary.payable_hours * settings.hourly_rate:.2f}'],
        ['Travel Allowance', '', f'€{summary.travel_total:.2f}'],
        ['Bonus (6+ hrs)', '', f'€{summary.bonus_total:.2f}'],
        ['', '', ''],
        ['Gross Pay', '', f'€{summary.gross_pay:.2f}'],
        ['Tax (27.64%)', '', f'-€{summary.tax:.2f}'],
        ['', '', ''],
        ['Net Pay', '', f'€{summary.net_pay:.2f}'],
    ]
    
    table = Table(summary_data, colWidths=[200, 150, 100])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#EFF6FF')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 30))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#94A3B8')
    )
    elements.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')}", footer_style))
    elements.append(Paragraph("This is an automatically generated payslip.", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"payslip_{year}_{month:02d}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ============= EXCEL EXPORT =============

@api_router.get("/export/{year}/{month}/excel")
async def export_to_excel(year: int, month: int):
    """Export monthly data to Excel."""
    summary = await get_monthly_summary(year, month)
    
    # Create DataFrame from entries
    entries_data = [e.model_dump() for e in summary.entries]
    df = pd.DataFrame(entries_data)
    
    if not df.empty:
        # Select and rename columns
        df = df[['date', 'start_time', 'end_time', 'break_hours', 'working_hours', 
                 'travel_allowance', 'is_public_holiday', 'bonus', 'gross_pay', 'tax', 'net_pay', 'notes']]
        df.columns = ['Date', 'Start Time', 'End Time', 'Break (hrs)', 'Working Hours',
                      'Travel (€)', 'Public Holiday', 'Bonus (€)', 'Gross (€)', 'Tax (€)', 'Net (€)', 'Notes']
    
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Work Entries', index=False)
        
        # Add summary sheet
        summary_df = pd.DataFrame({
            'Metric': ['Total Hours', 'Payable Hours', 'AZK Change', 'AZK Bank Total',
                       'Gross Pay', 'Tax', 'Bonus Total', 'Travel Total', 'Net Pay'],
            'Value': [summary.total_worked_hours, summary.payable_hours, summary.azk_change,
                      summary.azk_bank_total, summary.gross_pay, summary.tax,
                      summary.bonus_total, summary.travel_total, summary.net_pay]
        })
        summary_df.to_excel(writer, sheet_name='Summary', index=False)
    
    buffer.seek(0)
    filename = f"salary_report_{year}_{month:02d}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ============= EMAIL ROUTES =============

@api_router.post("/email/send")
async def send_email_with_payslip(request: EmailRequest):
    """Send email with PDF payslip attachment."""
    settings = await get_settings()
    
    if not settings.email_address or not settings.email_password:
        raise HTTPException(status_code=400, detail="Email not configured in settings")
    
    summary = await get_monthly_summary(request.year, request.month)
    
    # Generate PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=30, bottomMargin=30)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24)
    
    elements = []
    elements.append(Paragraph(f"{settings.company_name} - Payslip", title_style))
    elements.append(Paragraph(f"{datetime(request.year, request.month, 1).strftime('%B %Y')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    summary_data = [
        ['Metric', 'Value'],
        ['Total Hours', f'{summary.total_worked_hours:.2f}'],
        ['Payable Hours', f'{summary.payable_hours:.2f}'],
        ['Gross Pay', f'€{summary.gross_pay:.2f}'],
        ['Tax', f'€{summary.tax:.2f}'],
        ['Net Pay', f'€{summary.net_pay:.2f}'],
    ]
    
    table = Table(summary_data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(table)
    
    doc.build(elements)
    buffer.seek(0)
    pdf_data = buffer.read()
    
    # Create email
    msg = MIMEMultipart()
    msg['From'] = settings.email_address
    msg['To'] = request.recipient_email
    msg['Subject'] = f"Payslip - {datetime(request.year, request.month, 1).strftime('%B %Y')}"
    
    # Email body
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif;">
        <h2>{settings.company_name} - Monthly Payslip</h2>
        <p>Please find attached your payslip for {datetime(request.year, request.month, 1).strftime('%B %Y')}.</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Hours:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{summary.total_worked_hours:.2f}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Gross Pay:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">€{summary.gross_pay:.2f}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Tax:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">€{summary.tax:.2f}</td></tr>
            <tr style="background: #EFF6FF;"><td style="padding: 8px; border: 1px solid #ddd;"><strong>Net Pay:</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><strong>€{summary.net_pay:.2f}</strong></td></tr>
        </table>
        <p style="color: #666; font-size: 12px;">This is an automated email from MUL Salary Tracker.</p>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(body, 'html'))
    
    # Attach PDF
    pdf_attachment = MIMEApplication(pdf_data, _subtype='pdf')
    pdf_attachment.add_header('Content-Disposition', 'attachment', 
                              filename=f'payslip_{request.year}_{request.month:02d}.pdf')
    msg.attach(pdf_attachment)
    
    # Send email
    try:
        server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
        server.starttls()
        server.login(settings.email_address, settings.email_password)
        server.send_message(msg)
        server.quit()
        return {"message": "Email sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
