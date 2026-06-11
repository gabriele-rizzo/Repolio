-- Drop the legacy direct-Meta credential columns. Zernio holds OAuth tokens now, so these are
-- dead. zernio_account_id stays nullable (a connection can briefly exist before its grant is set).

ALTER TABLE "PlatformConnection"
    DROP COLUMN "access_token",
    DROP COLUMN "expires_at",
    DROP COLUMN "external_user_id";
