-- Owner column (nullable for anonymous hybrid create).
-- Schema previously declared clerk_user_id without a migration / via db push.
ALTER TABLE "urls" ADD COLUMN IF NOT EXISTS "clerk_user_id" TEXT;
ALTER TABLE "urls" ALTER COLUMN "clerk_user_id" DROP NOT NULL;

-- Drop any previous non-partial owner index from db push.
DROP INDEX IF EXISTS "urls_clerk_user_id_idx";

-- Partial owner index — skip anonymous nulls.
CREATE INDEX IF NOT EXISTS "urls_clerk_user_id_not_null_idx"
  ON "urls"("clerk_user_id")
  WHERE "clerk_user_id" IS NOT NULL;

-- Leave free space so click_count HOT updates avoid full-row rewrites.
ALTER TABLE "urls" SET (fillfactor = 80);
