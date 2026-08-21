-- Audit history is evidence of what the system did. Application code only
-- appends to AuditLog, but that convention is not sufficient when a server
-- credential can issue arbitrary SQL. Enforce the invariant in PostgreSQL so
-- a correction must be represented by a new, attributable audit entry rather
-- than rewriting or erasing history.
CREATE OR REPLACE FUNCTION "prevent_audit_log_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only; audit history cannot be changed or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_prevent_update"
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION "prevent_audit_log_mutation"();

CREATE TRIGGER "AuditLog_prevent_delete"
BEFORE DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION "prevent_audit_log_mutation"();
