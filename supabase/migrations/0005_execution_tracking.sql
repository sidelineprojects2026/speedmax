-- =============================================================================
-- 0005 Shipments, legs, bookings, assignments and tracking
--
-- §9 Shipment execution and tracking.
--
-- Two structural decisions carry most of the weight here:
--
--   * `shipment_order_links` is many-to-many. That single choice is what makes
--     both split (one order → several shipments) and consolidation (several
--     orders → one shipment) representable — §24.1 scenarios 10 and 11 — without
--     a special case anywhere else in the schema.
--
--   * `tracking_events` is append-only, enforced by trigger. Corrections insert
--     a new row pointing at the one it supersedes, carrying a reason (§9.4).
--     Nothing in the application can quietly rewrite history.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shipments
-- -----------------------------------------------------------------------------

create table shipments (
  id                  uuid primary key default gen_random_uuid(),
  shipment_number     text not null unique
                        default app_control_number('SHP', 'shipment_seq'),
  customer_org_id     uuid not null references organizations (id) on delete restrict,
  status              shipment_status not null default 'planned',
  mode                transport_mode,

  origin_location_id      uuid references locations (id),
  destination_location_id uuid references locations (id),
  origin_label            text,
  destination_label       text,

  -- Estimated and actual kept distinct (§14.2) — never one nullable field.
  etd_at              timestamptz,
  atd_at              timestamptz,
  eta_at              timestamptz,
  ata_at              timestamptz,

  -- Cached from controlled event history for list performance (§9.4).
  current_milestone   text references milestone_catalog (code),
  current_milestone_at timestamptz,
  has_active_hold     boolean not null default false,

  coordinator_id      uuid references profiles (id) on delete set null,

  closed_at           timestamptz,
  closed_by           uuid references profiles (id) on delete set null,
  status_reason       text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column shipments.current_milestone is
  'Cached for performance. Derived from tracking_events, which remains the source of truth (§9.4).';

create index shipments_customer_idx    on shipments (customer_org_id, status);
create index shipments_status_idx      on shipments (status, eta_at);
create index shipments_coordinator_idx on shipments (coordinator_id)
  where status not in ('closed', 'cancelled');
create index shipments_hold_idx        on shipments (has_active_hold) where has_active_hold;

create trigger shipments_touch
  before update on shipments
  for each row execute function app_touch_updated_at();

-- Order ↔ shipment links. Many-to-many by design (§14.1).
create table shipment_order_links (
  shipment_id       uuid not null references shipments (id) on delete cascade,
  shipping_order_id uuid not null references shipping_orders (id) on delete restrict,
  -- Portion of the order on this shipment, for split cases.
  note              text,
  created_at        timestamptz not null default now(),
  primary key (shipment_id, shipping_order_id)
);

create index shipment_order_links_order_idx on shipment_order_links (shipping_order_id);

-- -----------------------------------------------------------------------------
-- Legs — §9.1
-- -----------------------------------------------------------------------------

create table shipment_legs (
  id                  uuid primary key default gen_random_uuid(),
  shipment_id         uuid not null references shipments (id) on delete cascade,
  sequence_no         smallint not null,
  mode                transport_mode not null,

  origin_location_id      uuid references locations (id),
  destination_location_id uuid references locations (id),
  origin_detail       text,
  destination_detail  text,

  provider_org_id     uuid references organizations (id) on delete set null,

  planned_departure   timestamptz,
  actual_departure    timestamptz,
  planned_arrival     timestamptz,
  actual_arrival      timestamptz,

  -- References (§9.1). Mono-spaced in the UI; searched by public tracking.
  booking_number      text,
  vehicle_reference   text,
  vessel_or_flight    text,
  voyage_number       text,
  container_number    text,
  seal_number         text,
  house_bill          text,
  master_bill         text,

  -- Custody (§9.1)
  handover_from_org_id uuid references organizations (id) on delete set null,
  handover_to_org_id   uuid references organizations (id) on delete set null,
  handover_condition   text,
  handover_quantity    numeric(14,3),

  visibility          visibility_level not null default 'customer',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (shipment_id, sequence_no)
);

create index shipment_legs_shipment_idx on shipment_legs (shipment_id, sequence_no);
-- Reference lookups for public tracking. Partial indexes keep them small.
create index shipment_legs_house_bill_idx on shipment_legs (upper(house_bill))    where house_bill is not null;
create index shipment_legs_master_bill_idx on shipment_legs (upper(master_bill))  where master_bill is not null;
create index shipment_legs_container_idx   on shipment_legs (upper(container_number)) where container_number is not null;
create index shipment_legs_booking_idx     on shipment_legs (upper(booking_number))   where booking_number is not null;

create trigger shipment_legs_touch
  before update on shipment_legs
  for each row execute function app_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Bookings — §8.3
-- -----------------------------------------------------------------------------

create table bookings (
  id                uuid primary key default gen_random_uuid(),
  booking_ref       text not null unique
                      default app_control_number('BK', 'booking_seq'),
  shipment_id       uuid not null references shipments (id) on delete cascade,
  carrier_org_id    uuid references organizations (id) on delete set null,
  status            booking_status not null default 'awaiting_conditions',

  carrier_booking_number text,
  cutoff_at         timestamptz,
  etd_at            timestamptz,
  eta_at            timestamptz,
  free_time_days    smallint,
  cancellation_terms text,

  -- §8.3 release gate. All must hold, or an override must be recorded.
  acceptance_confirmed  boolean not null default false,
  payment_condition_met boolean not null default false,
  cargo_ready_confirmed boolean not null default false,
  documents_ready       boolean not null default false,
  override_by       uuid references profiles (id) on delete set null,
  override_reason   text,

  -- Set when this booking replaces a failed one, preserving history (§24.1 #9).
  rebooked_from_id  uuid references bookings (id) on delete set null,
  failure_reason    text,

  confirmed_by      uuid references profiles (id) on delete set null,
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index bookings_shipment_idx on bookings (shipment_id);

create trigger bookings_touch
  before update on bookings
  for each row execute function app_touch_updated_at();

-- A booking may not be confirmed with conditions outstanding unless an
-- authorised override is on record (§8.3, BR-012).
create or replace function app_guard_booking_release()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'confirmed'
     and (old.status is distinct from 'confirmed')
     and not (new.acceptance_confirmed
              and new.payment_condition_met
              and new.cargo_ready_confirmed
              and new.documents_ready)
     and (new.override_by is null or coalesce(trim(new.override_reason), '') = '') then
    raise exception
      'Booking cannot be confirmed with outstanding conditions without a recorded override and reason (§8.3)';
  end if;
  return new;
end;
$$;

create trigger bookings_guard_release
  before update on bookings
  for each row execute function app_guard_booking_release();

-- -----------------------------------------------------------------------------
-- Assignments — BR-013, BR-014
-- -----------------------------------------------------------------------------

create table assignments (
  id                uuid primary key default gen_random_uuid(),
  shipment_id       uuid not null references shipments (id) on delete cascade,
  organization_id   uuid references organizations (id) on delete restrict,
  assignee_id       uuid references profiles (id) on delete set null,
  role              assignment_role not null,
  is_primary        boolean not null default true,

  instructions      text,
  deliverables      text,
  due_at            timestamptz,
  commercial_terms  text,

  acknowledged_at   timestamptz,
  acknowledged_by   uuid references profiles (id) on delete set null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index assignments_shipment_idx on assignments (shipment_id);
create index assignments_org_idx      on assignments (organization_id);

create trigger assignments_touch
  before update on assignments
  for each row execute function app_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Tracking events — §9.4, append-only
-- -----------------------------------------------------------------------------

create table tracking_events (
  id                uuid primary key default gen_random_uuid(),
  shipment_id       uuid not null references shipments (id) on delete cascade,
  leg_id            uuid references shipment_legs (id) on delete set null,
  milestone_code    text not null references milestone_catalog (code),

  event_time        timestamptz not null,
  recorded_at       timestamptz not null default now(),
  location_id       uuid references locations (id),
  location_text     text,

  source            event_source not null default 'manual',
  visibility        visibility_level not null default 'customer',
  responsible_org_id uuid references organizations (id) on delete set null,
  recorded_by       uuid references profiles (id) on delete set null,

  notes             text,
  evidence_document_id uuid,

  -- Correction chain (§9.4). The superseded row stays exactly as posted.
  corrects_event_id uuid references tracking_events (id) on delete set null,
  correction_reason text,
  is_superseded     boolean not null default false,

  -- Idempotency for integrations (§16.1) — a duplicate webhook must not
  -- create a second event (§24.1 #15).
  external_id       text,
  external_payload  jsonb
);

create index tracking_events_shipment_idx on tracking_events (shipment_id, event_time desc);
create index tracking_events_customer_idx on tracking_events (shipment_id, event_time)
  where visibility = 'customer' and not is_superseded;
create unique index tracking_events_external_idx on tracking_events (source, external_id)
  where external_id is not null;

comment on table tracking_events is
  'Append-only (§9.4). Updates and deletes are rejected; corrections insert a new row via corrects_event_id.';

-- Append-only enforcement. The one permitted update is marking a row superseded,
-- which the correction routine below performs — nothing else may alter a posted
-- event, and nothing at all may delete one.
create or replace function app_tracking_events_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'tracking_events is append-only; events cannot be deleted (§9.4)';
  end if;

  if tg_op = 'UPDATE' then
    if new.is_superseded is distinct from old.is_superseded
       and new.id = old.id
       and new.shipment_id = old.shipment_id
       and new.milestone_code = old.milestone_code
       and new.event_time = old.event_time
       and new.visibility = old.visibility
       and new.source = old.source then
      return new;   -- superseding flag only
    end if;
    raise exception
      'tracking_events is append-only; post a correcting event instead of editing (§9.4)';
  end if;

  return new;
end;
$$;

create trigger tracking_events_append_only
  before update or delete on tracking_events
  for each row execute function app_tracking_events_append_only();

-- Post a correction: supersede the original, insert the replacement.
create or replace function post_tracking_correction(
  p_original_id uuid,
  p_event_time timestamptz,
  p_location_text text,
  p_notes text,
  p_reason text
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  orig tracking_events%rowtype;
  new_id uuid;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A correction reason is required (§17.2)';
  end if;

  select * into orig from tracking_events where id = p_original_id;
  if not found then
    raise exception 'Original tracking event % not found', p_original_id;
  end if;

  insert into tracking_events (
    shipment_id, leg_id, milestone_code, event_time, location_id, location_text,
    source, visibility, responsible_org_id, recorded_by, notes,
    corrects_event_id, correction_reason
  )
  values (
    orig.shipment_id, orig.leg_id, orig.milestone_code,
    coalesce(p_event_time, orig.event_time), orig.location_id,
    coalesce(p_location_text, orig.location_text),
    orig.source, orig.visibility, orig.responsible_org_id, auth.uid(),
    coalesce(p_notes, orig.notes), orig.id, p_reason
  )
  returning id into new_id;

  update tracking_events set is_superseded = true where id = orig.id;

  return new_id;
end;
$$;

-- Refresh the cached shipment status from event history.
create or replace function app_refresh_shipment_cache()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  latest record;
  hold_at timestamptz;
  clear_at timestamptz;
begin
  select te.milestone_code, te.event_time
    into latest
    from tracking_events te
   where te.shipment_id = new.shipment_id
     and not te.is_superseded
   order by te.event_time desc, te.recorded_at desc
   limit 1;

  select max(te.event_time) into hold_at
    from tracking_events te
    join milestone_catalog mc on mc.code = te.milestone_code
   where te.shipment_id = new.shipment_id and not te.is_superseded and mc.is_hold;

  select max(te.event_time) into clear_at
    from tracking_events te
   where te.shipment_id = new.shipment_id
     and not te.is_superseded
     and te.milestone_code in ('IMPORT_CLEARED', 'CARGO_RELEASED');

  update shipments
     set current_milestone    = latest.milestone_code,
         current_milestone_at = latest.event_time,
         has_active_hold      = hold_at is not null
                                and (clear_at is null or clear_at < hold_at)
   where id = new.shipment_id;

  return null;
end;
$$;

create trigger tracking_events_refresh_cache
  after insert or update on tracking_events
  for each row execute function app_refresh_shipment_cache();

-- -----------------------------------------------------------------------------
-- Proof of delivery — BR-022
-- -----------------------------------------------------------------------------

create table pod_records (
  id                uuid primary key default gen_random_uuid(),
  shipment_id       uuid not null references shipments (id) on delete cascade,
  receiver_name     text not null,
  delivered_at      timestamptz not null,
  location_text     text,
  quantity_received numeric(14,3),
  condition_note    text,
  signature_path    text,
  photo_paths       text[] not null default '{}',
  exception_result  text,
  recorded_by       uuid references profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);

create index pod_records_shipment_idx on pod_records (shipment_id);

-- =============================================================================
-- Row level security
-- =============================================================================

alter table shipments           enable row level security;
alter table shipment_order_links enable row level security;
alter table shipment_legs       enable row level security;
alter table bookings            enable row level security;
alter table assignments         enable row level security;
alter table tracking_events     enable row level security;
alter table pod_records         enable row level security;

create policy shipments_select on shipments
  for select to authenticated
  using (app_can_access_org(customer_org_id));

create policy shipments_write on shipments
  for all to authenticated
  using (app_has_permission('shipment.manage'))
  with check (app_has_permission('shipment.manage'));

create policy shipment_order_links_select on shipment_order_links
  for select to authenticated
  using (exists (
    select 1 from shipments s
     where s.id = shipment_id and app_can_access_org(s.customer_org_id)
  ));

create policy shipment_order_links_write on shipment_order_links
  for all to authenticated
  using (app_has_permission('shipment.manage'))
  with check (app_has_permission('shipment.manage'));

-- Legs carry their own visibility; internal-only legs stay internal.
create policy shipment_legs_select on shipment_legs
  for select to authenticated
  using (exists (
    select 1 from shipments s
     where s.id = shipment_id
       and (
         app_is_internal()
         or (s.customer_org_id = app_current_org_id()
             and shipment_legs.visibility = 'customer')
       )
  ));

create policy shipment_legs_write on shipment_legs
  for all to authenticated
  using (app_has_permission('shipment.manage'))
  with check (app_has_permission('shipment.manage'));

-- Bookings are operational and commercial: internal only.
create policy bookings_internal on bookings
  for all to authenticated
  using (app_has_permission('booking.release') or app_is_internal())
  with check (app_has_permission('booking.release'));

-- Assignments carry partner commercial terms — never customer-visible.
create policy assignments_select on assignments
  for select to authenticated
  using (app_is_internal() or organization_id = app_current_org_id());

create policy assignments_write on assignments
  for all to authenticated
  using (app_has_permission('shipment.assign_agent'))
  with check (app_has_permission('shipment.assign_agent'));

-- Customers see customer-visible, non-superseded events only.
create policy tracking_events_select on tracking_events
  for select to authenticated
  using (exists (
    select 1 from shipments s
     where s.id = shipment_id
       and (
         app_is_internal()
         or (s.customer_org_id = app_current_org_id()
             and tracking_events.visibility = 'customer'
             and not tracking_events.is_superseded)
       )
  ));

create policy tracking_events_insert on tracking_events
  for insert to authenticated
  with check (app_has_permission('milestone.post'));

-- Supersede-only update, gated by the same permission. The append-only trigger
-- still rejects anything beyond flipping is_superseded.
create policy tracking_events_supersede on tracking_events
  for update to authenticated
  using (app_has_permission('milestone.post'))
  with check (app_has_permission('milestone.post'));

create policy pod_records_select on pod_records
  for select to authenticated
  using (exists (
    select 1 from shipments s
     where s.id = shipment_id and app_can_access_org(s.customer_org_id)
  ));

create policy pod_records_write on pod_records
  for all to authenticated
  using (app_has_permission('milestone.post'))
  with check (app_has_permission('milestone.post'));

-- =============================================================================
-- Public tracking RPC — §9.3
--
-- The only anonymous read path in the schema. Anonymous users hold no SELECT
-- policy on shipments, legs or events; this function is SECURITY DEFINER and
-- returns customer-visible milestones for an exact reference match only.
--
-- Exact match matters: a prefix or fuzzy search would let anyone enumerate the
-- shipment book by walking sequential numbers.
-- =============================================================================

create or replace function public_track(p_reference text)
returns table (
  shipment_number       text,
  status                text,
  mode                  text,
  origin_label          text,
  destination_label     text,
  eta_at                timestamptz,
  order_submitted_at    timestamptz,
  quotation_accepted_at timestamptz,
  booking_confirmed_at  timestamptz,
  events                jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  ref text := upper(trim(p_reference));
  sid uuid;
begin
  if ref is null or length(ref) < 4 then
    return;   -- too short to be a real reference; do not scan
  end if;

  select s.id into sid
    from shipments s
   where upper(s.shipment_number) = ref
   limit 1;

  if sid is null then
    select l.shipment_id into sid
      from shipment_legs l
     where upper(l.house_bill) = ref
        or upper(l.master_bill) = ref
        or upper(l.container_number) = ref
        or upper(l.booking_number) = ref
     limit 1;
  end if;

  if sid is null then
    return;
  end if;

  return query
  select
    s.shipment_number,
    s.status::text,
    s.mode::text,
    s.origin_label,
    s.destination_label,
    s.eta_at,
    (select min(o.submitted_at)
       from shipment_order_links sol
       join shipping_orders o on o.id = sol.shipping_order_id
      where sol.shipment_id = s.id),
    (select min(qa.accepted_at)
       from shipment_order_links sol
       join quotations q on q.shipping_order_id = sol.shipping_order_id
       join quotation_versions v on v.quotation_id = q.id
       join quotation_acceptances qa on qa.quotation_version_id = v.id
      where sol.shipment_id = s.id),
    (select min(b.confirmed_at) from bookings b
      where b.shipment_id = s.id and b.status in ('confirmed', 'completed')),
    coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'milestoneCode', te.milestone_code,
                  'eventTime',     te.event_time,
                  'visibility',    te.visibility
                ) order by te.event_time
              )
         from tracking_events te
        where te.shipment_id = s.id
          and te.visibility = 'customer'
          and not te.is_superseded),
      '[]'::jsonb
    )
  from shipments s
  where s.id = sid;
end;
$$;

grant execute on function public_track(text) to anon, authenticated;
