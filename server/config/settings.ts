import { resolve } from "node:path";
import { z } from "zod";

const settingsSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DB_TYPE: z.enum(["mysql"]).default("mysql"),
  DB_HOST: z.string().trim().min(1).default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
  DB_USER: z.string().trim().min(1).default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().trim().min(1).default("v_system"),
  FILE_STORAGE_PROVIDER: z.enum(["local"]).default("local"),
  DATA_DIR: z.string().trim().min(1).default("data"),
});

const parsedSettings = settingsSchema.safeParse(process.env);

if (!parsedSettings.success) {
  throw new Error(`Invalid application configuration: ${parsedSettings.error.message}`);
}

export const settings = {
  environment: parsedSettings.data.NODE_ENV,
  port: parsedSettings.data.PORT,
  database: {
    type: parsedSettings.data.DB_TYPE,
    host: parsedSettings.data.DB_HOST,
    port: parsedSettings.data.DB_PORT,
    user: parsedSettings.data.DB_USER,
    password: parsedSettings.data.DB_PASSWORD,
    name: parsedSettings.data.DB_NAME,
  },
  fileStorage: {
    provider: parsedSettings.data.FILE_STORAGE_PROVIDER,
    directory: resolve(parsedSettings.data.DATA_DIR),
  },
};
