import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

interface ENV {
  PORT: number | undefined;
  DATABASE_URL: string | undefined;
  JWT_SECRET: string | undefined;
  FRONTEND_URL: string | undefined;
  PLUNK_API_KEY: string | undefined;
  BASE_URL: string | undefined;
}

interface Config {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  PLUNK_API_KEY: string;
  BASE_URL: string;
}

const getConfig = (): ENV => {
  return {
    PORT: process.env.PORT ? Number(process.env.PORT) : undefined,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL,
    PLUNK_API_KEY: process.env.PLUNK_API_KEY,
    BASE_URL:
      process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`,
  };
};

const getCleanConfig = (config: ENV): Config => {
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) {
      throw new Error(`Missing key ${key} in config.env`);
    }
  }
  return config as Config;
};

const config = getConfig();

const cleanConfig = getCleanConfig(config);

export default cleanConfig;
