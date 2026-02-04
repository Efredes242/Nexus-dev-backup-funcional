-- Migration: 0008_fix_missing_columns.sql
-- Fix missing columns in local/remote DBs that were added manually or missed in previous migrations

-- 1. party_members missing guest support
ALTER TABLE party_members ADD COLUMN is_guest INTEGER DEFAULT 0;
ALTER TABLE party_members ADD COLUMN guest_name TEXT;

-- 2. installment_plans missing ownership
ALTER TABLE installment_plans ADD COLUMN created_by TEXT;

-- 3. party_expenses missing installment info (0004 was empty)
ALTER TABLE party_expenses ADD COLUMN installments_count INTEGER DEFAULT 1;
ALTER TABLE party_expenses ADD COLUMN card_name TEXT;
ALTER TABLE party_expenses ADD COLUMN first_payment_date TEXT;
