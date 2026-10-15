import mysql, { type Pool } from "mysql2/promise";

export class DatabaseConnection {
  static async connect(): Promise<Pool> {
    const port = Number(process.env.DB_PORT ?? 3306);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error("DB_PORT must be an integer between 1 and 65535.");
    }

    const databaseName = process.env.DB_NAME ?? "bank_content";
    const bootstrap = await mysql.createConnection({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port,
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASSWORD ?? "",
      charset: "utf8mb4",
    });

    try {
      const escapedDatabaseName = databaseName.replaceAll("`", "``");
      await bootstrap.query(
        `CREATE DATABASE IF NOT EXISTS \`${escapedDatabaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    } finally {
      await bootstrap.end();
    }

    const pool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port,
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASSWORD ?? "",
      database: databaseName,
      charset: "utf8mb4",
      timezone: "Z",
      waitForConnections: true,
      connectionLimit: 10,
    });

    try {
      await pool.query("SELECT 1");
      return pool;
    } catch (error) {
      await pool.end();
      throw error;
    }
  }
}
