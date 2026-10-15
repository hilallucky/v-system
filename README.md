# Bank Content Workspace

A component-based local demo of a bank document workspace. The frontend uses React, TypeScript, Tailwind CSS, and shadcn/ui-style components; the API is a versioned Express REST API backed by MySQL.

## Requirements

- Node.js 20.19+ (or 22.12+)
- npm
- MySQL 8.0+ (or a compatible MySQL server)

## Run locally

```powershell
npm install
npm run dev
```

Start the MySQL server first. The API connects using these environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `DB_HOST` | `127.0.0.1` | MySQL server host |
| `DB_PORT` | `3306` | MySQL server port |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | empty | MySQL password |
| `DB_NAME` | `bank_content` | Database name |

For a local PowerShell session, configure credentials before starting the app:

```powershell
$env:DB_USER = "root"
$env:DB_PASSWORD = "your-local-mysql-password"
npm run dev
```

On startup, the API creates `DB_NAME` if it does not exist, then applies pending SQL migrations and starts listening. The configured MySQL account therefore needs permission to create the database. Run the app with a least-privilege account in production. Open the Vite URL printed in the terminal; the API listens on `http://127.0.0.1:3001` and Vite proxies `/api` requests to it. Uploaded files are stored in the local `data/` directory. Set `DATA_DIR` to change that location.

Database schema and initial demo rows are defined in `server/database/migrations/`. Applied migrations are recorded in `schema_migrations`; add a new numbered SQL file (for example, `003_add_category.sql`) to make a schema change. Existing SQLite databases are left untouched and are not automatically imported into MySQL.

For a production-style local run:

```powershell
npm run build
npm start
```

The API serves the built frontend when `dist/` exists. Set `PORT` to change the API port.

## REST API

All responses use a `{ "data": ... }` success envelope or an `{ "error": { "message": ..., "details"?: ... } }` error envelope.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Check API/database availability |
| `POST` | `/api/v1/auth/signup` | Create an account and start a session |
| `POST` | `/api/v1/auth/login` | Log in and start a session |
| `POST` | `/api/v1/auth/logout` | End the current session |
| `GET` | `/api/v1/auth/me` | Get the current user's profile |
| `PUT` | `/api/v1/auth/profile` | Update the current user's name and email |
| `GET` | `/api/v1/items?folderId=root&view=all&sort=name` | List contents, or search all content with `search=` |
| `GET` | `/api/v1/stats` | Workspace document, folder, review, and storage totals |
| `GET` | `/api/v1/folders/:id/path` | Get a folder's breadcrumb path |
| `POST` | `/api/v1/folders` | Create a folder with `{ "name": "...", "parentId": null }` |
| `POST` | `/api/v1/links` | Save a public HTTP(S) website URL and retrieve its preview metadata |
| `POST` | `/api/v1/files` | Upload one multipart file using the `file` field and optional `parentId` |
| `GET` | `/api/v1/files/:id/preview` | Display supported uploaded content inline for preview |
| `GET` | `/api/v1/files/:id/download` | Download an uploaded file |

The sidebar displays folders as an expandable tree; nested folders load as their parents are expanded. The file toolbar switches between list and thumbnail views and can save website links. Link thumbnails use Open Graph metadata from public HTTP(S) websites; the server limits redirects, response size, and request time, and blocks private or reserved IP addresses. External thumbnail images are loaded from their source website by the browser, and opening a saved link navigates to that website. Uploaded PDFs, images, and CSV files can be previewed in the app; other formats can be downloaded and opened in a compatible application. Sample documents contain metadata only and cannot be previewed. Create an account with a name, email, and password of at least 10 characters. Accounts use scrypt password hashes and opaque, server-side sessions stored in MySQL; session cookies are HTTP-only and same-site, and signup/login are rate-limited. In production, configure HTTPS and protect database credentials. Uploads are limited to 20 MB per file and accept PDF, CSV, DOCX, XLSX, PPTX, PNG, and JPEG. Folder names and API inputs are validated on the server. MySQL metadata and generated server-side upload names are used instead of trusting client-provided storage paths.

## Important security boundary

This is a **local development prototype**, not a production banking system. The API binds to loopback and uses synthetic sample metadata. Authentication is implemented, but all logged-in users currently share the same workspace; there are no roles, per-user/tenant access rules, malware scanning, or audit log. Sample documents have no underlying file content. Do not expose the server to a network or upload real customer or banking data. Before production use, integrate the bank's identity provider and enforce role-based access, tenant isolation, audit logging, malware scanning, retention, and approved encrypted storage.
