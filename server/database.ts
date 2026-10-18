import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { DatabaseConnection } from "./database/connection.js";
import { settings } from "./config/settings.js";

export const uploadDirectory = path.join(settings.fileStorage.directory, "uploads");
mkdirSync(uploadDirectory, { recursive: true });

export const database = DatabaseConnection.connect();

async function migrateLegacyTableNames(pool: Pool, includeLegacyIdentityTables: boolean) {
  const mappings = [
    ["items", "bc_items"],
    ...(includeLegacyIdentityTables
      ? ([["users", "bc_users"], ["sessions", "bc_sessions"]] as const)
      : []),
  ] as const;
  const legacyNames = mappings.flatMap(([legacy, current]) => [legacy, current]);
  const placeholders = legacyNames.map(() => "?").join(", ");
  const [rows] = await pool.execute<Array<{ table_name: string } & RowDataPacket>>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name IN (${placeholders})`,
    legacyNames,
  );
  const existing = new Set(rows.map(row => row.table_name));

  const renames = mappings.filter(([legacy, current]) => {
    if (existing.has(legacy) && existing.has(current)) {
      throw new Error(
        `Cannot migrate table "${legacy}": both "${legacy}" and "${current}" exist. Resolve the duplicate tables before starting the API.`,
      );
    }
    return existing.has(legacy);
  });
  if (renames.length) {
    await pool.query(
      `RENAME TABLE ${renames.map(([legacy, current]) => `\`${legacy}\` TO \`${current}\``).join(", ")}`,
    );
    for (const [legacy, current] of renames) {
      console.info(`Renamed legacy table ${legacy} to ${current}.`);
    }
  }
}

export async function runMigrations(pool: Pool) {
  const [ledgerRows] = await pool.execute<Array<{ table_name: string } & RowDataPacket>>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN ('schema_migrations', 'others_schema_migrations')
  `);
  const ledgers = new Set(ledgerRows.map(row => row.table_name));
  if (ledgers.has("schema_migrations") && ledgers.has("others_schema_migrations")) {
    throw new Error(
      'Both "schema_migrations" and "others_schema_migrations" exist. Merge or remove the duplicate migration ledger before starting the API.',
    );
  }

  let migrationTable: "schema_migrations" | "others_schema_migrations";
  if (ledgers.has("schema_migrations")) {
    migrationTable = "schema_migrations";
  } else if (ledgers.has("others_schema_migrations")) {
    migrationTable = "others_schema_migrations";
  } else {
    migrationTable = "schema_migrations";
    await pool.query(`
      CREATE TABLE schema_migrations (
        migration_name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
  }

  const identityMigrationName = "007_use_unprefixed_shared_tables.sql";
  const [identityMigrationRows] = await pool.execute<Array<{ migration_name: string } & RowDataPacket>>(
    `SELECT migration_name FROM \`${migrationTable}\` WHERE migration_name = ?`,
    [identityMigrationName],
  );
  const sharedIdentityMigrationApplied = identityMigrationRows.length > 0;
  await migrateLegacyTableNames(pool, !sharedIdentityMigrationApplied);

  const migrationDirectory = fileURLToPath(
    new URL("./database/migrations/", import.meta.url),
  );
  const migrationFiles = readdirSync(migrationDirectory)
    .filter(file => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort();

  for (const filename of migrationFiles) {
    const [applied] = await pool.execute<Array<{ migration_name: string } & RowDataPacket>>(
      `SELECT migration_name FROM \`${migrationTable}\` WHERE migration_name = ?`,
      [filename],
    );
    if (applied.length > 0) continue;

    let skipRoleTableRename = false;
    if (filename === "009_rename_user_roles.sql") {
      const [roleTables] = await pool.execute<Array<{ table_name: string } & RowDataPacket>>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN ('bc_user_roles', 'user_roles')
      `);
      const existingRoleTables = new Set(roleTables.map(row => row.table_name));
      if (existingRoleTables.has("bc_user_roles") && existingRoleTables.has("user_roles")) {
        throw new Error(
          'Both "bc_user_roles" and "user_roles" exist. Resolve the duplicate role tables before starting the API.',
        );
      }
      if (!existingRoleTables.has("bc_user_roles") && !existingRoleTables.has("user_roles")) {
        throw new Error('Neither "bc_user_roles" nor "user_roles" exists; cannot migrate bank-content roles.');
      }
      skipRoleTableRename = existingRoleTables.has("user_roles");
    }

    let skipRolePermissionsRename = false;
    if (filename === "013_global_role_permissions_and_remove_follow_ups.sql") {
      const [permissionTables] = await pool.execute<Array<{ table_name: string } & RowDataPacket>>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND table_name IN ('bc_role_menu_permissions', 'role_menu_permissions')`,
      );
      const existingPermissionTables = new Set(permissionTables.map(row => row.table_name));
      if (existingPermissionTables.has("bc_role_menu_permissions") && existingPermissionTables.has("role_menu_permissions")) {
        throw new Error(
          'Both "bc_role_menu_permissions" and "role_menu_permissions" exist. Resolve the duplicate settings tables before starting the API.',
        );
      }
      if (!existingPermissionTables.has("bc_role_menu_permissions") && !existingPermissionTables.has("role_menu_permissions")) {
        throw new Error('Neither "bc_role_menu_permissions" nor "role_menu_permissions" exists; cannot migrate global role permissions.');
      }
      skipRolePermissionsRename = existingPermissionTables.has("role_menu_permissions");
    }

    if (filename === identityMigrationName) {
      const [sharedTables] = await pool.execute<Array<{ table_name: string } & RowDataPacket>>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN (
            'users', 'others_users',
            'sessions', 'others_sessions',
            'schema_migrations', 'others_schema_migrations'
          )
      `);
      const existingTables = new Set(sharedTables.map(row => row.table_name));
      for (const [legacy, target] of [
        ["others_users", "users"],
        ["others_sessions", "sessions"],
        ["others_schema_migrations", "schema_migrations"],
      ]) {
        if (existingTables.has(legacy) && existingTables.has(target)) {
          throw new Error(
            `Cannot migrate shared table "${legacy}": both "${legacy}" and "${target}" exist. Resolve the duplicate tables before starting the API.`,
          );
        }
      }
    }

    const sql = readFileSync(path.join(migrationDirectory, filename), "utf8");
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map(statement => statement.trim())
      .filter(Boolean);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      for (const statement of statements) {
        if (skipRoleTableRename && /^RENAME TABLE\s+bc_user_roles\s+TO\s+user_roles\s*$/i.test(statement)) {
          continue;
        }
        if (skipRolePermissionsRename && /^RENAME TABLE\s+bc_role_menu_permissions\s+TO\s+role_menu_permissions\s*$/i.test(statement)) {
          continue;
        }
        await connection.query(statement);
      }
      if (filename === identityMigrationName) migrationTable = "schema_migrations";
      await connection.execute(
        `INSERT INTO \`${migrationTable}\` (migration_name) VALUES (?)`,
        [filename],
      );
      await connection.commit();
      console.info(`Applied database migration: ${filename}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
