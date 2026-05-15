/**
 * Script para criar o admin inicial do Dashboard Interno
 * Uso: node scripts/create-admin.mjs
 */

import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const BCRYPT_COST = 12;

function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

const ADMIN_EMAIL = "admin@print.com";
const ADMIN_PASSWORD = "Print@2026";
const ADMIN_NAME = "Admin Print";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  const passwordHash = hashPassword(ADMIN_PASSWORD);
  
  try {
    await connection.execute(
      `INSERT INTO dashboard_admins (email, passwordHash, name, active, createdAt)
       VALUES (?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE passwordHash = VALUES(passwordHash), name = VALUES(name)`,
      [ADMIN_EMAIL, passwordHash, ADMIN_NAME]
    );
    console.log("✅ Admin criado com sucesso!");
    console.log(`   E-mail: ${ADMIN_EMAIL}`);
    console.log(`   Senha:  ${ADMIN_PASSWORD}`);
    console.log(`   Acesso: /dashboard/login`);
  } catch (err) {
    console.error("❌ Erro ao criar admin:", err.message);
  } finally {
    await connection.end();
  }
}

main();
