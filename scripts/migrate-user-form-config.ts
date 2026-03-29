/**
 * Migration script: Move User.formDefaults and User.landingPage into Setting table rows.
 *
 * Run with: npx tsx scripts/migrate-user-form-config.ts
 *
 * This is idempotent — it checks for existing Setting rows before creating.
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { formDefaults: { not: null } },
        { landingPage: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      organizationId: true,
      formDefaults: true,
      landingPage: true,
    },
  });

  console.log(`Found ${users.length} user(s) with formDefaults or landingPage to migrate.`);

  let migratedDefaults = 0;
  let migratedLandingPages = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.organizationId) {
      console.log(`  Skipping ${user.email} — no organizationId`);
      skipped++;
      continue;
    }

    // Migrate formDefaults → Setting row with key "form_field_config"
    if (user.formDefaults) {
      try {
        const parsed = JSON.parse(user.formDefaults);
        // Convert user defaults (which are just { formName: { fieldName: value } })
        // into FormFieldConfig structure ({ formName: { hidden: [], defaults: { ... } } })
        const formFieldConfig: Record<string, { hidden: string[]; defaults: Record<string, unknown> }> = {};
        for (const [formName, defaults] of Object.entries(parsed)) {
          formFieldConfig[formName] = {
            hidden: [],
            defaults: defaults as Record<string, unknown>,
          };
        }

        const existing = await prisma.setting.findFirst({
          where: {
            organizationId: user.organizationId,
            key: "form_field_config",
            userId: user.id,
          },
        });

        if (!existing) {
          await prisma.setting.create({
            data: {
              organizationId: user.organizationId,
              key: "form_field_config",
              value: JSON.stringify(formFieldConfig),
              userId: user.id,
            },
          });
          migratedDefaults++;
          console.log(`  Migrated formDefaults for ${user.email}`);
        } else {
          console.log(`  Setting already exists for formDefaults — ${user.email}`);
        }
      } catch (e) {
        console.error(`  Failed to parse formDefaults for ${user.email}:`, e);
      }
    }

    // Migrate landingPage → Setting row with key "default_landing_page"
    if (user.landingPage) {
      const existing = await prisma.setting.findFirst({
        where: {
          organizationId: user.organizationId,
          key: "default_landing_page",
          userId: user.id,
        },
      });

      if (!existing) {
        await prisma.setting.create({
          data: {
            organizationId: user.organizationId,
            key: "default_landing_page",
            value: JSON.stringify(user.landingPage),
            userId: user.id,
          },
        });
        migratedLandingPages++;
        console.log(`  Migrated landingPage for ${user.email}`);
      } else {
        console.log(`  Setting already exists for landingPage — ${user.email}`);
      }
    }
  }

  console.log(`\nDone! Migrated ${migratedDefaults} formDefaults, ${migratedLandingPages} landingPages, skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
