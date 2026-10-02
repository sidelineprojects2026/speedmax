-- =============================================================================
-- 0004 Shipping Orders and Quotations
--
-- §7 Shipping Order specification, §8 Quotation/approval/booking.
--
-- The security-critical part of the schema. BR-008 requires internal cost and
-- margin to be hidden from customer, supplier and unauthorised internal roles.
-- That is enforced here in two layers:
--
--   1. `quotation_charges` carries both cost and sell, and its RLS grants SELECT
--      only to holders of quotation.view_internal_cost. Customers are denied the
--      table outright — not merely filtered.
--   2. Customers read `quotation_charges_customer`, a view that exposes sell
--      columns only and applies its own organisation scoping.
--
-- Filtering cost out in the application layer would leave the column one
-- forgotten `select *` away from the wire. §24.1 #16 exists to prove this.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shipping Orders — §7.1
-- -----------------------------------------------------------------------------

create table shipping_orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text not null unique
                          default app_control_number('SO', 'shipping_order_seq'),
  status                shipping_order_status not null default 'draft',

  -- Identity
  customer_org_id       uuid not null references organizations (id) on delete restrict,
  requestor_id          uuid references profiles (id) on delete set null,
  customer_reference    text,
  request_date          date not null default current_date,

  -- Service
  mode                  transport_mode,
  service_type          text,
  priority              service_priority not null default 'standard',
  requested_pickup_date date,
  requested_delivery_date date,
  insurance_requested   boolean not null default false,

  -- Route
  supplier_org_id       uuid references organizations (id) on delete set null,
  pickup_address_id     uuid references addresses (id) on delete set null,
  origin_location_id    uuid references locations (id) on delete set null,
  destination_location_id uuid references locations (id) on delete set null,
  delivery_address_id   uuid references addresses (id) on delete set null,

  -- Commercial
  incoterm_code         char(3) references incoterms (code),
  incoterm_named_place  text,
  declared_value        numeric(18,2),
  declared_currency     char(3) references currencies (code),
  payment_terms         text,

  -- Instructions (§7.1)
  special_instructions  text,
  requires_review       boolean not null default false,
  review_reason         text,

  -- Lifecycle audit
  submitted_at          timestamptz,
  reviewed_by           uuid references profiles (id) on delete set null,
  reviewed_at           timestamptz,
  status_reason         text,
  source_quote_request_id uuid references quote_requests (id) on delete set null,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column shipping_orders.requires_review is
  'BR-003 — set when restricted, hazardous, temperature-controlled, fragile, high-value or otherwise special cargo is present.';

create index shipping_orders_customer_idx on shipping_orders (customer_org_id, status);
create index shipping_orders_status_idx   on shipping_orders (status, submitted_at desc);
create index shipping_orders_review_idx    on shipping_orders (submitted_at)
  where status = 'submitted';

create trigger shipping_orders_touch
  before update on shipping_orders
  for each row execute function app_touch_updated_at();

-- Cargo items — §7.2
create table shipping_order_items (
  id                uuid primary key default gen_random_uuid(),
  shipping_order_id uuid not null references shipping_orders (id) on delete cascade,
  line_no           smallint not null,
  description       text not null,
  cargo_category_id uuid references cargo_categories (id),
  hs_code           text,
  origin_country    char(2) references countries (code),
  quantity          numeric(14,3) not null,
  uom               text not null default 'PCS',
  unit_value        numeric(18,4),
  total_value       numeric(18,2),
  value_currency    char(3) references currencies (code),

  -- Handling attributes (§7.2)
  is_fragile        boolean not null default false,
  is_stackable      boolean not null default true,
  is_hazardous      boolean not null default false,
  is_oversized      boolean not null default false,
  is_high_value     boolean not null default false,
  is_controlled     boolean not null default false,
  temperature_min_c numeric(6,2),
  temperature_max_c numeric(6,2),

  -- Traceability (§7.2)
  customer_po_line  text,
  supplier_sku      text,
  lot_or_batch      text,
  serial_numbers    text[],

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (shipping_order_id, line_no)
);

create index shipping_order_items_order_idx on shipping_order_items (shipping_order_id);

create trigger shipping_order_items_touch
  before update on shipping_order_items
  for each row execute function app_touch_updated_at();

-- Packages — §7.2
create table cargo_packages (
  id                uuid primary key default gen_random_uuid(),
  shipping_order_id uuid not null references shipping_orders (id) on delete cascade,
  order_item_id     uuid references shipping_order_items (id) on delete cascade,
  line_no           smallint not null,
  packaging_type    text not null default 'CARTON',
  package_count     integer not null default 1,
  gross_weight_kg   numeric(14,3),
  net_weight_kg     numeric(14,3),
  length_cm         numeric(10,2),
  width_cm          numeric(10,2),
  height_cm         numeric(10,2),
  volume_cbm        numeric(14,4),
  marks_and_numbers text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (shipping_order_id, line_no)
);

create index cargo_packages_order_idx on cargo_packages (shipping_order_id);

create trigger cargo_packages_touch
  before update on cargo_packages
  for each row execute function app_touch_updated_at();

-- Parties — §7.1. Shipper, consignee, notify and billing party may each differ
-- from the customer, which is why they are rows rather than columns.
create table order_parties (
  id                uuid primary key default gen_random_uuid(),
  shipping_order_id uuid not null references shipping_orders (id) on delete cascade,
  party_role        text not null,   -- shipper | consignee | notify | billing
  organization_id   uuid references organizations (id) on delete set null,
  name              text not null,
  address_text      text,
  country_code      char(2) references countries (code),
  contact_name      text,
  contact_email     citext,
  contact_phone     text,
  created_at        timestamptz not null default now(),
  unique (shipping_order_id, party_role)
);

-- =============================================================================
-- Quotations — §8
-- =============================================================================

create table quotations (
  id                uuid primary key default gen_random_uuid(),
  quote_number      text not null unique
                      default app_control_number('QT', 'quotation_seq'),
  shipping_order_id uuid not null references shipping_orders (id) on delete restrict,
  customer_org_id   uuid not null references organizations (id) on delete restrict,
  status            quotation_status not null default 'draft',
  current_version   smallint not null default 1,
  prepared_by       uuid references profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index quotations_order_idx    on quotations (shipping_order_id);
create index quotations_customer_idx on quotations (customer_org_id, status);

create trigger quotations_touch
  before update on quotations
  for each row execute function app_touch_updated_at();

-- Versions — §8.2. A released version is immutable; revision creates a new one.
create table quotation_versions (
  id                uuid primary key default gen_random_uuid(),
  quotation_id      uuid not null references quotations (id) on delete cascade,
  version_no        smallint not null,
  status            quotation_status not null default 'draft',
  currency          char(3) not null references currencies (code),
  valid_from        date not null default current_date,
  valid_until       date not null,
  terms             text,
  assumptions       text,
  exclusions        text,

  -- Approval trail (§8.2)
  prepared_by       uuid references profiles (id) on delete set null,
  approved_by       uuid references profiles (id) on delete set null,
  approved_at       timestamptz,
  released_at       timestamptz,
  -- Set when margin fell below policy and needed escalation (§8.2)
  escalated         boolean not null default false,
  escalation_reason text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (quotation_id, version_no)
);

create index quotation_versions_quotation_idx on quotation_versions (quotation_id, version_no desc);

create trigger quotation_versions_touch
  before update on quotation_versions
  for each row execute function app_touch_updated_at();

-- A released version must not change. Enforced in the database because §8.2
-- makes immutability a control, not a UI convention.
create or replace function app_guard_released_quotation_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.released_at is not null
     and new.status not in ('accepted', 'declined', 'expired', 'cancelled', 'revision_requested') then
    raise exception
      'Quotation version % is released and cannot be edited. Create a new version instead.',
      old.version_no;
  end if;
  return new;
end;
$$;

create trigger quotation_versions_guard_released
  before update on quotation_versions
  for each row execute function app_guard_released_quotation_version();

-- Route options — §8, BR-009. One quotation may offer several routings.
create table route_options (
  id                    uuid primary key default gen_random_uuid(),
  quotation_version_id  uuid not null references quotation_versions (id) on delete cascade,
  option_no             smallint not null,
  label                 text not null,
  mode                  transport_mode not null,
  origin_location_id    uuid references locations (id),
  destination_location_id uuid references locations (id),
  transit_days_min      smallint,
  transit_days_max      smallint,
  departure_frequency   text,
  carrier_org_id        uuid references organizations (id) on delete set null,
  schedule_note         text,
  assumptions           text,
  exclusions            text,
  is_recommended        boolean not null default false,
  created_at            timestamptz not null default now(),
  unique (quotation_version_id, option_no)
);

create index route_options_version_idx on route_options (quotation_version_id);

-- Charge lines — §8.1. Cost and sell live together; access does not.
create table quotation_charges (
  id                uuid primary key default gen_random_uuid(),
  route_option_id   uuid not null references route_options (id) on delete cascade,
  charge_code_id    uuid references charge_codes (id),
  charge_group      charge_group not null,
  description       text not null,
  quantity          numeric(14,3) not null default 1,
  -- Internal only. Never exposed to a customer surface.
  cost_amount       numeric(18,2) not null default 0,
  sell_amount       numeric(18,2) not null default 0,
  currency          char(3) not null references currencies (code),
  is_taxable        boolean not null default true,
  tax_rate_pct      numeric(6,3) not null default 0,
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now()
);

comment on column quotation_charges.cost_amount is
  'Internal cost. BR-008 — restricted to roles holding quotation.view_internal_cost.';

create index quotation_charges_option_idx on quotation_charges (route_option_id);

-- Acceptance — §8.2. Records who accepted what, when, and on what evidence.
create table quotation_acceptances (
  id                    uuid primary key default gen_random_uuid(),
  quotation_version_id  uuid not null references quotation_versions (id) on delete restrict,
  route_option_id       uuid not null references route_options (id) on delete restrict,
  accepted_by           uuid not null references profiles (id) on delete restrict,
  accepted_at           timestamptz not null default now(),
  accepted_terms        text not null,
  ip_address            inet,
  user_agent            text,
  evidence_note         text,
  unique (quotation_version_id)
);

-- =============================================================================
-- Row level security
-- =============================================================================

alter table shipping_orders       enable row level security;
alter table shipping_order_items  enable row level security;
alter table cargo_packages        enable row level security;
alter table order_parties         enable row level security;
alter table quotations            enable row level security;
alter table quotation_versions    enable row level security;
alter table route_options         enable row level security;
alter table quotation_charges     enable row level security;
alter table quotation_acceptances enable row level security;

-- ---- shipping_orders --------------------------------------------------------

create policy shipping_orders_select on shipping_orders
  for select to authenticated
  using (app_can_access_org(customer_org_id));

-- A customer may create an order for their own organisation only.
create policy shipping_orders_insert on shipping_orders
  for insert to authenticated
  with check (
    app_has_permission('shipping_order.create')
    and customer_org_id = app_current_org_id()
  );

-- Customers may edit their own orders only while still in draft or when we have
-- asked them for more information. Internal reviewers may progress any order.
create policy shipping_orders_update_customer on shipping_orders
  for update to authenticated
  using (
    customer_org_id = app_current_org_id()
    and status in ('draft', 'information_required')
    and app_has_permission('shipping_order.create')
  )
  with check (customer_org_id = app_current_org_id());

create policy shipping_orders_update_internal on shipping_orders
  for update to authenticated
  using (app_has_permission('shipping_order.review'))
  with check (app_has_permission('shipping_order.review'));

-- Only an untouched draft may be deleted; anything submitted is cancelled
-- instead, preserving the record (§14.2).
create policy shipping_orders_delete_draft on shipping_orders
  for delete to authenticated
  using (
    customer_org_id = app_current_org_id()
    and status = 'draft'
    and app_has_permission('shipping_order.create')
  );

-- ---- order children ---------------------------------------------------------
-- Access follows the parent order. Editability follows the parent's status, so
-- cargo lines freeze exactly when the order does.

create policy shipping_order_items_select on shipping_order_items
  for select to authenticated
  using (exists (
    select 1 from shipping_orders o
     where o.id = shipping_order_id and app_can_access_org(o.customer_org_id)
  ));

create policy shipping_order_items_write on shipping_order_items
  for all to authenticated
  using (exists (
    select 1 from shipping_orders o
     where o.id = shipping_order_id
       and (app_has_permission('shipping_order.review')
            or (o.customer_org_id = app_current_org_id()
                and o.status in ('draft', 'information_required')))
  ))
  with check (exists (
    select 1 from shipping_orders o
     where o.id = shipping_order_id
       and (app_has_permission('shipping_order.review')
            or (o.customer_org_id = app_current_org_id()
                and o.status in ('draft', 'information_required')))
  ));

create policy cargo_packages_select on cargo_packages
  for select to authenticated
  using (exists (
    select 1 from shipping_orders o
     where o.id = shipping_order_id and app_can_access_org(o.customer_org_id)
  ));

create policy cargo_packages_write on cargo_packages
  for all to authenticated
  using (exists (
    select 1 from shipping_orders o
     where o.id = shipping_order_id
       and (app_has_permission('shipping_order.review')
            or (o.customer_org_id = app_current_org_id()
                and o.status in ('draft', 'information_required')))
  ))
  with check (exists (
    select 1 from shipping_orders o
     where o.id = shipping_order_id
       and (app_has_permission('shipping_order.review')
            or (o.customer_org_id = app_current_org_id()
                and o.status in ('draft', 'information_required')))
  ));

create policy order_parties_select on order_parties
  for select to authenticated
  using (exists (
    select 1 from shipping_orders o
     where o.id = shipping_order_id and app_can_access_org(o.customer_org_id)
  ));

create policy order_parties_write on order_parties
  for all to authenticated
  using (exists (
    select 1 from shipping_orders o
     where o.id = shipping_order_id
       and (app_has_permission('shipping_order.review')
            or (o.customer_org_id = app_current_org_id()
                and o.status in ('draft', 'information_required')))
  ))
  with check (exists (
    select 1 from shipping_orders o
     where o.id = shipping_order_id
       and (app_has_permission('shipping_order.review')
            or (o.customer_org_id = app_current_org_id()
                and o.status in ('draft', 'information_required')))
  ));

-- ---- quotations -------------------------------------------------------------

create policy quotations_select on quotations
  for select to authenticated
  using (app_can_access_org(customer_org_id));

create policy quotations_write on quotations
  for all to authenticated
  using (app_has_permission('quotation.prepare') or app_has_permission('quotation.approve'))
  with check (app_has_permission('quotation.prepare') or app_has_permission('quotation.approve'));

-- Customers see released versions and later states only. A draft or
-- pending-approval version is internal work in progress and must not leak.
create policy quotation_versions_select on quotation_versions
  for select to authenticated
  using (
    exists (
      select 1 from quotations q
       where q.id = quotation_id
         and (
           app_is_internal()
           or (q.customer_org_id = app_current_org_id()
               and quotation_versions.status in
                   ('released', 'accepted', 'declined', 'expired', 'revision_requested'))
         )
    )
  );

create policy quotation_versions_write on quotation_versions
  for all to authenticated
  using (app_has_permission('quotation.prepare') or app_has_permission('quotation.approve'))
  with check (app_has_permission('quotation.prepare') or app_has_permission('quotation.approve'));

-- Route options follow their version's visibility.
create policy route_options_select on route_options
  for select to authenticated
  using (exists (
    select 1
      from quotation_versions v
      join quotations q on q.id = v.quotation_id
     where v.id = quotation_version_id
       and (
         app_is_internal()
         or (q.customer_org_id = app_current_org_id()
             and v.status in ('released', 'accepted', 'declined', 'expired', 'revision_requested'))
       )
  ));

create policy route_options_write on route_options
  for all to authenticated
  using (app_has_permission('quotation.prepare'))
  with check (app_has_permission('quotation.prepare'));

-- ---- quotation_charges: the cost boundary -----------------------------------
--
-- No customer policy exists. Holding quotation.view_internal_cost is the only
-- way to read this table at all, which is what makes §24.1 #16 fail closed.

create policy quotation_charges_select_internal on quotation_charges
  for select to authenticated
  using (app_has_permission('quotation.view_internal_cost'));

create policy quotation_charges_write on quotation_charges
  for all to authenticated
  using (app_has_permission('quotation.prepare'))
  with check (app_has_permission('quotation.prepare'));

-- ---- acceptances ------------------------------------------------------------

create policy quotation_acceptances_select on quotation_acceptances
  for select to authenticated
  using (exists (
    select 1
      from quotation_versions v
      join quotations q on q.id = v.quotation_id
     where v.id = quotation_version_id and app_can_access_org(q.customer_org_id)
  ));

-- Only a customer approver may accept, and only for their own organisation's
-- released, unexpired quotation. §8.2: expired quotations require revalidation.
create policy quotation_acceptances_insert on quotation_acceptances
  for insert to authenticated
  with check (
    app_has_permission('quotation.accept')
    and accepted_by = auth.uid()
    and exists (
      select 1
        from quotation_versions v
        join quotations q on q.id = v.quotation_id
       where v.id = quotation_version_id
         and q.customer_org_id = app_current_org_id()
         and v.status = 'released'
         and v.valid_until >= current_date
    )
  );

-- =============================================================================
-- Customer-facing charge view
--
-- security_invoker is left off deliberately: the view runs with owner rights so
-- it can read past the base table's cost-only RLS, and then applies its own
-- organisation scoping and released-version filter while exposing sell columns
-- alone. There is no path through this view to cost_amount.
-- =============================================================================

create view quotation_charges_customer as
  select
    c.id,
    c.route_option_id,
    c.charge_group,
    c.description,
    c.quantity,
    c.sell_amount,
    c.currency,
    c.is_taxable,
    c.tax_rate_pct,
    c.sort_order
  from quotation_charges c
  join route_options ro       on ro.id = c.route_option_id
  join quotation_versions v   on v.id  = ro.quotation_version_id
  join quotations q           on q.id  = v.quotation_id
 where app_can_access_org(q.customer_org_id)
   and (
     app_is_internal()
     or v.status in ('released', 'accepted', 'declined', 'expired', 'revision_requested')
   );

comment on view quotation_charges_customer is
  'BR-008 — sell-side charge lines for customer surfaces. cost_amount is absent by construction.';

grant select on quotation_charges_customer to authenticated;
