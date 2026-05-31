-- Stores the platform (Meta) user id so deauthorize / data-deletion callbacks
-- can find and remove the right connection.
ALTER TABLE "PlatformConnection" ADD COLUMN "external_user_id" TEXT;
