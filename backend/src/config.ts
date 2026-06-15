import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),

  db: {
    host: required("DB_HOST", "localhost"),
    port: parseInt(process.env.DB_PORT ?? "3306", 10),
    user: required("DB_USER", "admin"),
    password: required("DB_PASS"),
    database: required("DB_NAME", "absensi"),
  },

  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  },

  s3: {
    region: process.env.AWS_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "",
    presignExpires: parseInt(process.env.S3_PRESIGN_EXPIRES ?? "300", 10),
  },

  matchThreshold: parseFloat(process.env.MATCH_THRESHOLD ?? "0.5"),

  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};
