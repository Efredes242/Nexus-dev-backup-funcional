ALTER TABLE installment_plans ADD COLUMN currency TEXT;
UPDATE installment_plans SET currency = 'ARS' WHERE currency IS NULL;
