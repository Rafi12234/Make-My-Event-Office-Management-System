# Management-First Frontend Modification Guide

## What changed

The current phase removes login and registration routes while keeping `src/pages/RegisterPage.jsx` in the project for later use.

Active routes:

- `/` — revised landing page
- `/management` — Excel-like management workspace

Disabled for now:

- `/login`
- `/register`

## New files

- `src/pages/ManagementPage.jsx`
- `src/components/EmployeeIdentityModal.jsx`
- `src/components/AddColumnModal.jsx`
- `src/components/ExcelImportModal.jsx`
- `src/data/defaultSheet.js`
- `src/services/managementStorage.js`
- `src/utils/excelImport.js`

## Modified files

- `src/App.jsx`
- `src/pages/LandingPage.jsx`
- `package.json`
- `package-lock.json`

## Install and run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173/management
```

## Current frontend behaviour

- Employee enters name and email only.
- Employee identity is stored in browser localStorage.
- Rows, columns, and cell values are stored in browser localStorage.
- Employees can add rows.
- Employees can add custom columns and select a data type.
- Employees can edit cells directly.
- Employees can search all rows.
- Employees can delete rows.
- Employees can import `.xlsx` and `.csv` files.
- The first spreadsheet row is treated as column headings.
- Matching headings reuse existing columns.
- New headings automatically create new columns.
- A preview is shown before import.

## Important backend note

A React browser application must not connect directly to MySQL. A backend API is still required to save employees, sheets, columns, rows, cells, and imports in the MySQL database.

When the backend is ready, replace the localStorage functions in:

```text
src/services/managementStorage.js
```

with HTTP API calls such as:

- `POST /api/employees/identify`
- `GET /api/sheets/default`
- `POST /api/sheets/:sheetId/rows`
- `PATCH /api/cells/:cellId`
- `POST /api/sheets/:sheetId/columns`
- `POST /api/imports/excel`

The current localStorage implementation is a working frontend prototype only.
