-- Automatic language detection.
--
-- `locale_auto` marks a client whose language follows their browser/location rather than an explicit
-- choice. `Client.locale` still holds a concrete language at all times — the report cron has no HTTP
-- request to detect from, so the last detected value is what reports are written in.
--
-- New clients default to true, so someone enrolling from Italy lands in Italian. Existing clients are
-- set to false: some of them chose a language deliberately, and we can't tell which, so nobody's
-- language changes on deploy. They can opt in from the language switcher.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "locale_auto" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Client" SET "locale_auto" = false;
