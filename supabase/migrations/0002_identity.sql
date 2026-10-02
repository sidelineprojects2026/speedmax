-- =============================================================================
-- 0002 Identity, permissions and access control
--
-- Organizations, users, addresses, contacts and invitations (§14 Party/IAM),
-- the table-driven permission model (§13.1), and the security helper functions
-- every later RLS policy is built on.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Organizations — every party Speedmax deals with, including Speedmax itself
-- -----------------------------------------------------------------------------

create table organizations (
  id                uuid primary key default gen_random_uuid(),
  org_type          org_type not null,
  legal_name        text not null,
  trading_name      text,
  registration_no   text,
  tax_id            text,
  country_code      char(2),
  website           text,
  -- §2.3 A-04: customer price and internal cost separated by permission.
  -- Credit control (§28 D-04) lives with the customer account.
  credit_limit      numeric(18,2),
  credit_currency   char(3),
  payment_terms     text,
  is_active         boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table organizations is
  'All counterparties (§3). org_type = speedmax marks the operating company itself.';

create index organizations_type_idx on organizations (org_type) where is_active;
create index organizations_name_idx on organizations (lower(legal_name));

create trigger organizations_touch
  before update on organizations
  for each row execute function app_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Profiles — one per auth user, bound to exactly one organization
-- -----------------------------------------------------------------------------

create table profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  organization_id   uuid not null references organizations (id) on delete restrict,
  role              user_role not null,
  full_name         text not null,
  email             citext not null,
  phone             text,
  job_title         text,
  timezone          text not null default 'UTC',
  locale            text not null default 'en',
  is_active         boolean not null default true,
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table profiles is
  'Application identity. Tenant scoping for every other table resolves through organization_id.';

create index profiles_org_idx  on profiles (organization_id) where is_active;
create unique index profiles_email_idx on profiles (email);

create trigger profiles_touch
  before update on profiles
  for each row execute function app_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Role permissions — §13.1
--
-- Configuration, not hard-coded logic (BR-035). Changing who may approve a
-- quotation is a data change, not a deployment.
-- -----------------------------------------------------------------------------

create table role_permissions (
  role        user_role not null,
  permission  text not null,
  primary key (role, permission)
);

comment on table role_permissions is
  'Role to permission grants using the §13.1 naming convention, e.g. quotation.view_internal_cost.';

-- -----------------------------------------------------------------------------
-- Addresses and contacts (§14 Party domain, §7.1 Parties)
-- -----------------------------------------------------------------------------

create table addresses (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  label             text,
  line1             text not null,
  line2             text,
  city              text,
  state_region      text,
  postal_code       text,
  country_code      char(2) not null,
  latitude          numeric(9,6),
  longitude         numeric(9,6),
  is_pickup         boolean not null default false,
  is_delivery       boolean not null default false,
  is_billing        boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index addresses_org_idx on addresses (organization_id) where is_active;

create trigger addresses_touch
  before update on addresses
  for each row execute function app_touch_updated_at();

create table contacts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  full_name         text not null,
  email             citext,
  phone             text,
  job_title         text,
  is_primary        boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index contacts_org_idx on contacts (organization_id) where is_active;

create trigger contacts_touch
  before update on contacts
  for each row execute function app_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Invitations — secure onboarding for customer and partner users (§14, §22)
-- -----------------------------------------------------------------------------

create table invitations (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  email             citext not null,
  role              user_role not null,
  -- Only the hash is stored. A leaked table must not yield usable invite links.
  token_hash        text not null unique,
  invited_by        uuid references profiles (id) on delete set null,
  expires_at        timestamptz not null,
  accepted_at       timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index invitations_org_idx   on invitations (organization_id);
create index invitations_email_idx on invitations (email) where accepted_at is null;

-- =============================================================================
-- Security helpers
--
-- All SECURITY DEFINER so they can read the caller's profile without being
-- subject to the very RLS policies that call them — the recursion that would
-- otherwise cause is the classic Supabase RLS trap.
--
-- search_path is pinned on each one. A SECURITY DEFINER function with a mutable
-- search_path is a privilege-escalation vector.
-- =============================================================================

-- Organization the current user belongs to. Null when unauthenticated.
create or replace function app_current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id from profiles where id = auth.uid() and is_active;
$$;

-- Role of the current user. Null when unauthenticated.
create or replace function app_current_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

-- True when the caller belongs to Speedmax itself (any internal role).
create or replace function app_is_internal()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from profiles p
      join organizations o on o.id = p.organization_id
     where p.id = auth.uid()
       and p.is_active
       and o.org_type = 'speedmax'
  );
$$;

-- True when the caller is an active administrator.
create or replace function app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
     where id = auth.uid() and is_active and role = 'admin'
  );
$$;

-- True when the caller's role grants `perm` (§13.1 permission names).
create or replace function app_has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from profiles p
      join role_permissions rp on rp.role = p.role
     where p.id = auth.uid()
       and p.is_active
       and rp.permission = perm
  );
$$;

-- True when the caller may see an organization's records: their own
-- organization, or any organization if they are internal Speedmax staff.
create or replace function app_can_access_org(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target is not null
     and (app_is_internal() or target = app_current_org_id());
$$;

-- =============================================================================
-- Row level security
--
-- Enabled on every table. No policy means no access — this is the
-- deny-by-default posture required by §17.1.
-- =============================================================================

alter table organizations   enable row level security;
alter table profiles        enable row level security;
alter table role_permissions enable row level security;
alter table addresses       enable row level security;
alter table contacts        enable row level security;
alter table invitations     enable row level security;

-- ---- organizations ----------------------------------------------------------
-- A customer sees only their own organization record. Internal staff see all,
-- because operations must work across customers, suppliers, agents and carriers.

create policy organizations_select on organizations
  for select to authenticated
  using (app_is_internal() or id = app_current_org_id());

create policy organizations_insert on organizations
  for insert to authenticated
  with check (app_has_permission('admin.manage'));

create policy organizations_update on organizations
  for update to authenticated
  using (app_has_permission('admin.manage'))
  with check (app_has_permission('admin.manage'));

-- ---- profiles ---------------------------------------------------------------
-- Users see colleagues in their own organization; internal staff see everyone.

create policy profiles_select on profiles
  for select to authenticated
  using (id = auth.uid() or app_can_access_org(organization_id));

-- A user may maintain their own profile, but never their own role or
-- organization — those are privilege boundaries and are enforced by trigger
-- below rather than left to the client.
create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_all on profiles
  for all to authenticated
  using (app_has_permission('admin.manage'))
  with check (app_has_permission('admin.manage'));

-- Block self-service privilege escalation: role and organization changes are
-- rejected unless the caller holds admin.manage.
create or replace function app_guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.role is distinct from old.role
      or new.organization_id is distinct from old.organization_id
      or new.is_active is distinct from old.is_active)
     and not app_has_permission('admin.manage') then
    raise exception
      'Changing role, organization, or active status requires admin.manage';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on profiles
  for each row execute function app_guard_profile_privileges();

-- ---- role_permissions -------------------------------------------------------
-- Readable by any authenticated user so the UI can hide actions the caller
-- cannot perform. It contains no tenant data. Writable by admins only.

create policy role_permissions_select on role_permissions
  for select to authenticated
  using (true);

create policy role_permissions_write on role_permissions
  for all to authenticated
  using (app_has_permission('admin.manage'))
  with check (app_has_permission('admin.manage'));

-- ---- addresses / contacts ---------------------------------------------------

create policy addresses_select on addresses
  for select to authenticated
  using (app_can_access_org(organization_id));

create policy addresses_write on addresses
  for all to authenticated
  using (app_can_access_org(organization_id))
  with check (app_can_access_org(organization_id));

create policy contacts_select on contacts
  for select to authenticated
  using (app_can_access_org(organization_id));

create policy contacts_write on contacts
  for all to authenticated
  using (app_can_access_org(organization_id))
  with check (app_can_access_org(organization_id));

-- ---- invitations ------------------------------------------------------------
-- Never selectable by customers: the token hash and the invite list are
-- administrative data. Acceptance happens through a server-side routine.

create policy invitations_internal on invitations
  for all to authenticated
  using (app_has_permission('admin.manage'))
  with check (app_has_permission('admin.manage'));

-- =============================================================================
-- Permission grants (§13.1)
--
-- Segregation of duties (§13): the pricing officer prepares quotations but
-- cannot approve them; the finance officer prepares invoices but payment
-- verification is a separate grant. No role both prepares and approves the
-- same high-risk transaction.
-- =============================================================================

insert into role_permissions (role, permission) values
  -- Customer Requestor — own organization's requests and tracking only.
  ('customer_requestor', 'shipping_order.create'),
  ('customer_requestor', 'shipping_order.view'),
  ('customer_requestor', 'shipping_order.submit'),
  ('customer_requestor', 'shipping_order.cancel'),
  ('customer_requestor', 'quotation.view'),
  ('customer_requestor', 'shipment.view'),
  ('customer_requestor', 'document.upload'),
  ('customer_requestor', 'document.view'),
  ('customer_requestor', 'message.send'),
  ('customer_requestor', 'claim.file'),
  ('customer_requestor', 'exception.view'),

  -- Customer Approver — accepts quotations within authority.
  ('customer_approver', 'shipping_order.create'),
  ('customer_approver', 'shipping_order.view'),
  ('customer_approver', 'shipping_order.submit'),
  ('customer_approver', 'shipping_order.cancel'),
  ('customer_approver', 'quotation.view'),
  ('customer_approver', 'quotation.accept'),
  ('customer_approver', 'shipment.view'),
  ('customer_approver', 'document.upload'),
  ('customer_approver', 'document.view'),
  ('customer_approver', 'message.send'),
  ('customer_approver', 'claim.file'),
  ('customer_approver', 'exception.view'),

  -- Customer Finance — invoices, payment evidence, balances. No operations.
  ('customer_finance', 'shipping_order.view'),
  ('customer_finance', 'quotation.view'),
  ('customer_finance', 'shipment.view'),
  ('customer_finance', 'invoice.view'),
  ('customer_finance', 'payment.submit'),
  ('customer_finance', 'document.upload'),
  ('customer_finance', 'document.view'),
  ('customer_finance', 'message.send'),
  ('customer_finance', 'exception.view'),

  -- Operations Coordinator — owns shipment execution. Approves quotations
  -- prepared by pricing, satisfying preparer-is-not-approver.
  ('ops_coordinator', 'shipping_order.view'),
  ('ops_coordinator', 'shipping_order.review'),
  ('ops_coordinator', 'quotation.view'),
  ('ops_coordinator', 'quotation.view_internal_cost'),
  ('ops_coordinator', 'quotation.approve'),
  ('ops_coordinator', 'quotation.release'),
  ('ops_coordinator', 'booking.release'),
  ('ops_coordinator', 'shipment.view'),
  ('ops_coordinator', 'shipment.manage'),
  ('ops_coordinator', 'shipment.assign_agent'),
  ('ops_coordinator', 'shipment.close'),
  ('ops_coordinator', 'milestone.post'),
  ('ops_coordinator', 'document.upload'),
  ('ops_coordinator', 'document.view'),
  ('ops_coordinator', 'document.verify'),
  ('ops_coordinator', 'customs.manage'),
  ('ops_coordinator', 'exception.view'),
  ('ops_coordinator', 'exception.manage'),
  ('ops_coordinator', 'claim.manage'),
  ('ops_coordinator', 'message.send'),

  -- Pricing Officer — prepares costs and quotations. Explicitly no approval.
  ('pricing_officer', 'shipping_order.view'),
  ('pricing_officer', 'quotation.view'),
  ('pricing_officer', 'quotation.prepare'),
  ('pricing_officer', 'quotation.view_internal_cost'),
  ('pricing_officer', 'shipment.view'),
  ('pricing_officer', 'document.view'),
  ('pricing_officer', 'message.send'),

  -- Finance Officer — billing, collection, payables.
  ('finance_officer', 'shipping_order.view'),
  ('finance_officer', 'quotation.view'),
  ('finance_officer', 'quotation.view_internal_cost'),
  ('finance_officer', 'shipment.view'),
  ('finance_officer', 'invoice.view'),
  ('finance_officer', 'invoice.prepare'),
  ('finance_officer', 'invoice.issue'),
  ('finance_officer', 'payment.verify'),
  ('finance_officer', 'expense.approve'),
  ('finance_officer', 'document.view'),
  ('finance_officer', 'document.verify'),
  ('finance_officer', 'message.send'),

  -- Administrator — configuration and access administration, plus audit.
  ('admin', 'admin.manage'),
  ('admin', 'audit.view'),
  ('admin', 'shipping_order.view'),
  ('admin', 'shipping_order.review'),
  ('admin', 'quotation.view'),
  ('admin', 'quotation.view_internal_cost'),
  ('admin', 'quotation.approve'),
  ('admin', 'quotation.release'),
  ('admin', 'booking.release'),
  ('admin', 'shipment.view'),
  ('admin', 'shipment.manage'),
  ('admin', 'shipment.assign_agent'),
  ('admin', 'shipment.close'),
  ('admin', 'milestone.post'),
  ('admin', 'document.view'),
  ('admin', 'document.verify'),
  ('admin', 'document.view_restricted'),
  ('admin', 'customs.manage'),
  ('admin', 'invoice.view'),
  ('admin', 'invoice.prepare'),
  ('admin', 'invoice.issue'),
  ('admin', 'payment.verify'),
  ('admin', 'expense.approve'),
  ('admin', 'exception.view'),
  ('admin', 'exception.manage'),
  ('admin', 'claim.manage'),
  ('admin', 'message.send');
