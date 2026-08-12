-- Claim token for anonymous ownership transfer.
ALTER TABLE "urls" ADD COLUMN IF NOT EXISTS "claim_token_hash" TEXT;

-- Append-only click analytics.
CREATE TABLE IF NOT EXISTS "click_events" (
    "id" BIGSERIAL NOT NULL,
    "url_id" INTEGER NOT NULL,
    "short_code" TEXT NOT NULL,
    "referrer" VARCHAR(2048),
    "user_agent" VARCHAR(512),
    "ip_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "click_events_short_code_created_at_idx"
  ON "click_events"("short_code", "created_at");

CREATE INDEX IF NOT EXISTS "click_events_url_id_created_at_idx"
  ON "click_events"("url_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'click_events_url_id_fkey'
  ) THEN
    ALTER TABLE "click_events"
      ADD CONSTRAINT "click_events_url_id_fkey"
      FOREIGN KEY ("url_id") REFERENCES "urls"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Admin takedown / action audit trail.
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" SERIAL NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_at_idx"
  ON "admin_audit_logs"("created_at");

CREATE INDEX IF NOT EXISTS "admin_audit_logs_short_code_idx"
  ON "admin_audit_logs"("short_code");
