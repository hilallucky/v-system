import mysql, { type Pool } from "mysql2/promise";
import { settings } from "../config/settings.js";

export class DatabaseConnection {
  static async connect(): Promise<Pool> {
    const bootstrap = await mysql.createConnection({
      host: settings.database.host,
      port: settings.database.port,
      user: settings.database.user,
      password: settings.database.password,
      charset: "utf8mb4",
    });

    try {
      const escapedDatabaseName = settings.database.name.replaceAll("`", "``");
      await bootstrap.query(
        `CREATE DATABASE IF NOT EXISTS \`${escapedDatabaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    } finally {
      await bootstrap.end();
    }

    const pool = mysql.createPool({
      host: settings.database.host,
      port: settings.database.port,
      user: settings.database.user,
      password: settings.database.password,
      database: settings.database.name,
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
