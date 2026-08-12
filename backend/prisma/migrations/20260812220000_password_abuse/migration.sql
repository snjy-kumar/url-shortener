ALTER TABLE "urls" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;

CREATE TABLE IF NOT EXISTS "abuse_reports" (
    "id" SERIAL NOT NULL,
    "short_code" TEXT NOT NULL,
    "url_id" INTEGER,
    "reason" VARCHAR(1000) NOT NULL,
    "reporter_email" VARCHAR(320),
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "abuse_reports_status_created_at_idx"
  ON "abuse_reports"("status", "created_at");

CREATE INDEX IF NOT EXISTS "abuse_reports_short_code_idx"
  ON "abuse_reports"("short_code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'abuse_reports_url_id_fkey'
  ) THEN
    ALTER TABLE "abuse_reports"
      ADD CONSTRAINT "abuse_reports_url_id_fkey"
      FOREIGN KEY ("url_id") REFERENCES "urls"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
