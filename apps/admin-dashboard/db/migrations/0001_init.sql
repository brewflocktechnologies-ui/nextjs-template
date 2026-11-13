-- 0001_init (P2.1-T03, ADR-012). Runs as the owner role `byteflock`; never edit once applied
-- (the runner stores a checksum and fails on a mismatch). Forward-only.
--
-- Isolation model: every table with a tenant_id has row-level security ENABLED and FORCED, with
-- one policy. The dashboard connects as `byteflock_app` (not the owner, no BYPASSRLS) and sets
-- `app.scope` / `app.tenant_id` with SET LOCAL inside each transaction (withScope, P2.1-T05).
-- Seeds run as the owner and must `SET app.scope = 'platform'` first, because FORCE applies RLS
-- to the owner too (a superuser would bypass it, but the seed must not rely on that).

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

CREATE TABLE users (
  user_id       text PRIMARY KEY CHECK (user_id ~ '^u_[a-z0-9_]{2,40}$'),
  display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
  locale        text NOT NULL CHECK (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  platform_role text CHECK (platform_role = 'super_admin'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenants (
  tenant_id          text PRIMARY KEY CHECK (tenant_id ~ '^t_[a-z0-9_]{2,40}$'),
  name               text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  -- Foreign key to theme_revisions is added below (the two tables reference each other).
  published_revision integer CHECK (published_revision >= 1),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_memberships (
  user_id   text NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES tenants (tenant_id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN ('tenant_admin', 'agent')),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE widget_keys (
  widget_key        text PRIMARY KEY CHECK (widget_key ~ '^wk_[a-z0-9_]{2,60}$'),
  tenant_id         text NOT NULL REFERENCES tenants (tenant_id) ON DELETE CASCADE,
  -- Per-origin validation (ENDP-02a) happens in the data layer before insert.
  allowed_origins   text[] NOT NULL CHECK (cardinality(allowed_origins) BETWEEN 1 AND 20),
  locale_default    text NOT NULL CHECK (char_length(locale_default) BETWEEN 2 AND 35),
  locales_supported text[] NOT NULL CHECK (cardinality(locales_supported) >= 1),
  features          jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(features) = 'object'),
  CHECK (locale_default = ANY (locales_supported))
);
CREATE INDEX widget_keys_tenant_id_idx ON widget_keys (tenant_id);

CREATE TABLE theme_drafts (
  tenant_id  text PRIMARY KEY REFERENCES tenants (tenant_id) ON DELETE CASCADE,
  doc        jsonb NOT NULL CHECK (jsonb_typeof(doc) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL REFERENCES users (user_id)
);

CREATE TABLE theme_revisions (
  tenant_id      text NOT NULL REFERENCES tenants (tenant_id) ON DELETE CASCADE,
  -- Assigned by the trigger below when omitted; see theme_revisions_next.
  revision       integer NOT NULL CHECK (revision >= 1),
  doc            jsonb NOT NULL CHECK (jsonb_typeof(doc) = 'object'),
  schema_version integer NOT NULL CHECK (schema_version >= 1),
  published_at   timestamptz NOT NULL DEFAULT now(),
  published_by   text NOT NULL REFERENCES users (user_id),
  PRIMARY KEY (tenant_id, revision)
);

CREATE TABLE tenant_configs (
  tenant_id      text PRIMARY KEY REFERENCES tenants (tenant_id) ON DELETE CASCADE,
  -- The tenant-config guard (CONFIG-01) validates `doc` in the data layer before write.
  doc            jsonb NOT NULL CHECK (jsonb_typeof(doc) = 'object'),
  schema_version integer NOT NULL CHECK (schema_version >= 1),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text NOT NULL REFERENCES users (user_id)
);

-- The published pointer must name a revision of the same tenant. MATCH SIMPLE: a NULL
-- published_revision (nothing published yet) is not checked.
ALTER TABLE tenants
  ADD CONSTRAINT tenants_published_revision_fk
  FOREIGN KEY (tenant_id, published_revision)
  REFERENCES theme_revisions (tenant_id, revision);

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------

-- theme_revisions is immutable: no UPDATE, DELETE or TRUNCATE, for any role including the owner.
CREATE FUNCTION theme_revisions_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'theme_revisions is immutable (% rejected)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER theme_revisions_no_update_delete
  BEFORE UPDATE OR DELETE ON theme_revisions
  FOR EACH ROW EXECUTE FUNCTION theme_revisions_immutable();

CREATE TRIGGER theme_revisions_no_truncate
  BEFORE TRUNCATE ON theme_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION theme_revisions_immutable();

-- Revisions are monotonic per tenant: 1, 2, 3 with no gaps. A per-tenant advisory lock serialises
-- concurrent publishes, so two transactions cannot both take the same number. If `revision` is
-- omitted the next number is assigned; if it is given it must equal the next number.
CREATE FUNCTION theme_revisions_next() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  next_revision integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('theme_revisions:' || NEW.tenant_id, 0));
  SELECT COALESCE(MAX(revision), 0) + 1 INTO next_revision
    FROM theme_revisions WHERE tenant_id = NEW.tenant_id;
  IF NEW.revision IS NULL THEN
    NEW.revision := next_revision;
  ELSIF NEW.revision <> next_revision THEN
    RAISE EXCEPTION 'theme_revisions: revision % for % must be %', NEW.revision, NEW.tenant_id, next_revision
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER theme_revisions_monotonic
  BEFORE INSERT ON theme_revisions
  FOR EACH ROW EXECUTE FUNCTION theme_revisions_next();

-- Membership rule: a user with a platform role has no tenant memberships. Checked from both
-- sides so neither order of writes can break it.
CREATE FUNCTION tenant_memberships_not_platform() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE user_id = NEW.user_id AND platform_role IS NOT NULL) THEN
    RAISE EXCEPTION 'user % has a platform role and cannot have tenant memberships', NEW.user_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_memberships_not_platform
  BEFORE INSERT OR UPDATE ON tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION tenant_memberships_not_platform();

CREATE FUNCTION users_platform_has_no_memberships() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.platform_role IS NOT NULL
     AND EXISTS (SELECT 1 FROM tenant_memberships WHERE user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'user % has tenant memberships and cannot get a platform role', NEW.user_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_platform_has_no_memberships
  BEFORE INSERT OR UPDATE OF platform_role ON users
  FOR EACH ROW EXECUTE FUNCTION users_platform_has_no_memberships();

-- ---------------------------------------------------------------------------------------------
-- Row-level security: enabled and forced on every table with a tenant_id, one policy each.
-- The policy has no WITH CHECK, so USING also applies to INSERT and UPDATE.
-- ---------------------------------------------------------------------------------------------

ALTER TABLE tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants            FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE  ROW LEVEL SECURITY;
ALTER TABLE widget_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_keys        FORCE  ROW LEVEL SECURITY;
ALTER TABLE theme_drafts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_drafts       FORCE  ROW LEVEL SECURITY;
ALTER TABLE theme_revisions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_revisions    FORCE  ROW LEVEL SECURITY;
ALTER TABLE tenant_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs     FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenants
  USING (current_setting('app.scope', true) = 'platform' OR tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON tenant_memberships
  USING (current_setting('app.scope', true) = 'platform' OR tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON widget_keys
  USING (current_setting('app.scope', true) = 'platform' OR tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON theme_drafts
  USING (current_setting('app.scope', true) = 'platform' OR tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON theme_revisions
  USING (current_setting('app.scope', true) = 'platform' OR tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation ON tenant_configs
  USING (current_setting('app.scope', true) = 'platform' OR tenant_id = current_setting('app.tenant_id', true));

-- ---------------------------------------------------------------------------------------------
-- Grants for the application role. Least privilege: only what the data layer needs.
-- `users` has no tenant_id and no RLS: the request context loads a user before any scope exists.
-- schema_migrations is not granted. byteflock_app is not an owner, so it cannot ALTER a table
-- to disable RLS, and it has no BYPASSRLS (init script).
-- ---------------------------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO byteflock_app;

GRANT SELECT ON users TO byteflock_app;
GRANT SELECT ON tenants TO byteflock_app;
GRANT UPDATE (published_revision) ON tenants TO byteflock_app;
GRANT SELECT ON tenant_memberships TO byteflock_app;
GRANT SELECT, INSERT, UPDATE ON widget_keys TO byteflock_app;
GRANT SELECT, INSERT, UPDATE ON theme_drafts TO byteflock_app;
GRANT SELECT, INSERT ON theme_revisions TO byteflock_app;
GRANT SELECT, INSERT, UPDATE ON tenant_configs TO byteflock_app;
