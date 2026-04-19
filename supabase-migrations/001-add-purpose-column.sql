-- Add purpose column to separate user-entered purpose from AI-extracted description
alter table receipts add column if not exists purpose text;
