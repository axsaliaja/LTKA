import jwt from "jsonwebtoken";
import { config } from "../config";

export type Role = "student" | "lecturer";

export interface JwtPayload {
  sub: number; // users.id
  role: Role;
  name: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as unknown as JwtPayload;
}
