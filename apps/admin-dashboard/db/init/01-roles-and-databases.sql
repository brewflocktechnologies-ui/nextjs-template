-- Runs once when the Postgres volume is empty (docker-entrypoint-initdb.d), as the owner role
-- `byteflock` (P2.1-T02, ADR-012). Development only.
--
-- byteflock      owns every table and runs migrations and seeds.
-- byteflock_app  is what the dashboard connects as: not the table owner and no BYPASSRLS, so
--                row-level security always applies to it. Grants come from the migrations.
-- byteflock_test is the database the test suites drop and recreate.

CREATE ROLE byteflock_app LOGIN PASSWORD 'byteflock_app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

CREATE DATABASE byteflock_test OWNER byteflock;

REVOKE ALL ON DATABASE byteflock FROM PUBLIC;
REVOKE ALL ON DATABASE byteflock_test FROM PUBLIC;
GRANT CONNECT ON DATABASE byteflock TO byteflock_app;
GRANT CONNECT ON DATABASE byteflock_test TO byteflock_app;
