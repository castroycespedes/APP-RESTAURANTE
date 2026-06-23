ALTER TABLE "menu_items"
ADD COLUMN IF NOT EXISTS "showInPublicMenu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "showForWaiters" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "menu_items_showInPublicMenu_idx" ON "menu_items"("showInPublicMenu");
CREATE INDEX IF NOT EXISTS "menu_items_showForWaiters_idx" ON "menu_items"("showForWaiters");
