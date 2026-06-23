CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "group" TEXT NOT NULL DEFAULT 'general',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_settings_key_key" ON "app_settings"("key");
CREATE INDEX IF NOT EXISTS "app_settings_group_idx" ON "app_settings"("group");
CREATE INDEX IF NOT EXISTS "app_settings_isActive_idx" ON "app_settings"("isActive");
CREATE INDEX IF NOT EXISTS "app_settings_createdAt_idx" ON "app_settings"("createdAt");
