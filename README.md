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

Copy `.env.example` to `.env`, then configure the MySQL connection and local file directory. Start the MySQL server first.

For a local PowerShell session, configure credentials before starting the app:

```powershell
$env:DB_USER = "root"
$env:DB_PASSWORD = "your-local-mysql-password"
npm run dev
```

On startup, the API creates `DB_NAME` (default: `v_system`) if it does not exist, then applies pending SQL migrations and starts listening. The configured MySQL account therefore needs permission to create the database. Run the app with a least-privilege account in production. Open the Vite URL printed in the terminal; the API listens on `http://127.0.0.1:3001` and Vite proxies `/api` requests to it. Uploaded files are stored in `DATA_DIR`.

Database schema and initial demo rows are defined in `server/database/migrations/`. Bank-content tables use the `bc_` prefix (`bc_items`, `bc_follow_ups`); bank-content authorization roles use `user_roles`; playbook tables use `pb_`; shared user accounts, sessions and the migration ledger use `users`, `sessions` and `schema_migrations`. User accounts and login sessions are shared, while each application's authorization roles remain application-specific. Add a new numbered SQL file to make a schema change. At startup, legacy unprefixed bank-content tables are renamed to their prefixed equivalents. Migrations rename shared identity and migration tables in place and rename the bank-content role table to `user_roles`. If both old and new table names exist, startup stops instead of risking data loss.

See [docs/architecture.md](./docs/architecture.md) for the current module layout, intended feature boundaries, and infrastructure roadmap. Admin and user roles, follow-up workflows, and the seven Playbooks forms are implemented on MySQL. PostgreSQL/SQLite adapters, message brokers and SMTP delivery remain infrastructure targets.

Public sign-up always creates a user. To promote a trusted account to administrator, connect to the configured database and run:

```sql
UPDATE user_roles
JOIN users ON users.id = user_roles.user_id
SET user_roles.role = 'admin'
WHERE users.email = 'admin@example.com';
```

Administrators can add user accounts and disable or reactivate them from **Administrator → User Management**. Disabling an account blocks future logins and revokes its existing sessions; the last active administrator and the signed-in administrator cannot be disabled. Permanent user deletion is not available.

Only administrators can create folders, add links, or upload files. Active user accounts receive persistent in-app notifications when new bank-content files, folders, or links are added by an administrator. Selecting a notification marks it read and opens the related content or containing folder.

Users can browse, preview and download bank content, and can create and track their own follow-ups. Administrators can view and update the status of every follow-up.

The Playbooks **Form** menu contains Follow Up Checklist, Monthly Target, Activity Record & Plan, Customer List, Prospect List, 7 Daily Tasks, and Monthly Side Volume Target. Each form has authenticated create, edit, list, and delete operations; records are scoped to the signed-in shared `users.id`, and Playbook access does not use the bank-content administrator role. Catalog data is seeded from the provided SQL dump, but its old account credentials and user-owned records are deliberately not imported or attached to a different shared account.

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
| `GET` | `/api/v1/follow-ups` | List the current user's follow-ups (all follow-ups for administrators) |
| `POST` | `/api/v1/follow-ups` | Create a follow-up |
| `PATCH` | `/api/v1/follow-ups/:id` | Update follow-up status (administrator only) |
| `GET` | `/api/v1/admin/users` | List accounts and enabled/disabled state (administrator only) |
| `POST` | `/api/v1/admin/users` | Add a standard user account (administrator only) |
| `PATCH` | `/api/v1/admin/users/:id/status` | Disable or reactivate an account (administrator only) |
| `GET` | `/api/v1/notifications` | List recent notifications and total unread count for the signed-in user |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark the signed-in user's notification as read |
| `GET` | `/api/v1/playbooks/catalogs` | List Playbook product, rank, and status options |
| `GET` | `/api/v1/playbooks/:form` | List the signed-in user's records for a Playbook form |
| `POST` | `/api/v1/playbooks/:form` | Create or update a Playbook form record |
| `DELETE` | `/api/v1/playbooks/:form/:id` | Delete one of the signed-in user's Playbook records |
| `GET` | `/api/v1/items?folderId=root&view=all&sort=name` | List contents, or search all content with `search=` |
| `GET` | `/api/v1/items/:id` | Get one content item for notification navigation |
| `GET` | `/api/v1/stats` | Workspace document, folder, review, and storage totals |
| `GET` | `/api/v1/folders/:id/path` | Get a folder's breadcrumb path |
| `POST` | `/api/v1/folders` | Create a folder with `{ "name": "...", "parentId": null }` |
| `POST` | `/api/v1/links` | Save a public HTTP(S) website URL and retrieve its preview metadata |
| `POST` | `/api/v1/files` | Upload one multipart file using the `file` field and optional `parentId` |
| `GET` | `/api/v1/files/:id/preview` | Display supported uploaded content inline for preview |
| `GET` | `/api/v1/files/:id/download` | Download an uploaded file |

The sidebar displays folders as an expandable tree; nested folders load as their parents are expanded. Administrators can choose multiple files at once or drag and drop them onto the upload toolbar; each file uploads separately, so a failed file does not prevent the remaining files from uploading. Each file is limited to 20 MB. The file toolbar switches between list and thumbnail views and can save website links. Link thumbnails use Open Graph metadata from public HTTP(S) websites; the server limits redirects, response size, and request time, and blocks private or reserved IP addresses. External thumbnail images are loaded from their source website by the browser, and opening a saved link navigates to that website. Uploaded PDFs, CSV, DOCX, XLSX, PPTX, PNG and JPEG files can be previewed in the app; office documents are rendered locally in the browser and are not sent to an external preview service. Sample documents contain metadata only and cannot be previewed. Create an account with a name, email, and password of at least 10 characters. Accounts use scrypt password hashes and opaque, server-side sessions stored in MySQL; session cookies are HTTP-only and same-site, and signup/login are rate-limited. In production, configure HTTPS and protect database credentials. Uploads accept PDF, CSV, DOCX, XLSX, PPTX, PNG, and JPEG. Folder names and API inputs are validated on the server. MySQL metadata and generated server-side upload names are used instead of trusting client-provided storage paths.

## Important security boundary

This is a **local development prototype**, not a production banking system. The API binds to loopback and uses synthetic sample metadata. Admin and user roles are enforced for content writes and follow-up management, but users still share a common read-only bank content library; tenant isolation, malware scanning and audit logging are not implemented. Public sign-up creates user accounts only. To grant an administrator, first create their account, then set `role` to `admin` for that account in the configured MySQL database. Sample documents have no underlying file content. Do not expose the server to a network or upload real customer or banking data. Before production use, integrate the bank's identity provider and implement tenant isolation, audit logging, malware scanning, retention, and approved encrypted storage.
