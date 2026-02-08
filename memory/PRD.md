# MUL Salary Tracker - Product Requirements Document

## Original Problem Statement
Build a modern, premium salary management and payslip generation system with:
- Daily Work Entry with auto-calculations
- Monthly Summary Dashboard with charts
- CSV/Excel Upload System
- PDF Payslip Generation
- Email Integration
- Settings Management

## Architecture
- **Frontend**: React 19 + TailwindCSS + Shadcn UI
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **PDF Generation**: ReportLab
- **Excel Export**: OpenPyXL
- **Charts**: Recharts

## User Personas
1. **Employee**: Tracks daily work hours, generates payslips
2. **HR Manager**: Reviews monthly summaries, exports reports

## Core Requirements (Static)
| Feature | Status |
|---------|--------|
| Daily Work Entry | ✅ Implemented |
| Monthly Dashboard | ✅ Implemented |
| Live Calculations | ✅ Implemented |
| PDF Payslip | ✅ Implemented |
| Excel Export | ✅ Implemented |
| CSV Upload | ✅ Implemented |
| Dark Mode | ✅ Implemented |
| Email Config | ✅ Implemented (requires user SMTP setup) |

## What's Been Implemented (Feb 8, 2026)
1. **Dashboard**: KPI cards, bar charts, financial summary, recent entries
2. **Daily Entry**: Form with date picker, live calculation preview, CRUD operations
3. **Upload**: Drag-drop file upload with CSV/Excel parsing, smart merge
4. **Payslip**: Preview, PDF download, email with attachment
5. **Settings**: Hourly rate (€14.53), contract hours (151.67), tax rate (27.64%), dark mode, email config

## Default Configuration
- Hourly Rate: €14.53
- Contract Hours: 151.67 hrs/month
- Tax Rate: 27.64%
- Bonus: €1 for 6+ hour days
- Public Holiday: 1.5x multiplier

## Prioritized Backlog
### P0 (Critical) - None remaining
### P1 (High Priority)
- Auto monthly email scheduling (backend cron needed)
- Company logo upload

### P2 (Medium Priority)
- Multiple employee support with auth
- Report archiving
- Overtime calculations

## Next Tasks
1. Add company logo upload functionality
2. Implement auto monthly email feature
3. Add user authentication for multi-tenant support
