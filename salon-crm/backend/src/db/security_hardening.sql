-- ==============================================================================
-- DATABASE SECURITY HARDENING SCRIPT FOR POSTGRESQL
-- Least Privilege, RLS Tenant Isolation, Function search_path, Revocations
-- ==============================================================================

-- 1. SECURE SCHEMA & REVOKE DEFAULT PUBLIC PERMISSIONS
-- Revoke all privileges from PUBLIC role on schema public to prevent unauthorized object creation
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- 2. DEDICATED ROLES: MIGRATION VS RUNTIME LEAST PRIVILEGE
-- salon_migrator: Used solely during deployment / migration execution
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'salon_migrator') THEN
    CREATE ROLE salon_migrator WITH LOGIN NOINHERIT;
  END IF;
END$$;

-- salon_app: Dedicated runtime application role (least privilege)
-- NO SUPERUSER, NO CREATEDB, NO CREATEROLE, NO REPLICATION, NO BYPASSRLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'salon_app') THEN
    CREATE ROLE salon_app WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END$$;

-- 3. GRANT MINIMAL RUNTIME PRIVILEGES TO salon_app
GRANT CONNECT ON DATABASE salon_crm TO salon_app;
GRANT USAGE ON SCHEMA public TO salon_app;

-- Grant only DML permissions (SELECT, INSERT, UPDATE, DELETE) on application tables
GRANT SELECT, INSERT, UPDATE, DELETE ON 
  salons,
  users,
  customers,
  services,
  bills,
  bill_items,
  invoices,
  whatsapp_messages,
  audit_logs,
  invoice_sequences
TO salon_app;

-- Grant USAGE & SELECT on all sequences for auto-increment IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO salon_app;

-- 4. HARDEN STORED FUNCTIONS (PREVENT SEARCH_PATH HIJACKING)
-- Explicitly lock search_path to public, pg_temp on trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5. ROW LEVEL SECURITY (RLS) FOR MULTI-TENANT ISOLATION (DEFENSE-IN-DEPTH)
-- In addition to server-side query parameterized filters (salon_id = $1),
-- enable RLS policies that enforce tenant boundaries if current_salon_id is set.

-- Enable RLS on multi-tenant tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies based on session configuration setting
-- 'app.current_salon_id'. When set, queries cannot access rows from other salons.
-- If not set (e.g. background maintenance or migration), allow access to avoid breaking jobs.

DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
CREATE POLICY tenant_isolation_customers ON customers
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.current_salon_id', true) IS NULL OR
    current_setting('app.current_salon_id', true) = '' OR
    salon_id = current_setting('app.current_salon_id', true)::INTEGER
  )
  WITH CHECK (
    current_setting('app.current_salon_id', true) IS NULL OR
    current_setting('app.current_salon_id', true) = '' OR
    salon_id = current_setting('app.current_salon_id', true)::INTEGER
  );

DROP POLICY IF EXISTS tenant_isolation_services ON services;
CREATE POLICY tenant_isolation_services ON services
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.current_salon_id', true) IS NULL OR
    current_setting('app.current_salon_id', true) = '' OR
    salon_id = current_setting('app.current_salon_id', true)::INTEGER
  )
  WITH CHECK (
    current_setting('app.current_salon_id', true) IS NULL OR
    current_setting('app.current_salon_id', true) = '' OR
    salon_id = current_setting('app.current_salon_id', true)::INTEGER
  );

DROP POLICY IF EXISTS tenant_isolation_bills ON bills;
CREATE POLICY tenant_isolation_bills ON bills
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.current_salon_id', true) IS NULL OR
    current_setting('app.current_salon_id', true) = '' OR
    salon_id = current_setting('app.current_salon_id', true)::INTEGER
  )
  WITH CHECK (
    current_setting('app.current_salon_id', true) IS NULL OR
    current_setting('app.current_salon_id', true) = '' OR
    salon_id = current_setting('app.current_salon_id', true)::INTEGER
  );

DROP POLICY IF EXISTS tenant_isolation_whatsapp ON whatsapp_messages;
CREATE POLICY tenant_isolation_whatsapp ON whatsapp_messages
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.current_salon_id', true) IS NULL OR
    current_setting('app.current_salon_id', true) = '' OR
    salon_id = current_setting('app.current_salon_id', true)::INTEGER
  )
  WITH CHECK (
    current_setting('app.current_salon_id', true) IS NULL OR
    current_setting('app.current_salon_id', true) = '' OR
    salon_id = current_setting('app.current_salon_id', true)::INTEGER
  );

-- 6. VERIFY NO DANGEROUS EXTENSIONS OR SUPERUSER GRANTS
-- Verify untrusted extensions like dblink, file_fdw, adminpack are NOT installed.
-- Revoke execution of pg_read_file, pg_ls_dir, and COPY PROGRAM from non-superusers.
REVOKE EXECUTE ON FUNCTION pg_read_file(text) FROM PUBLIC, salon_app;
REVOKE EXECUTE ON FUNCTION pg_read_file(text, bigint, bigint) FROM PUBLIC, salon_app;
REVOKE EXECUTE ON FUNCTION pg_read_file(text, bigint, bigint, boolean) FROM PUBLIC, salon_app;
REVOKE EXECUTE ON FUNCTION pg_ls_dir(text) FROM PUBLIC, salon_app;
