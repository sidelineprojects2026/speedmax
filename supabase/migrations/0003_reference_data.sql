-- =============================================================================
-- 0003 Reference data and public enquiries
--
-- Countries, locations, currencies, Incoterms, charge codes, cargo categories,
-- document types and the milestone catalog (BR-035 — all configurable, none
-- hard-coded), plus the public quote-request table the marketing site writes to.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Geography and units
-- -----------------------------------------------------------------------------

create table countries (
  code          char(2) primary key,
  name          text not null,
  iso3          char(3),
  dial_code     text,
  is_active     boolean not null default true
);

create table currencies (
  code          char(3) primary key,
  name          text not null,
  symbol        text,
  -- ISO 4217 exponent. Mirrors lib/domain/money.ts; JPY and KRW are 0, not 2.
  minor_units   smallint not null default 2,
  is_active     boolean not null default true
);

create table locations (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,               -- UN/LOCODE, IATA, or internal
  name          text not null,
  country_code  char(2) not null references countries (code),
  location_type text not null,             -- seaport | airport | inland | rail | warehouse
  timezone      text,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  is_active     boolean not null default true
);

create index locations_country_idx on locations (country_code) where is_active;
create index locations_name_idx    on locations (lower(name));

create table incoterms (
  code          char(3) primary key,
  name          text not null,
  edition       text not null default '2020',
  -- Which side bears main carriage. Drives who we may bill for what.
  seller_pays_main_carriage boolean not null,
  requires_named_place      boolean not null default true,
  is_active     boolean not null default true
);

-- -----------------------------------------------------------------------------
-- Commercial reference
-- -----------------------------------------------------------------------------

create table charge_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  charge_group  charge_group not null,
  description   text,
  is_taxable    boolean not null default true,
  -- Default allocation basis when this charge is spread across shipments (§10.4)
  default_allocation allocation_method not null default 'direct',
  is_active     boolean not null default true
);

create index charge_codes_group_idx on charge_codes (charge_group) where is_active;

create table cargo_categories (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  -- BR-003: categories that must be flagged for review before pricing.
  requires_review boolean not null default false,
  is_hazardous    boolean not null default false,
  is_active     boolean not null default true
);

create table document_types (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  category      document_category not null,
  -- §11.2: expiry tracking only matters for some document types.
  tracks_expiry boolean not null default false,
  default_visibility visibility_level not null default 'internal',
  is_active     boolean not null default true
);

-- -----------------------------------------------------------------------------
-- Milestone catalog (§9.2) — mirrors lib/domain/milestones.ts
--
-- Held in the database as well as in code so reports and RPCs can join against
-- it. lib/domain/milestones.ts remains the authority for UI ordering and for
-- the customer-step mapping; this table must be kept in step with it.
-- -----------------------------------------------------------------------------

create table milestone_catalog (
  code              text primary key,
  seq               smallint not null unique,
  label             text not null,
  phase             milestone_phase not null,
  -- Null means internal detail that never advances the customer timeline.
  customer_step     text,
  default_visibility visibility_level not null,
  is_hold           boolean not null default false,
  is_active         boolean not null default true
);

-- =============================================================================
-- Public quote requests
--
-- Written by the marketing site's quote form. Anonymous INSERT is permitted and
-- SELECT is not: an enquirer may leave a request but must never be able to read
-- anyone else's. This is the only anonymous write in the schema.
-- =============================================================================

create table quote_requests (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique default app_control_number('RQ', 'shipping_order_seq'),
  company           text not null,
  contact_name      text not null,
  email             citext not null,
  phone             text,
  mode              text,
  priority          text,
  incoterm          text,
  origin            text not null,
  destination       text not null,
  cargo_description text not null,
  gross_weight_kg   numeric(14,3),
  volume_cbm        numeric(14,4),
  package_count     integer,
  ready_date        date,
  handling_flags    text[] not null default '{}',
  notes             text,
  -- Triage state for the ops queue.
  is_handled        boolean not null default false,
  handled_by        uuid references profiles (id) on delete set null,
  handled_at        timestamptz,
  -- Set when the enquiry is converted into a real Shipping Order.
  converted_order_id uuid,
  created_at        timestamptz not null default now()
);

create index quote_requests_open_idx on quote_requests (created_at desc) where not is_handled;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table countries         enable row level security;
alter table currencies        enable row level security;
alter table locations         enable row level security;
alter table incoterms         enable row level security;
alter table charge_codes      enable row level security;
alter table cargo_categories  enable row level security;
alter table document_types    enable row level security;
alter table milestone_catalog enable row level security;
alter table quote_requests    enable row level security;

-- Reference data is readable by any authenticated user — it contains no tenant
-- data and every form in the application needs it. Writes are admin-only.
do $$
declare t text;
begin
  foreach t in array array[
    'countries', 'currencies', 'locations', 'incoterms',
    'charge_codes', 'cargo_categories', 'document_types', 'milestone_catalog'
  ]
  loop
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      t || '_select', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (app_has_permission(''admin.manage''))
         with check (app_has_permission(''admin.manage''))',
      t || '_admin', t);
  end loop;
end $$;

-- Anonymous enquiry submission. Insert only, and only for unhandled rows —
-- nothing here lets a caller read back, update, or mark their own enquiry done.
create policy quote_requests_public_insert on quote_requests
  for insert to anon, authenticated
  with check (not is_handled and handled_by is null and converted_order_id is null);

create policy quote_requests_internal_read on quote_requests
  for select to authenticated
  using (app_is_internal());

create policy quote_requests_internal_write on quote_requests
  for update to authenticated
  using (app_has_permission('shipping_order.review'))
  with check (app_has_permission('shipping_order.review'));

-- The insert policy alone would not let the form read back its own reference,
-- so expose exactly that one column through a definer function.
create or replace function submit_quote_request(payload jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  new_reference text;
begin
  insert into quote_requests (
    company, contact_name, email, phone, mode, priority, incoterm,
    origin, destination, cargo_description, gross_weight_kg, volume_cbm,
    package_count, ready_date, handling_flags, notes
  )
  values (
    payload->>'company',
    payload->>'contact_name',
    payload->>'email',
    nullif(payload->>'phone', ''),
    nullif(payload->>'mode', ''),
    nullif(payload->>'priority', ''),
    nullif(payload->>'incoterm', ''),
    payload->>'origin',
    payload->>'destination',
    payload->>'cargo_description',
    (payload->>'gross_weight_kg')::numeric,
    (payload->>'volume_cbm')::numeric,
    (payload->>'package_count')::integer,
    (payload->>'ready_date')::date,
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(payload->'handling_flags')),
      '{}'
    ),
    nullif(payload->>'notes', '')
  )
  returning reference into new_reference;

  return new_reference;
end;
$$;

grant execute on function submit_quote_request(jsonb) to anon, authenticated;

-- =============================================================================
-- Seed — reference data
-- =============================================================================

insert into currencies (code, name, symbol, minor_units) values
  ('USD', 'US Dollar', '$', 2),
  ('EUR', 'Euro', '€', 2),
  ('GBP', 'Pound Sterling', '£', 2),
  ('PHP', 'Philippine Peso', '₱', 2),
  ('CNY', 'Chinese Yuan', '¥', 2),
  ('HKD', 'Hong Kong Dollar', 'HK$', 2),
  ('SGD', 'Singapore Dollar', 'S$', 2),
  ('AUD', 'Australian Dollar', 'A$', 2),
  ('AED', 'UAE Dirham', 'د.إ', 2),
  ('INR', 'Indian Rupee', '₹', 2),
  ('JPY', 'Japanese Yen', '¥', 0),
  ('KRW', 'South Korean Won', '₩', 0);

insert into countries (code, name, iso3) values
  ('PH', 'Philippines', 'PHL'),  ('CN', 'China', 'CHN'),
  ('HK', 'Hong Kong', 'HKG'),    ('TW', 'Taiwan', 'TWN'),
  ('KR', 'South Korea', 'KOR'),  ('JP', 'Japan', 'JPN'),
  ('VN', 'Vietnam', 'VNM'),      ('TH', 'Thailand', 'THA'),
  ('MY', 'Malaysia', 'MYS'),     ('SG', 'Singapore', 'SGP'),
  ('ID', 'Indonesia', 'IDN'),    ('IN', 'India', 'IND'),
  ('BD', 'Bangladesh', 'BGD'),   ('LK', 'Sri Lanka', 'LKA'),
  ('AE', 'United Arab Emirates', 'ARE'), ('SA', 'Saudi Arabia', 'SAU'),
  ('QA', 'Qatar', 'QAT'),        ('OM', 'Oman', 'OMN'),
  ('NL', 'Netherlands', 'NLD'),  ('DE', 'Germany', 'DEU'),
  ('GB', 'United Kingdom', 'GBR'), ('IT', 'Italy', 'ITA'),
  ('ES', 'Spain', 'ESP'),        ('US', 'United States', 'USA'),
  ('CA', 'Canada', 'CAN'),       ('MX', 'Mexico', 'MEX'),
  ('AU', 'Australia', 'AUS'),    ('NZ', 'New Zealand', 'NZL');

-- Incoterms 2020. seller_pays_main_carriage drives which charges we may bill
-- to which party, so it is data rather than a rule buried in code.
insert into incoterms (code, name, seller_pays_main_carriage) values
  ('EXW', 'Ex Works', false),
  ('FCA', 'Free Carrier', false),
  ('FAS', 'Free Alongside Ship', false),
  ('FOB', 'Free On Board', false),
  ('CFR', 'Cost and Freight', true),
  ('CIF', 'Cost, Insurance and Freight', true),
  ('CPT', 'Carriage Paid To', true),
  ('CIP', 'Carriage and Insurance Paid To', true),
  ('DAP', 'Delivered At Place', true),
  ('DPU', 'Delivered At Place Unloaded', true),
  ('DDP', 'Delivered Duty Paid', true);

insert into cargo_categories (code, name, requires_review, is_hazardous) values
  ('GENERAL',     'General cargo',            false, false),
  ('HAZARDOUS',   'Dangerous goods',          true,  true),
  ('TEMPERATURE', 'Temperature controlled',   true,  false),
  ('FRAGILE',     'Fragile',                  false, false),
  ('OVERSIZED',   'Oversized / out of gauge', true,  false),
  ('HIGH_VALUE',  'High value',               true,  false),
  ('CONTROLLED',  'Controlled or licensed',   true,  false),
  ('PERISHABLE',  'Perishable',               true,  false),
  ('LIVE',        'Live animals',             true,  false);

insert into charge_codes (code, name, charge_group, default_allocation) values
  -- Origin
  ('ORG_PICKUP',    'Pickup / collection',        'origin', 'weight'),
  ('ORG_EXPDOC',    'Export documentation',       'origin', 'equal'),
  ('ORG_WHS',       'Origin warehouse',           'origin', 'volume'),
  ('ORG_HANDLING',  'Origin handling',            'origin', 'weight'),
  ('ORG_BROKERAGE', 'Export customs brokerage',   'origin', 'equal'),
  ('ORG_TERMINAL',  'Origin terminal charges',    'origin', 'weight'),
  -- Main carriage
  ('MC_AIR',        'Air freight',                'main_carriage', 'weight'),
  ('MC_OCEAN',      'Ocean freight',              'main_carriage', 'volume'),
  ('MC_ROAD',       'Road freight',               'main_carriage', 'weight'),
  ('MC_RAIL',       'Rail freight',               'main_carriage', 'weight'),
  ('MC_FUEL',       'Fuel surcharge',             'main_carriage', 'weight'),
  ('MC_SECURITY',   'Security surcharge',         'main_carriage', 'weight'),
  ('MC_SURCHARGE',  'Carrier surcharge',          'main_carriage', 'weight'),
  -- Destination
  ('DST_THC',       'Terminal handling',          'destination', 'weight'),
  ('DST_BROKERAGE', 'Import customs brokerage',   'destination', 'equal'),
  ('DST_DUTY',      'Duties and taxes (estimate)','destination', 'value'),
  ('DST_WHS',       'Destination warehouse',      'destination', 'volume'),
  ('DST_DELIVERY',  'Final delivery',             'destination', 'weight'),
  -- Protection
  ('PRT_INSURANCE', 'Cargo insurance',            'protection', 'value'),
  ('PRT_INSPECT',   'Inspection',                 'protection', 'equal'),
  ('PRT_SPECIAL',   'Special handling',           'protection', 'quantity'),
  ('PRT_TEMP',      'Temperature control',        'protection', 'volume'),
  -- Speedmax
  ('SPX_SERVICE',   'Service fee',                'speedmax', 'equal'),
  ('SPX_DOC',       'Documentation fee',          'speedmax', 'equal'),
  ('SPX_COORD',     'Coordination fee',           'speedmax', 'equal'),
  ('SPX_MARKUP',    'Markup',                     'speedmax', 'value'),
  -- Adjustments
  ('ADJ_DISCOUNT',  'Discount',                   'adjustments', 'value'),
  ('ADJ_TAX',       'Tax',                        'adjustments', 'value'),
  ('ADJ_FX',        'Currency adjustment',        'adjustments', 'value'),
  ('ADJ_CONTING',   'Contingency',                'adjustments', 'equal'),
  ('ADJ_ADDITIONAL','Additional charge',          'adjustments', 'manual');

insert into document_types (code, name, category, tracks_expiry, default_visibility) values
  ('PO',          'Purchase order',              'commercial', false, 'customer'),
  ('PROFORMA',    'Pro forma invoice',           'commercial', false, 'customer'),
  ('COMM_INV',    'Commercial invoice',          'commercial', false, 'customer'),
  ('PACKING',     'Packing list',                'commercial', false, 'customer'),
  ('BOOKING_CFM', 'Booking confirmation',        'transport',  false, 'customer'),
  ('PICKUP_RCPT', 'Pickup receipt',              'transport',  false, 'customer'),
  ('WHS_RCPT',    'Warehouse receipt',           'transport',  false, 'internal'),
  ('AWB',         'Air waybill',                 'transport',  false, 'customer'),
  ('BL',          'Bill of lading',              'transport',  false, 'customer'),
  ('WAYBILL',     'Waybill',                     'transport',  false, 'customer'),
  ('DECLARATION', 'Customs declaration',         'customs',    false, 'internal'),
  ('PERMIT',      'Permit',                      'customs',    true,  'internal'),
  ('COO',         'Certificate of origin',       'customs',    true,  'customer'),
  ('LICENCE',     'Import/export licence',       'customs',    true,  'internal'),
  ('ASSESSMENT',  'Customs assessment',          'customs',    false, 'internal'),
  ('RELEASE',     'Customs release',             'customs',    false, 'customer'),
  ('PHOTO',       'Cargo photograph',            'cargo',      false, 'customer'),
  ('SPEC',        'Product specification',       'cargo',      false, 'internal'),
  ('SDS',         'Safety data sheet',           'cargo',      true,  'internal'),
  ('DGD',         'Dangerous goods declaration', 'cargo',      true,  'internal'),
  ('INSPECTION',  'Inspection report',           'cargo',      false, 'customer'),
  ('QUOTATION',   'Quotation',                   'finance',    true,  'customer'),
  ('INVOICE',     'Invoice',                     'finance',    false, 'customer'),
  ('CREDIT_NOTE', 'Credit note',                 'finance',    false, 'customer'),
  ('RECEIPT',     'Receipt',                     'finance',    false, 'customer'),
  ('VENDOR_BILL', 'Vendor bill',                 'finance',    false, 'restricted'),
  ('EXPENSE',     'Expense evidence',            'finance',    false, 'restricted'),
  ('DEL_INSTR',   'Delivery instruction',        'delivery',   false, 'customer'),
  ('DEL_RCPT',    'Delivery receipt',            'delivery',   false, 'customer'),
  ('POD',         'Proof of delivery',           'delivery',   false, 'customer'),
  ('DISCREPANCY', 'Discrepancy report',          'delivery',   false, 'customer'),
  ('CLAIM_NOTICE','Claim notice',                'claim',      false, 'customer'),
  ('SURVEY',      'Survey report',               'claim',      false, 'customer'),
  ('SETTLEMENT',  'Settlement document',         'claim',      false, 'customer');

-- §9.2 milestone catalog. customer_step maps onto the §9.3 ten-step timeline;
-- null means the milestone is internal detail the customer never sees.
insert into milestone_catalog (code, seq, label, phase, customer_step, default_visibility, is_hold) values
  ('SUPPLIER_CONTACTED',            1,  'Supplier Contacted',                'origin',      null,                  'internal', false),
  ('CARGO_READY_CONFIRMED',         2,  'Cargo Ready Confirmed',             'origin',      null,                  'internal', false),
  ('PICKUP_SCHEDULED',              3,  'Pickup Scheduled',                  'origin',      null,                  'customer', false),
  ('CARGO_PICKED_UP',               4,  'Cargo Picked Up',                   'origin',      'cargo_collected',     'customer', false),
  ('RECEIVED_ORIGIN_WAREHOUSE',     5,  'Received at Origin Warehouse',      'origin',      'cargo_collected',     'customer', false),
  ('CARGO_INSPECTED',               6,  'Cargo Inspected',                   'origin',      null,                  'internal', false),
  ('EXPORT_DOCS_COMPLETE',          7,  'Export Documents Complete',         'origin',      null,                  'internal', false),
  ('EXPORT_CLEARANCE_SUBMITTED',    8,  'Export Clearance Submitted',        'origin',      null,                  'internal', false),
  ('EXPORT_CLEARED',                9,  'Export Cleared',                    'origin',      null,                  'customer', false),
  ('DELIVERED_TO_CARRIER',          10, 'Delivered to Carrier',              'origin',      null,                  'internal', false),
  ('LOADED',                        11, 'Loaded',                            'transit',     null,                  'internal', false),
  ('DEPARTED_ORIGIN',               12, 'Departed Origin',                   'transit',     'departed_origin',     'customer', false),
  ('TRANSSHIPMENT_ARRIVED',         13, 'Transshipment Arrived',             'transit',     'in_transit',          'customer', false),
  ('TRANSSHIPMENT_DEPARTED',        14, 'Transshipment Departed',            'transit',     'in_transit',          'customer', false),
  ('ARRIVED_DESTINATION',           15, 'Arrived Destination',               'destination',     'arrived_destination', 'customer', false),
  ('IMPORT_CLEARANCE_SUBMITTED',    16, 'Import Clearance Submitted',        'destination', 'customs_processing',  'customer', false),
  ('CUSTOMS_HOLD',                  17, 'Customs Hold',                      'destination', 'customs_processing',  'customer', true),
  ('DUTIES_ASSESSED',               18, 'Duties Assessed',                   'destination', 'customs_processing',  'customer', false),
  ('IMPORT_CLEARED',                19, 'Import Cleared',                    'destination', 'customs_processing',  'customer', false),
  ('CARGO_RELEASED',                20, 'Cargo Released',                    'destination', 'customs_processing',  'customer', false),
  ('RECEIVED_DESTINATION_WAREHOUSE',21, 'Received at Destination Warehouse', 'destination', null,                  'internal', false),
  ('DELIVERY_SCHEDULED',            22, 'Delivery Scheduled',                'delivery',    null,                  'customer', false),
  ('OUT_FOR_DELIVERY',              23, 'Out for Delivery',                  'delivery',    'out_for_delivery',    'customer', false),
  ('DELIVERED',                     24, 'Delivered',                         'delivery',    'delivered',           'customer', false),
  ('POD_ACCEPTED',                  25, 'POD Accepted',                      'delivery',    'delivered',           'customer', false);
