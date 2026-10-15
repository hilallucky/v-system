import "./config/load-env.js";
import { createApp } from "./api/app.js";
import { database, runMigrations } from "./database.js";
import { settings } from "./config/settings.js";

async function start() {
  const pool = await database;
  try {
    await runMigrations(pool);
  } catch (error) {
    await pool.end();
    throw error;
  }
  const app = createApp();
  app.listen(settings.port, "127.0.0.1", () => {
    console.info(`Bank Content API listening on http://127.0.0.1:${settings.port}`);
  });
}

start().catch(error => {
  console.error("Failed to start the Bank Content API.", error);
  process.exitCode = 1;
});
