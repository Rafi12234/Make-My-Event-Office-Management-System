# Make My Event Office Management System

A full-featured internal office management platform built for **Make My Event** to manage clients, employees, meetings, calls, events, attendance, financial accounts, vendors, PDF proposals, calendars, and administrative operations from one centralized system.

The system is designed around two primary user roles:

- **Employees** — manage clients, meetings, calls, event expenses, attendance, proposals, and day-to-day office work.
- **Administrators** — monitor company-wide operations, employees, calendars, attendance, financial records, vendors, clients, and activity history.

The project uses a modular architecture where large features such as **Accounts** and **PDF Generator** are maintained as separate top-level modules while still using the same main authentication system, backend API, Prisma schema, and MySQL/MariaDB database.

---

# Table of Contents

1. [Project Overview](#project-overview)
2. [Main Objectives](#main-objectives)
3. [Core Features](#core-features)
4. [Employee Features](#employee-features)
5. [Admin Features](#admin-features)
6. [Client Management](#client-management)
7. [Meeting Management](#meeting-management)
8. [Call Management](#call-management)
9. [Calendar System](#calendar-system)
10. [Attendance Management](#attendance-management)
11. [Accounts and Expense Management](#accounts-and-expense-management)
12. [Vendor Management](#vendor-management)
13. [PDF Generator](#pdf-generator)
14. [Excel Import Features](#excel-import-features)
15. [Technology Stack](#technology-stack)
16. [System Architecture](#system-architecture)
17. [Repository Structure](#repository-structure)
18. [Database Architecture](#database-architecture)
19. [Authentication and Authorization](#authentication-and-authorization)
20. [Installation](#installation)
21. [Environment Configuration](#environment-configuration)
22. [Database Setup](#database-setup)
23. [Running the Project](#running-the-project)
24. [Production Deployment](#production-deployment)
25. [File Storage](#file-storage)
26. [Security Considerations](#security-considerations)
27. [Important Development Rules](#important-development-rules)
28. [Testing](#testing)
29. [Troubleshooting](#troubleshooting)
30. [Future Improvements](#future-improvements)

---

# Project Overview

The **Make My Event Office Management System** is an internal business-management platform developed to replace manual spreadsheets, scattered client notes, independent financial records, and disconnected employee workflows.

The platform provides a centralized location for managing:

- Client information
- Event dates
- Venues
- Event shifts
- Client meetings
- Client calls
- Follow-up schedules
- Employee assignments
- Meeting requirements
- Meeting images
- Client finalization
- Employee calendars
- Company-wide administrative calendars
- Employee attendance
- Employee wallet/accounts
- Event expenses
- Regular office expenses
- Vendor bills
- Vendor payments
- Expense approvals
- PDF proposal generation
- Excel imports
- Document history
- Administrative monitoring

The system is designed so information entered once can be reused across multiple modules.

For example:

```text
Management Client
      ↓
Client Meeting
      ↓
Meeting Items
      ↓
PDF Generator
      ↓
Official Proposal PDF
```

Another example:

```text
Confirmed Client
      ↓
Event Based Cost
      ↓
Vendor Bill / Other Cost
      ↓
Admin Approval
      ↓
Employee Wallet / Vendor Ledger
```

---

# Main Objectives

The project aims to provide Make My Event with:

- A centralized client database.
- Clear employee responsibility tracking.
- Structured client communication records.
- Reliable follow-up scheduling.
- Company-wide activity visibility.
- Better accountability between employees.
- Centralized event expense tracking.
- Vendor liability tracking.
- Employee wallet management.
- GPS-supported attendance management.
- Professional proposal PDF generation.
- Excel-assisted bulk data entry.
- Administrative control over company operations.
- Historical records for important business activities.

---

# Core Features

The application currently contains several major functional areas:

```text
Make My Event Office Management System
│
├── Authentication
│
├── Management Workspace
│
├── Client Meetings
│
├── Client Calls
│
├── Client Finalization
│
├── Employee Calendar
│
├── Admin Calendar
│
├── Attendance
│
├── Accounts
│   ├── Wallet
│   ├── Money Received
│   ├── Expenses
│   ├── Vendors
│   └── Vendor Payments
│
├── PDF Generator
│   ├── Meeting Source
│   ├── Excel Source
│   ├── Image References
│   └── Document History
│
└── Admin Panel
    ├── Employees
    ├── Clients
    ├── Meetings & Calls
    ├── Calendar
    ├── Attendance
    ├── Accounts
    └── Vendors
```

---

# Employee Features

Employees have individual accounts and authenticated access to the office-management system.

Employee functionality includes:

- Secure login.
- Current-session verification.
- Logout.
- Forced password change where required.
- Password update.
- Access to Management workspace.
- Client information management.
- Client meeting creation.
- Client call creation.
- Meeting and call history.
- Next meeting scheduling.
- Next call scheduling.
- Employee assignment for future follow-ups.
- Calendar access.
- Attendance Sign In / Sign Out.
- Employee wallet and account overview.
- Money received entries.
- Expense submission.
- Event-based costs.
- Regular costs.
- Vendor bills.
- Vendor payments.
- Receipt uploads.
- Excel cost uploads.
- PDF generation.
- PDF document history.

---

# Admin Features

The Admin panel provides company-wide control and visibility.

Administrative features include:

- Employee management.
- Create employee accounts.
- Activate/deactivate employees.
- Reset employee passwords.
- View employee activities.
- View employee missed/overdue activities.
- View all clients.
- Edit client information.
- View client meeting history.
- View client call history.
- Meeting and call oversight.
- Update next meeting schedules.
- Update next call schedules.
- Reassign future meetings/calls.
- Company-wide calendar.
- Day-level activity view.
- Attendance management.
- Employee account/wallet management.
- Expense approval.
- Expense correction.
- Expense voiding.
- Vendor management.
- Vendor transaction history.
- Pending bill/payable monitoring.
- Financial filtering and reporting.

---

# Client Management

The `/management` module is the primary client-management workspace.

Client records are represented through a configurable sheet-like structure.

Typical information includes:

- Client Name
- Phone Number
- Event Date
- Venue
- Shift
- Floor
- Guest Count
- Employee assignments
- Meeting/call-related information
- Other custom Management columns

The workspace supports:

- Manual client creation.
- Excel client import.
- Editable rows.
- Dynamic columns.
- Client searching.
- Filtering.
- Admin editing.
- Employee ownership/source tracking where configured.

## Venue Selection

Venue fields contain predefined venue choices.

Employees can also select:

```text
Other
```

and manually enter a venue that does not exist in the predefined list.

Example:

```text
Venue
├── Sena Prangan
├── Sena Malancha
├── Army Officers Club
├── Butterfly Garden
├── Elite Convention Hall
├── Dhaka Ladies Club
└── Other
      ↓
      ICC Bashundhara
```

The custom venue name itself is stored in the Management cell.

`Other` is only a user-interface option and is not stored as the actual venue.

---

# Meeting Management

Each client can have multiple meeting records.

A meeting can contain:

- Meeting date and time.
- Employee who conducted the meeting.
- Meeting requirements.
- Notes.
- Structured meeting items.
- Custom items.
- Item descriptions.
- Quantities.
- Multiple images.
- Image tags.
- Final-image selections.
- Next meeting date/time.
- Next meeting assigned employee.

Employees can:

- Create meetings.
- Edit meetings.
- Delete meetings where allowed.
- Upload multiple meeting images.
- Add individual item images.
- View meeting history.
- Schedule the next meeting.
- Assign responsibility to another employee.

Meeting information can also act as a source for the PDF Generator.

---

# Call Management

Client calls are stored independently from meetings.

A call record can include:

- Call date/time.
- Discussion notes.
- Employee information.
- Next call date/time.
- Next-call employee assignment.

Employees and Admins can maintain a complete communication timeline for every client.

---

# Client Finalization

Clients can be finalized after discussions and confirmation.

The finalization workflow can include:

- Selected meeting items.
- Final images.
- Budget information.
- Client confirmation information.
- Event reference data.

Finalized clients are also used by other modules, such as event-based expense tracking.

---

# Calendar System

The system includes both Employee and Admin calendar views.

## Employee Calendar

Employees can view:

- Meetings
- Calls
- Next meetings
- Next calls
- Calendar events
- Missed activities
- Completed activities

## Admin Company-Wide Calendar

Admins can view activities across all employees.

The monthly grid groups activity by:

- Date
- Employee
- Total activity count
- Missed activity count

Example:

```text
Mitua Hema
30 ITEMS · 4 MISSED

Montush Roy
6 ITEMS · 1 MISSED
```

Busy calendar dates use a compact activity preview showing only the most recent updates instead of rendering all client information.

The detailed Admin day view uses a compact tabular layout to prevent unnecessary vertical space usage.

Typical columns include:

```text
Activity
Client
Employee
Event Date
Phone
Venue
Shift
Floor
Status
Next Follow-up
Actions
```

Columns can be resized by dragging the header dividers.

---

# Attendance Management

The Attendance module supports employee Sign In and Sign Out with GPS information.

Attendance records can contain:

- Attendance date.
- Sign-in time.
- Sign-in latitude.
- Sign-in longitude.
- GPS accuracy.
- Distance from configured office.
- Inside/outside-office result.
- Sign-out time.
- Sign-out latitude.
- Sign-out longitude.
- Sign-out accuracy.
- Work duration.

Rules include:

```text
One Employee
+
One Attendance Date
=
One Attendance Record
```

The backend prevents:

- Duplicate Sign In.
- Sign Out before Sign In.
- Duplicate Sign Out.

Attendance timestamps are generated by the backend rather than trusting device-submitted timestamps.

The Admin attendance view supports:

- Employee filtering.
- Date filtering.
- Date-range filtering.
- Sign-in/out time.
- Location information.
- GPS accuracy.
- Office-distance information.
- Working/completed status.

---

# Accounts and Expense Management

The Accounts module handles employee money, costs, bills, and vendor liabilities.

Main employee account functions include:

```text
Employee Wallet
│
├── Money Received
├── Regular Costs
├── Event Based Costs
├── Vendor Bills
├── Vendor Payments
└── Expense History
```

## Money Received

Employees can record money received for office/business use.

The amount updates the employee wallet according to the application's financial rules.

## Regular Cost

Regular Cost is used for general office spending that is not linked to a specific confirmed event.

Each expense item can contain:

- Purpose
- Cost date
- Quantity
- Amount per quantity
- Automatically calculated total
- Optional vendor
- Payment status
- Receipt

Formula:

```text
Item Total = Quantity × Amount / Qty
```

## Event Based Cost

Event Based Cost connects expenses to a confirmed client/event.

The employee selects:

```text
Confirmed Client
        +
Vendor / Other
```

### Real Vendor

When a real vendor is selected:

```text
vendor_id       = actual vendor
payment_status  = to_pay
wallet deduction = 0
vendor ledger    = affected
```

The cost becomes a vendor liability.

### Other Cost

Some costs do not belong to a registered vendor.

Examples:

- Tk 400 payment to a helper.
- Tk 200 food purchase.
- Local transport.
- Tips.
- Emergency purchases.
- Small miscellaneous event costs.

The employee selects:

```text
Other — direct event cost (no vendor)
```

Internally:

```text
vendor_id       = NULL
payment_status  = NULL
vendor ledger   = NOT affected
```

The amount is treated as a direct event expense.

No fake vendor named `Other` is created.

---

# Excel Expense Upload

Both **Event Based Cost** and **Regular Cost** support Excel import to reduce repetitive manual data entry.

Required Excel headers are:

```text
Purpose / Description / Details
Date
Quantity
Amount / Qty
```

Example:

```text
Purpose          | Date       | Quantity | Amount / Qty
Food Purchase    | 23/09/2026 | 2        | 400
Transport        | 23/09/2026 | 1        | 1200
Helper Payment   | 23/09/2026 | 3        | 500
```

The system creates:

```text
Food Purchase
Quantity: 2
Amount / Qty: 400
Total: 800
```

Extra Excel columns are ignored.

Completely empty rows and unrelated footer rows can also be ignored.

For Regular Cost, Vendor information is intentionally not required inside Excel.

After importing, an employee can manually select a vendor and payment status for individual rows if needed.

---

# Vendor Management

Vendors are shared company records.

Vendor functionality includes:

- Vendor directory.
- Vendor profile.
- Vendor category.
- Active/inactive state.
- Vendor bills.
- Vendor payments.
- Outstanding liabilities.
- Transaction history.
- Specific bill settlement.
- Settle-all functionality where supported.

Vendor financial activity is separate from non-vendor `Other` expenses.

---

# Admin Financial Management

Admin financial functionality includes:

- View employee wallet balance.
- View money received.
- View expenses.
- View pending expenses.
- Approve expenses.
- Correct expenses.
- Void expenses with a reason.
- View vendor liabilities.
- Filter financial records.
- View expense details.
- View payment state.
- View employee payable amount.
- CSV/export helpers where available.

An employee expense is not considered finalized financial activity until the required Admin approval workflow is completed.

---

# PDF Generator

The PDF Generator creates professional Make My Event proposal documents using the official Make My Event letter-pad.

Main routes:

```text
/pdf-generator
/pdf-generator/history
```

The module supports two source modes:

```text
Meeting Mode
Excel Mode
```

---

## Meeting Mode

Meeting Mode creates the PDF draft from Client Meeting items.

Meeting data can include:

- Item
- Description
- Quantity
- Images

The PDF Generator copies those values into its own document snapshot.

Editing the PDF draft does not modify the original Client Meeting.

---

## Excel Mode

Excel Mode allows the PDF document to use an uploaded Excel table instead of Client Meeting data.

Mandatory column headers are:

```text
Item / Items
Description / Details
```

Other columns are completely dynamic.

Example:

```text
Items
Details
Size
SQFT
Qty
TSqft
Unit
Price
```

Another Excel file may contain:

```text
Item
Description
Material
Color
Height
Width
Amount
```

Both are supported.

The system preserves:

- Excel header names.
- Original column order.
- Row order.
- Cell values.
- Additional arbitrary columns.
- Subtotal rows.
- Total/footer rows.

Example subtotal:

```text
Items | Details | Qty       | TSqft | Price
      |         | Sub Total | 3443  | 0
```

The subtotal row remains in the PDF table even though its Item field is blank.

---

# PDF Images

Excel-imported item rows can have images manually attached from the PDF Builder.

Multiple images are supported for a single item.

Images:

- Do not appear as a summary-table column in the generated PDF.
- Are rendered in detailed reference sections.
- Maintain original aspect ratio.
- Are not intentionally stretched.
- Are automatically fitted to the available page area.

Subtotal/footer rows do not generate reference-image pages.

---

# PDF Table

Meeting mode uses a standard summary structure such as:

```text
SL
Item
Description
QTY
```

Optional columns can include:

```text
Size
SQFT
TSqft
Unit
Price
```

Excel mode instead uses the actual uploaded Excel columns.

The PDF table automatically:

- Calculates column widths.
- Wraps text.
- Adjusts font size.
- Handles long rows.
- Creates additional pages when required.
- Repeats headings on continuation pages.

---

# PDF N.B. Section

Generated proposals contain the standard Make My Event N.B. terms.

The N.B. editor is collapsed by default in the user interface to reduce screen space, while the terms are still included in the generated PDF.

Current default terms include:

1. Advance-payment requirements.
2. Proposal confidentiality.
3. Price-change conditions.
4. VAT exclusion.
5. Rental-material ownership/return conditions.
6. Reused-material condition notice.

---

# PDF Preview

The Preview feature uses the backend PDF renderer.

The preview therefore represents the actual generated PDF instead of displaying an unrelated HTML approximation.

Flow:

```text
PDF Builder
    ↓
Backend Renderer
    ↓
pdf-lib
    ↓
PDF Bytes
    ↓
Browser Preview
```

---

# PDF Document History

Generated PDFs are stored in Document History.

History displays information such as:

```text
Document No
Event Date
Event Title
Items
Photos
Pages
Generated At
Status
Actions
```

Available actions include:

- Preview
- Download
- Archive

When Download is clicked, a visible loading state appears while the PDF is being prepared so employees know the request is processing.

---

# Technology Stack

## Web Frontend

Primary technologies include:

```text
React
Vite
React Router
JavaScript / JSX
Tailwind-style utility CSS
Lucide React
XLSX / SheetJS
ExcelJS where required
```

## Backend

```text
Node.js
Express.js
Prisma ORM
Multer
JavaScript
```

## Database

Development/production environments use:

```text
MySQL
MariaDB
```

Prisma acts as the application ORM.

## PDF Engine

```text
pdf-lib
```

## Mobile

Where the mobile application is included, its architecture is based on:

```text
React Native
Expo
TypeScript
Expo Router
TanStack Query
Secure token storage
```

The mobile client communicates with the same Express backend and never connects directly to MySQL.

---

# System Architecture

The primary web architecture is:

```text
┌──────────────────────────────┐
│      React / Vite Web App    │
│                              │
│ Management                   │
│ Calendar                     │
│ Admin                        │
│ Accounts                     │
│ PDF Generator                │
└───────────────┬──────────────┘
                │
                │ HTTPS / API
                ▼
┌──────────────────────────────┐
│      Node.js / Express       │
│                              │
│ Main Backend                 │
│ Accounts Module              │
│ PDF Generator Module         │
│ Authentication Middleware    │
│ Upload Handling              │
└───────────────┬──────────────┘
                │
              Prisma
                │
                ▼
┌──────────────────────────────┐
│       MySQL / MariaDB        │
│                              │
│ Employees                    │
│ Clients                      │
│ Meetings                     │
│ Calls                        │
│ Attendance                   │
│ Accounts                     │
│ Vendors                      │
│ PDF Metadata                 │
└──────────────────────────────┘
```

The application follows the rule:

```text
Frontend
   ↓
API
   ↓
Backend
   ↓
Prisma
   ↓
Database
```

Frontend applications never connect directly to the database.

---

# Repository Structure

The repository follows approximately this structure:

```text
Make-My-Event-Office-Management-System/
│
├── Accounts/
│   ├── backend/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── uploads/
│   │
│   └── frontend/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── utils/
│
├── PDFGenerator/
│   ├── backend/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── storage/
│   │   └── templates/
│   │
│   └── frontend/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── utils/
│
├── backend/
│   └── mme_node_express_backend/
│       ├── prisma/
│       │   └── schema.prisma
│       │
│       ├── database/
│       ├── uploads/
│       ├── src/
│       │   ├── config/
│       │   ├── controllers/
│       │   ├── middleware/
│       │   ├── routes/
│       │   ├── utils/
│       │   └── server.js
│       │
│       ├── package.json
│       └── prisma.config.ts
│
├── frontend/
│   └── make my event office management system/
│       ├── src/
│       │   ├── assets/
│       │   ├── components/
│       │   ├── data/
│       │   ├── pages/
│       │   ├── services/
│       │   ├── utils/
│       │   └── App.jsx
│       │
│       ├── package.json
│       └── vite.config.js
│
├── mobile/
│   └── ...
│
├── .github/
│   └── workflows/
│       └── deploy.yml
│
└── README.md
```

---

# Database Architecture

Prisma schema:

```text
backend/mme_node_express_backend/prisma/schema.prisma
```

Important models include records for:

```text
Employee
Role

ManagementSheet
SheetColumn
SheetRow
SheetCell

ClientMeeting
ClientMeetingImage
MeetingItem
ClientNextMeeting

ClientCall
ClientNextCall

ClientFinalization
ClientFinalizationItem
ClientFinalizationImage

CalendarEvent

Attendance

AccountWallet
AccountMoneyReceived
AccountExpense
AccountExpenseItem

Vendor
VendorBalance

PdfDocument
PdfDocumentItem
PdfDocumentItemImage
PdfDocumentImport

ExcelImport
ExcelImportError

ActivityLog
```

The exact schema should always be treated as the source of truth.

---

# Dynamic PDF Excel Storage

Dynamic PDF Excel tables use:

```text
pdf_documents.excel_columns
pdf_document_items.excel_row_data
```

These fields preserve the uploaded dynamic column definitions and row values.

When adding database fields manually, both the physical database and Prisma schema must remain synchronized.

After Prisma schema changes:

```bash
npx prisma validate
npx prisma generate
```

Then restart the backend.

---

# Authentication and Authorization

The application uses separate protected areas for employees and administrators.

## Employee API

Employee-protected routes identify the employee using authenticated middleware.

Backend business logic must use the authenticated employee identity.

Never trust an arbitrary employee ID supplied by the frontend.

Conceptually:

```text
Request
   ↓
Authentication Middleware
   ↓
req.employee
   ↓
Controller
```

## Admin

Administrative endpoints use the application's Admin authentication system.

Employee and Admin permissions must remain separated.

---

# Installation

Clone the repository:

```bash
git clone <repository-url>
```

Move into the project:

```bash
cd Make-My-Event-Office-Management-System
```

---

# Backend Installation

Go to:

```bash
cd backend/mme_node_express_backend
```

Install dependencies:

```bash
npm install
```

Validate Prisma:

```bash
npx prisma validate
```

Generate Prisma Client:

```bash
npx prisma generate
```

Start the backend using the script configured in `package.json`.

Typically:

```bash
npm run dev
```

or:

```bash
npm start
```

depending on the current package scripts.

---

# Frontend Installation

Go to:

```bash
cd "frontend/make my event office management system"
```

Install dependencies:

```bash
npm install
```

Start Vite:

```bash
npm run dev
```

Default development URL is normally:

```text
http://localhost:5173
```

---

# Accounts Module Dependencies

The Accounts module is imported by the main Vite application.

Dependencies used by Accounts must therefore be resolvable by the running Vite project.

Examples include:

```text
lucide-react
xlsx
```

If Vite reports:

```text
Failed to resolve import "xlsx"
```

or:

```text
Failed to resolve import "lucide-react"
```

confirm those dependencies exist in the dependency tree used by the main Vite application.

---

# Environment Configuration

Do not commit production secrets.

Typical backend configuration can include:

```env
DATABASE_URL=

JWT_SECRET=

FRONTEND_URL=

BACKEND_SRC_DIR=

ACCOUNTS_BACKEND_DIR=

PDF_GENERATOR_BACKEND_DIR=
PDF_GENERATOR_STORAGE_DIR=
PDF_GENERATOR_TEMPLATE_PATH=
```

Use the actual variables defined by the current deployment.

PDF Generator production configuration may use paths similar to:

```env
PDF_GENERATOR_BACKEND_DIR=/path/to/pdf-generator-module
PDF_GENERATOR_STORAGE_DIR=/path/to/persistent/pdf-generator-data
PDF_GENERATOR_TEMPLATE_PATH=/path/to/make-my-event-letter-pad.pdf
```

Never hard-code production database credentials into frontend code.

---

# Database Setup

The project uses Prisma with an existing MySQL/MariaDB database.

General workflow:

```bash
cd backend/mme_node_express_backend

npx prisma validate
npx prisma generate
```

When database structure is changed manually, make sure:

```text
Physical Database
        =
Prisma Schema
        =
Generated Prisma Client
```

Otherwise errors such as these can occur:

```text
Unknown argument `fieldName`
```

which normally indicates an outdated generated Prisma Client,

or:

```text
The column `table.column_name` does not exist
```

which normally indicates the production database schema has not received the corresponding migration/change.

---

# Important Production Database Rule

Do not blindly run:

```bash
npx prisma db push
```

against the production database.

Production changes should be performed through reviewed additive SQL migrations/queries and then synchronized with Prisma.

Recommended order:

```text
1. Backup database
2. Apply reviewed SQL
3. Update schema.prisma
4. npx prisma validate
5. npx prisma generate
6. Restart backend
7. Test affected feature
```

---

# MySQL and MariaDB

Development may use MySQL while production may use MariaDB.

Special attention is required for:

- JSON columns.
- Boolean/TINYINT fields.
- Prisma introspection.
- Check constraints.
- Decimal types.
- BigInt IDs.

Do not assume MariaDB dump representation will be identical to native MySQL representation.

---

# Running the Project

Typical local development requires two terminals.

## Terminal 1 — Backend

```bash
cd backend/mme_node_express_backend
npm run dev
```

## Terminal 2 — Frontend

```bash
cd "frontend/make my event office management system"
npm run dev
```

Then open:

```text
http://localhost:5173
```

---

# PDF Generator Template

The official Make My Event letter-pad PDF is stored under the PDF Generator backend templates directory.

Example:

```text
PDFGenerator/backend/templates/make-my-event-letter-pad.pdf
```

The template must be treated as read-only.

The PDF renderer copies the template and overlays dynamic content inside the safe content area.

Do not modify the original branding during normal document generation.

---

# File Storage

Uploaded files and generated official documents should live outside the frontend build output.

Do not store persistent runtime files inside:

```text
frontend/public
frontend/dist
```

because frontend deployments may rebuild or replace these directories.

Examples of persistent files include:

```text
Meeting images
Expense receipts
PDF source images
Generated PDFs
```

PDF Generator storage follows approximately:

```text
PDF_GENERATOR_STORAGE_DIR/
│
├── generated/
│   ├── MME-2026-000001.pdf
│   └── ...
│
└── source-images/
    ├── document-1/
    ├── document-2/
    └── ...
```

---

# Production Deployment

The project supports production deployment through the repository's deployment workflow.

Important modules outside the main backend/frontend directories must be explicitly included in deployment.

These include:

```text
Accounts/
PDFGenerator/
```

Creating a module locally does not automatically mean production receives it.

The deployment workflow must upload:

- Main frontend build.
- Main backend.
- Accounts backend.
- PDF Generator backend.
- Required templates.
- Required configuration files.

Persistent user-generated data must not be deleted during deployment.

---

# cPanel / Passenger Production Notes

Where the backend is deployed through cPanel/Passenger:

- Environment variables must reference the correct production paths.
- Node dependencies must be installed in the production Node environment.
- Application restart may be required after backend changes.
- `npx prisma generate` must be run when Prisma models change.
- Runtime storage directories must have suitable permissions.
- PDF templates must exist at the configured path.

---

# Security Considerations

The system should maintain the following rules:

1. Frontend code never connects directly to MySQL.
2. Database credentials remain backend-only.
3. Employee identity comes from authentication middleware.
4. Admin routes remain Admin-protected.
5. Employees should only access their authorized records.
6. PDF document ownership is validated server-side.
7. Uploaded files require MIME/type/size validation.
8. Production secrets are never committed.
9. Financial corrections and approvals require Admin authorization.
10. Attendance timestamps come from the backend.
11. Sensitive data should not be exposed through browser error responses.
12. File-storage directories should not allow arbitrary script execution.

---

# Important Development Rules

## Preserve Existing Working Flows

When adding a new feature, avoid changing unrelated working functionality.

Example:

```text
Meeting → PDF
```

should remain unchanged when improving:

```text
Excel → PDF
```

## Do Not Create Fake Database Records for UI Choices

Examples:

```text
Venue → Other
Vendor → Other
```

`Other` should normally be a UI action/value, not an artificial business entity.

For Event Based Cost:

```text
Other
```

must not create a fake vendor.

## Keep Source Data Independent

PDF-only edits should not modify the Client Meeting source.

Excel PDF import should change only the PDF draft.

## Database and Prisma Must Stay Synchronized

After Prisma model changes:

```bash
npx prisma validate
npx prisma generate
```

## Restart After Backend/Prisma Changes

Hot reload may not reload a regenerated Prisma Client reliably.

Perform a full backend restart when necessary.

---

# Excel Import Design Principles

Excel imports throughout the project should follow these general rules:

- Validate required headers.
- Ignore irrelevant extra columns when appropriate.
- Skip completely empty rows.
- Preserve meaningful rows.
- Provide clear validation errors.
- Never silently overwrite unrelated business data.
- Allow the employee to review imported information before final submission.

---

# User Experience Principles

The application aims to minimize confusion and unnecessary work.

Current UX patterns include:

- Loading states for slower actions.
- Download spinner while preparing PDF.
- Collapsible N.B. section.
- Compact Admin calendar tables.
- Resizable columns.
- Excel bulk import.
- Dynamic tables.
- Multiple-image upload.
- Clear status badges.
- Missed/completed activity indicators.
- Client history shortcuts.
- Responsive layouts.
- Confirmation/validation feedback.

---

# Testing

Important test areas include:

## Authentication

- Employee login.
- Employee logout.
- Password-change flow.
- Admin login.
- Unauthorized-route protection.

## Management

- Create client.
- Edit client.
- Custom Venue / Other.
- Excel import.
- Filtering.
- Admin cell update.

## Meetings

- Create/edit meeting.
- Add item.
- Upload images.
- Multiple images.
- Schedule next meeting.
- Assign employee.
- Meeting history.

## Calls

- Create/edit call.
- Next call schedule.
- Employee assignment.
- Call history.

## Calendar

- Employee monthly view.
- Admin monthly view.
- Missed count.
- Completed activity.
- Latest activity preview.
- Day table.
- Column resizing.

## Attendance

- Sign In.
- Duplicate Sign In prevention.
- Sign Out.
- Sign Out without Sign In.
- Duplicate Sign Out prevention.
- GPS values.
- Admin attendance filters.

## Accounts

- Money Received.
- Regular Cost.
- Event Based Cost.
- Real Vendor.
- Other non-vendor cost.
- Excel upload.
- Receipt upload.
- Vendor payment.
- Admin approval.
- Wallet update.
- Vendor ledger update.

## PDF Generator

- Meeting-mode PDF.
- Excel-mode PDF.
- Dynamic columns.
- Subtotal rows.
- Multiple images.
- N.B.
- Preview.
- Generate.
- Download.
- Download loading state.
- Archive.
- Document history.
- Employee ownership.

---

# Troubleshooting

## Prisma says "Unknown argument"

Example:

```text
Unknown argument `excelRowData`
```

Run:

```bash
cd backend/mme_node_express_backend

npx prisma validate
npx prisma generate
```

Then restart the backend.

---

## Prisma says database column does not exist

Example:

```text
The column `pdf_documents.excel_columns` does not exist
```

The Prisma Client knows the field, but the database does not.

Apply the appropriate reviewed SQL change to the correct database and restart the application.

Verify the active DB:

```sql
SELECT DATABASE();
```

---

## Vite cannot resolve an imported local file

Example:

```text
Failed to resolve import "../utils/example"
```

Verify:

- Folder exists.
- Filename spelling.
- Filename capitalization.
- `.js` extension where useful.
- File was saved.
- Vite was restarted.

Example:

```js
import {
  parseExpenseExcelFile,
} from "../utils/expenseExcelImport.js";
```

---

## Vite cannot resolve package

Example:

```text
Failed to resolve import "xlsx"
```

From the Vite application directory:

```bash
npm list xlsx
```

Install required dependency only in the appropriate dependency tree.

---

## Production Works Differently From Local

Check:

- Production environment variables.
- Database schema.
- Prisma Client version.
- Node dependency installation.
- Uploaded module files.
- cPanel application restart.
- Storage permissions.
- PDF template path.
- MySQL vs MariaDB differences.

---

# Performance Considerations

The application contains potentially data-heavy interfaces such as:

- Management workspace.
- Admin calendar.
- Client histories.
- Expense lists.
- PDF documents.

UI views should avoid rendering excessive information when unnecessary.

Examples:

- Calendar hover displays latest activities instead of every record.
- Detailed data is moved to day/detail views.
- Tables use compact rows.
- Large PDF downloads show a progress/loading state.
- Excel upload reduces repetitive manual entry.

---

# Data Integrity

The project prioritizes preserving historical business information.

Examples:

```text
Client Meeting
      ↓
PDF Snapshot
```

The PDF snapshot remains independent.

```text
Expense Submission
      ↓
Admin Approval
```

The system preserves submission/approval workflow rather than silently changing balances.

```text
Vendor Bill
      ↓
Vendor Balance
```

Only genuine vendor-linked entries affect the vendor ledger.

---

# Business-Time Handling

Office records should use the project's configured business timezone.

For Bangladesh operations, date/time-sensitive features should consistently use the project's Asia/Dhaka business-time handling where configured, particularly:

- Attendance dates.
- Meeting schedules.
- Call schedules.
- Calendar displays.
- Financial dates where applicable.

Do not rely blindly on the production server's operating-system timezone.

---

# Git Workflow

Recommended workflow:

```bash
git checkout -b feature/<feature-name>
```

Make changes.

Validate locally.

Then:

```bash
git add .
git commit -m "Add <feature description>"
git push
```

Avoid committing:

```text
.env
database passwords
JWT secrets
generated runtime PDFs
temporary uploaded files
node_modules
build caches
```

unless a specific runtime asset is intentionally version-controlled.

---

# Suggested `.gitignore`

Example entries:

```gitignore
node_modules/
.env
.env.local
.env.production

dist/
.vite/

*.log

PDFGenerator/backend/storage/generated/*
PDFGenerator/backend/storage/source-images/*

Accounts/backend/uploads/*

backend/mme_node_express_backend/uploads/*

.DS_Store
Thumbs.db
```

Keep required directory placeholders/templates if the deployment process depends on them.

---

# Current Main User Flows

## Client Workflow

```text
Employee Login
      ↓
Management
      ↓
Select Client
      ↓
Meeting / Call
      ↓
Schedule Follow-up
      ↓
Finalize Client
```

## Event Expense Workflow

```text
Confirmed Client
      ↓
Accounts
      ↓
Event Based Cost
      ↓
Vendor OR Other
      ↓
Add Items / Excel Import
      ↓
Submit
      ↓
Admin Review
      ↓
Approved Financial Record
```

## PDF Workflow

```text
Client Meeting
      ↓
PDF Generate
      ↓
Meeting Source / Excel Source
      ↓
Review Items
      ↓
Attach Images
      ↓
Preview
      ↓
Generate
      ↓
Document History
      ↓
Download / Archive
```

## Attendance Workflow

```text
Employee
   ↓
Sign In
   ↓
GPS Captured
   ↓
Work Day
   ↓
Sign Out
   ↓
Duration Calculated
   ↓
Admin Attendance Review
```

---

# Development Status

The project is under active development.

Features are continuously improved based on actual Make My Event office workflows, including:

- Management usability.
- Client follow-up tracking.
- Calendar visibility.
- Financial workflows.
- Vendor accounting.
- Excel automation.
- Proposal generation.
- Administrative oversight.

Before deploying new code to production, test both:

```text
Local Environment
Production-like Database/Configuration
```

especially for changes involving:

```text
Prisma
Database columns
Uploads
PDF generation
Accounts
Authentication
Deployment paths
```

---

# Future Improvements

Potential future enhancements include:

- More advanced financial reports.
- Dashboard analytics.
- Notification/reminder system.
- Automated meeting/call reminders.
- Role-based granular permissions.
- Enhanced audit-history interface.
- More Excel templates.
- PDF template selection.
- Additional proposal layouts.
- Attendance reports.
- Leave management.
- Payroll integration.
- Better mobile workflows.
- Automated backups.
- Search across all modules.
- Centralized activity audit log.
- Client communication notifications.
- Vendor reporting.
- Event profitability reporting.

---

# Project Principles

The system follows several important design principles:

```text
Centralized Data
+
Clear Responsibility
+
Historical Tracking
+
Admin Oversight
+
Safe Financial Accounting
+
Employee Productivity
+
Professional Client Documents
```

Every new feature should preserve these principles.

---

# Maintainer Notes

When modifying the project:

1. Inspect the existing implementation before changing architecture.
2. Prefer extending existing workflows rather than duplicating them.
3. Do not alter working production flows unnecessarily.
4. Keep database changes additive wherever possible.
5. Verify both local MySQL and production MariaDB compatibility where relevant.
6. Regenerate Prisma Client after schema changes.
7. Restart backend services after backend/Prisma updates.
8. Include top-level modules in deployment workflows.
9. Keep persistent uploads outside rebuildable frontend directories.
10. Test authorization server-side rather than relying only on UI restrictions.

---

# License

This project is an internal business-management application for **Make My Event**.

Add the appropriate private/commercial license notice here according to company policy.

---

# Contact

**Make My Event**

For internal development, deployment, or maintenance questions, use the company's authorized technical contact.

---

## Summary

The **Make My Event Office Management System** combines client management, employee collaboration, communication history, event scheduling, attendance, accounting, vendor management, proposal generation, Excel automation, and administrative control into one integrated platform.

Its purpose is to reduce manual work, prevent information loss, improve employee accountability, provide better financial visibility, and give Make My Event a reliable operational system for managing clients and events from initial communication through final execution and financial settlement.
