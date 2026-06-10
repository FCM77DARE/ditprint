/**
 * Autenticação do Dashboard Interno — Print Territorial Intelligence™
 * Login por e-mail + senha, independente do OAuth Manus.
 * Usa JWT assinado com JWT_SECRET para sessão stateless.
 */

import { createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcrypt";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { dashboardAdmins } from "../drizzle/schema";
import { ENV } from "./_core/env";

const DASHBOARD_JWT_COOKIE = "dit_dashboard_token";
const JWT_EXPIRY = "8h";
const BCRYPT_COST = 12;

// ─── Hashing ──────────────────────────────────────────────────────────────────

/**
 * Hash a password using bcrypt (cost 12).
 * Returns a single string (no separate salt) — bcrypt embeds salt in hash.
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

/**
 * Legacy SHA-256 verifier. Format: `salt:hash` where salt is 32 hex chars
 * and hash = sha256(salt + ":" + password).
 * Kept only to allow transparent upgrade of existing admins on next login.
 */
function verifyLegacySha256(password: string, storedHash: string): boolean {
  const [salt] = storedHash.split(":");
  if (!salt) return false;
  const computed = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  const candidate = `${salt}:${computed}`;
  try {
    const a = Buffer.from(candidate);
    const b = Buffer.from(storedHash);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

/**
 * Verify a password against a stored hash.
 * Accepts both bcrypt hashes and legacy SHA-256 `salt:hash` strings.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (isBcryptHash(storedHash)) {
    try {
      return bcrypt.compareSync(password, storedHash);
    } catch {
      return false;
    }
  }
  return verifyLegacySha256(password, storedHash);
}

/**
 * Returns true if the stored hash uses the legacy SHA-256 scheme and
 * should be re-hashed on next successful login.
 */
export function needsRehash(storedHash: string): boolean {
  return !isBcryptHash(storedHash);
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function signDashboardToken(adminId: number, email: string): Promise<string> {
  return new SignJWT({ adminId, email, type: "dashboard" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyDashboardToken(token: string): Promise<{ adminId: number; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.type !== "dashboard") return null;
    return { adminId: payload.adminId as number, email: payload.email as string };
  } catch {
    return null;
  }
}

// ─── Admin helpers ────────────────────────────────────────────────────────────

export async function createDashboardAdmin(name: string, email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const hash = hashPassword(password);
  await db.insert(dashboardAdmins).values({ name, email, passwordHash: hash });
}

export async function loginDashboardAdmin(email: string, password: string) {
  // Fallback quando o banco não está disponível (ex: Railway sem DATABASE_URL).
  // Variáveis DASHBOARD_ADMIN_EMAIL e DASHBOARD_ADMIN_PASS permitem acesso
  // de emergência sem banco. Configure via `railway variables --set`.
  const envEmail = process.env.DASHBOARD_ADMIN_EMAIL;
  const envPass  = process.env.DASHBOARD_ADMIN_PASS;
  if (envEmail && envPass && email === envEmail && password === envPass) {
    return { id: 0, email: envEmail, name: "Admin", active: true, lastLoginAt: new Date(), passwordHash: "" };
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [admin] = await db.select().from(dashboardAdmins).where(eq(dashboardAdmins.email, email)).limit(1);
  if (!admin || !admin.active) return null;
  if (!verifyPassword(password, admin.passwordHash)) return null;

  const patch: { lastLoginAt: Date; passwordHash?: string } = { lastLoginAt: new Date() };
  // Transparent upgrade: re-hash legacy SHA-256 passwords with bcrypt
  if (needsRehash(admin.passwordHash)) {
    patch.passwordHash = hashPassword(password);
  }
  await db.update(dashboardAdmins).set(patch).where(eq(dashboardAdmins.id, admin.id));
  return admin;
}

export async function getDashboardAdminByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const [admin] = await db.select().from(dashboardAdmins).where(eq(dashboardAdmins.email, email)).limit(1);
  return admin ?? null;
}

export { DASHBOARD_JWT_COOKIE };
