-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_analytics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url_id" INTEGER NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,
    "country" TEXT,
    "city" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clicked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_analytics" ("city", "clicked_at", "country", "id", "ip_address", "referer", "url_id", "user_agent") SELECT "city", "clicked_at", "country", "id", "ip_address", "referer", "url_id", "user_agent" FROM "analytics";
DROP TABLE "analytics";
ALTER TABLE "new_analytics" RENAME TO "analytics";
CREATE INDEX "analytics_url_id_idx" ON "analytics"("url_id");
CREATE INDEX "analytics_clicked_at_idx" ON "analytics"("clicked_at");
CREATE INDEX "analytics_ip_address_idx" ON "analytics"("ip_address");
CREATE TABLE "new_urls" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "short_code" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "custom_alias" TEXT,
    "custom_domain" TEXT,
    "password" TEXT,
    "user_id" INTEGER,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "urls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_urls" ("created_at", "custom_alias", "custom_domain", "description", "expires_at", "id", "is_active", "original_url", "password", "short_code", "title", "updated_at", "user_id") SELECT "created_at", "custom_alias", "custom_domain", "description", "expires_at", "id", "is_active", "original_url", "password", "short_code", "title", "updated_at", "user_id" FROM "urls";
DROP TABLE "urls";
ALTER TABLE "new_urls" RENAME TO "urls";
CREATE UNIQUE INDEX "urls_short_code_key" ON "urls"("short_code");
CREATE UNIQUE INDEX "urls_custom_alias_key" ON "urls"("custom_alias");
CREATE INDEX "urls_short_code_idx" ON "urls"("short_code");
CREATE INDEX "urls_user_id_idx" ON "urls"("user_id");
CREATE INDEX "urls_created_at_idx" ON "urls"("created_at");
CREATE INDEX "urls_is_active_idx" ON "urls"("is_active");
CREATE INDEX "urls_custom_domain_idx" ON "urls"("custom_domain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
