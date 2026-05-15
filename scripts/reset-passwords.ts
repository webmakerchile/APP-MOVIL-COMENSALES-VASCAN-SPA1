import { db } from "../server/db";
import { users } from "../shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function main() {
  const all = await db.select().from(users);
  console.log(`Procesando ${all.length} usuarios...`);
  let updated = 0;
  let skipped = 0;
  for (const u of all) {
    if (u.rut === "21212011-1") { skipped++; continue; }
    const digits = (u.rut || "").replace(/[^0-9]/g, "");
    if (digits.length < 4) { skipped++; continue; }
    const newPwd = digits.slice(0, 4);
    const hashed = await bcrypt.hash(newPwd, 10);
    await db.update(users)
      .set({ password: hashed, passwordChangeRequired: false })
      .where(eq(users.id, u.id));
    updated++;
  }
  console.log(`OK: ${updated} actualizados, ${skipped} saltados (super admin / RUTs cortos).`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
