-- Adds an optional avatar image URL to clients (Supabase Storage public URL).
ALTER TABLE "Client" ADD COLUMN "image" TEXT;
