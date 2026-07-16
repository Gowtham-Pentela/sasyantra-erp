-- Project.paymentTerms: free-text credit string -> credit period in days (INTEGER).
-- Coerce existing values like '30 days from invoice' -> 30 by extracting the leading
-- integer; rows with no leading integer become NULL.
ALTER TABLE "Project" ALTER COLUMN "paymentTerms" TYPE INTEGER
  USING NULLIF(substring("paymentTerms" FROM '^[0-9]+'), '')::INTEGER;