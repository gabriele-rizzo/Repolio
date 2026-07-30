-- Standing per-ad-account context for the AI report prompt.
--
-- Report.context_comment already existed, but it never reaches the model: the poll cron builds the
-- prompt in the same breath as creating the report, so the column is still NULL at generation time,
-- and the prior-report history blocks don't carry it either. It only ever affected how that one PDF
-- printed.
--
-- This column is read when the prompt is built (lib/ai/generate-report.ts), so it applies to every
-- report for the account from the next generation onwards. Nullable with no default: an account
-- without one produces exactly the prompt it did before.

-- AlterTable
ALTER TABLE "AdAccount" ADD COLUMN "context_note" TEXT;
