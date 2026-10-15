import { createApp } from "./app.js";
import { database, runMigrations } from "./database.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

async function start() {
  const pool = await database;
  try {
    await runMigrations(pool);
  } catch (error) {
    await pool.end();
    throw error;
  }
  const app = createApp();
  app.listen(port, "127.0.0.1", () => {
    console.info(`Bank Content API listening on http://127.0.0.1:${port}`);
  });
}

start().catch(error => {
  console.error("Failed to start the Bank Content API.", error);
  process.exitCode = 1;
});
