import "dotenv/config";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  const client = await pool.connect();

  try {
    console.log("Applying migration...");

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, "migrations/20260113081421_add_unit_model/migration.sql"),
      "utf-8"
    );

    await client.query(migrationSQL);

    console.log("Migration applied successfully!");
    console.log("- Created units table");
    console.log("- Renamed products.unit to products.unitCode");
    console.log("- Added products.unitId column");
  } catch (error) {
    console.error("Error applying migration:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
