-- Normalize existing codes to lowercase (case-insensitive short codes).
-- If two rows only differed by case, the unique index would block this;
-- that collision is extremely unlikely for this app.
UPDATE "urls" SET "short_code" = LOWER("short_code");
