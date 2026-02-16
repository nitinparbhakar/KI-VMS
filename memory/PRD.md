# King Group Visitor Management System - PRD

## Original Problem Statement
Build a zero-cost Visitor Management System for King Group (kinggroup.in). Security guards at gate use Android tablets to check-in/out visitors. Features: live camera photo capture, visitor registration, Department->Host cascading dropdown, printable PDF visitor slip, email notification to host, visitor log with search, admin panel.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI + react-webcam
- **Backend**: FastAPI + MongoDB + ReportLab (PDF)
- **Database**: MongoDB (visitors, hosts, audit_log, email_log collections)
- **Auth**: None (open access for trusted tablets)

## User Personas
1. **Security Guard**: Primary user. Uses tablet at gate. Needs fast, minimal-typing workflow with large touch targets.
2. **Company Admin**: Manages hosts, reviews logs and audit trail.

## Core Requirements
- Live camera photo capture (getUserMedia, NO file picker)
- Phone number as primary key for visitor matching
- Visitor ID format: VIS-YYYYMMDD-####
- Department -> Host cascading selection
- Auto-timestamp on check-in/out
- PDF visitor slip (A4)
- Email notification to host (currently MOCKED)
- Audit trail

## What's Been Implemented (Feb 16, 2026)
- [x] Full-stack Visitor Management System
- [x] Dashboard with stats, active visitors, quick actions
- [x] Check-In page with live camera capture + form
- [x] Check-Out page with search and confirmation dialog
- [x] Visitor Log with search/filter/pagination
- [x] Admin Panel (Hosts CRUD, Audit Log, Email Log)
- [x] PDF visitor slip generation
- [x] 17 seeded host employees across 11 departments
- [x] Phone normalization (+91 format)
- [x] Audit logging for all check-in/out events

## MOCKED Features
- Email notifications (logged to email_log collection, not sent via real email service)

## Prioritized Backlog
### P0 (Critical)
- None remaining

### P1 (Important)
- Real email integration (SendGrid or similar)
- Returning visitor auto-fill (detect by phone number)
- QR code on visitor slip for quick checkout

### P2 (Nice to Have)
- Daily summary report
- Offline mode handling
- Kiosk mode guidance for tablet setup
- Export visitor log to CSV/Excel
- Visitor analytics dashboard

## Next Tasks
1. Integrate real email service (SendGrid recommended)
2. Add returning visitor detection and auto-fill
3. Add QR code to PDF slip for quick gate-out
4. Add daily visitor summary report
