# Make My Event Node/Express Backend

## 1. Prepare MySQL
Execute your corrected database SQL first. Then execute:

`database/add_row_key_migration.sql`

Skip the migration only if `sheet_rows` already contains a `row_key` column.

## 2. Install packages

```bash
npm install express mysql2 cors dotenv morgan
```

## 3. Environment
Copy `.env.example` to `.env` and add your MySQL password.

## 4. Start

```bash
npm run dev
```

Test:

`http://localhost:5000/api/health`
