# King Group Visitor Management System - PRD

## Original Problem Statement
Build a zero-cost Visitor Management System for King Group (kinggroup.in). Security guards at gate use Android tablets to check-in/out visitors with live camera capture, phone-first workflow, returning visitor detection, blacklist system, and professional gate pass PDF.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI + react-webcam
- **Backend**: FastAPI + MongoDB + ReportLab + qrcode
- **Database**: MongoDB (visitors, hosts, blacklist, audit_log, email_log)
- **Auth**: None (open access for trusted tablets)

## What's Been Implemented (Feb 16, 2026)
### Phase 1 (MVP)
- [x] Dashboard with stats, active visitors, quick actions, King Group logo
- [x] Check-In page with live camera capture + form
- [x] Check-Out page with search and confirmation
- [x] Visitor Log with search/filter/pagination
- [x] Admin Panel (Hosts CRUD, Audit Log, Email Log)
- [x] PDF visitor slip generation
- [x] 17 seeded hosts across 11 departments

### Phase 2 (Current)
- [x] **Phone-first workflow**: Phone entered before name, form revealed after 10+ digits
- [x] **Returning visitor detection**: Auto-fill name/company from previous visits
- [x] **Previous visits history**: Dialog showing all past visits for a phone number
- [x] **Blacklist system**: Admin can blacklist phone numbers with reasons, blocked visitors cannot check in
- [x] **King Group logo**: Used in dashboard, check-in, admin headers
- [x] **Redesigned gate pass PDF**: Navy/orange theme matching template, QR code, visitor photo, signature fields, instructions

## MOCKED Features
- Email notifications (logged to email_log collection)

## Prioritized Backlog
### P1
- Real email integration (SendGrid)
- QR code scanning for quick checkout
- Daily visitor summary report

### P2
- Offline mode / PWA
- Export visitor log to CSV
- Visitor analytics charts
- Kiosk mode tablet setup guide
