import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { DatabaseConnection } from "./database/connection.js";

const dataDirectory = path.resolve(process.env.DATA_DIR ?? "data");
export const uploadDirectory = path.join(dataDirectory, "uploads");
mkdirSync(uploadDirectory, { recursive: true });

export const database = DatabaseConnection.connect();

export async function runMigrations(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  const migrationDirectory = fileURLToPath(
    new URL("./database/migrations/", import.meta.url),
  );
  const migrationFiles = readdirSync(migrationDirectory)
    .filter(file => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort();

  for (const filename of migrationFiles) {
    const [applied] = await pool.execute<Array<{ migration_name: string } & RowDataPacket>>(
      "SELECT migration_name FROM schema_migrations WHERE migration_name = ?",
      [filename],
    );
    if (applied.length > 0) continue;

    const sql = readFileSync(path.join(migrationDirectory, filename), "utf8");
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map(statement => statement.trim())
      .filter(Boolean);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      for (const statement of statements) {
        await connection.query(statement);
      }
      await connection.execute(
        "INSERT INTO schema_migrations (migration_name) VALUES (?)",
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
