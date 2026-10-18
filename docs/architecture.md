# Application structure

The application is kept as a modular monolith: the web client and one versioned
REST API are deployed together, while feature modules and infrastructure
adapters have explicit boundaries. This keeps local development straightforward
and avoids introducing distributed-service failure modes before they are
needed.

## Current code layout

```text
src/
  App.tsx
  components/              Shared workspace UI and atomic controls
  features/
    admin/                 Administrator landing, dashboard, user and role management
    playbooks/             Seven user-owned Playbook forms
  lib/api.ts               Typed REST client and shared API models
  styles.css
server/
  api/
    app.ts                 HTTP routes, request validation and middleware
  config/
    load-env.ts            Optional .env loading at startup
    settings.ts            Validated server configuration
  database/
    connection.ts          MySQL connection pool
    migrations/            Ordered schema migrations
  modules/
    auth/                  Authentication, sessions and menu permission policy
    content/               File/folder/link use cases
    playbooks/             Validated, user-scoped form APIs and persistence
  database.ts              Migration runner and database lifecycle
  index.ts                 Server composition root
  link-preview.ts          Link-preview infrastructure helper
```

## Feature boundaries to grow into

Keep feature-specific UI, API client calls, domain types and server use cases
together as new workflows are added:

```text
src/
  app/                     Application shell, routing and providers
  components/ui/           Reusable atomic controls
  features/
    admin/                 Admin landing page, content management, settings
    auth/                  Sign-in, sign-up and session UI
    content/               Browse, preview and download bank content
    playbooks/             Checklist, targets, activity, customer and prospect forms
    user/                  User landing page and personal navigation
  lib/                     Shared API client, utilities and query setup
server/
  api/                     Versioned REST routes and middleware
  config/                  Validated environment configuration
  modules/
    admin/                 Admin authorization and management use cases
    auth/
    content/
    notifications/         Persistent notifications for newly added bank content
    user/                  User-facing dashboard/query use cases
  infrastructure/
    database/              Database adapter and migrations
    email/                 Email provider adapter
    files/                 Local or remote file-storage adapter
    queue/                 RabbitMQ or Redis producer/worker adapters
```

Do not let route handlers contain persistence logic or let React components
call `fetch` directly. Keep authorization in server middleware/use cases.
Menu permissions are stored in the global `role_menu_permissions` table and checked by API
routes as well as used to render navigation and actions. Administrators have
unrestricted access; Role Management is Administrator-only. Supervisors can
manage User and Member accounts but not Administrators or other Supervisors.
Users are view-only, and Members can view Bank Content and add/edit (not
delete) their own Playbook records. Each API endpoint should validate input and
return the shared `{ data }` or `{ error }` envelope.

## Runtime configuration and current limitations

Copy `.env.example` to `.env` for local configuration. Never commit `.env` or
return credential values from an API. The current database implementation and
SQL migrations are MySQL-specific; the current file-storage implementation is
local disk. `DB_TYPE` currently accepts only `mysql`; `FILE_STORAGE_PROVIDER` currently
accepts only `local`. PostgreSQL/SQLite drivers, RabbitMQ/Redis queue adapters,
SMTP delivery, and connection settings for those providers are not yet
implemented. Admin/user
roles, global role/menu permissions, and user-owned Playbook forms are implemented on
the current MySQL adapter. Playbooks use API-backed rank, status, and active-product catalogs;
period-based forms persist inline edits to header/detail tables, and customer product selections
are stored separately from customer records. Follow Up and Customer records have independent
Active/Inactive states, while workflow statuses remain catalog-driven. Playbook form data uses
`pb_` tables and the shared user identity; old dump credentials and records are not implicitly
assigned to current users. Each Playbook table can export CSV through a permission-checked,
keyset-paginated server stream, avoiding full-dataset buffering in browser memory.
Add further providers behind the infrastructure/module boundaries above rather
than making the UI or route handlers provider-aware.

The default database is `v_system`. Table names are scoped by application:
`bc_` for bank content and `pb_` for playbooks. User accounts and sessions are
shared in `users` and `sessions`, with the migration ledger in
`schema_migrations`. Shared role assignments are
stored in `user_roles`, with role/menu permissions in
`role_menu_permissions`. Startup migrates existing table names
while preserving user accounts and sessions, and removes the retired Bank Content follow-up workflow. It
stops with an explicit error if both legacy and prefixed versions of a table
are present.

For queue-backed work, persist intent with a transactional outbox before
publishing, make consumers idempotent, and report broker health separately from
API/database health. This prevents a broker outage from leaving a successful
database write that appears to have failed to the user.
