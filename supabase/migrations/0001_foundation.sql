-- =============================================================================
-- Speedmax International Shipping Logistics — 0001 Foundation
--
-- Extensions, enums, and the security helper functions every later migration
-- and every RLS policy depends on.
--
-- Posture: deny-by-default (§17.1). Enabling RLS with no policy denies all
-- access, so each table opts in explicitly. There are no `using (true)`
-- policies anywhere in this schema — Speedmax is multi-tenant with external
-- customer logins, so the permissive posture used by single-tenant internal
-- tools is not available to us.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- §3 stakeholders / §14 party domain
create type org_type as enum (
  'speedmax', 'customer', 'supplier', 'agent', 'carrier', 'broker', 'warehouse', 'transporter'
);

-- §13 roles and segregation of duties
create type user_role as enum (
  'customer_requestor',
  'customer_approver',
  'customer_finance',
  'ops_coordinator',
  'pricing_officer',
  'finance_officer',
  'admin'
);

-- §7.3 Shipping Order lifecycle
create type shipping_order_status as enum (
  'draft', 'submitted', 'information_required', 'accepted_for_quotation',
  'on_hold', 'rejected', 'cancelled', 'converted'
);

-- §21 Quotation lifecycle
create type quotation_status as enum (
  'draft', 'internal_approval', 'released', 'accepted',
  'revision_requested', 'declined', 'expired', 'cancelled'
);

-- §21 Booking lifecycle
create type booking_status as enum (
  'awaiting_conditions', 'requested', 'confirmed', 'failed',
  'rebooking_required', 'completed', 'cancelled'
);

-- §21 Shipment lifecycle
create type shipment_status as enum (
  'planned', 'booked', 'origin_processing', 'in_transit',
  'destination_processing', 'out_for_delivery', 'delivery_failed',
  'delivered', 'closed', 'cancelled'
);

-- §21 / §10.1 Invoice
create type invoice_status as enum (
  'draft', 'for_approval', 'issued', 'partially_paid', 'paid',
  'overdue', 'disputed', 'closed', 'reversed'
);

create type invoice_type as enum (
  'proforma', 'invoice', 'debit_note', 'credit_note'
);

-- §21 / §10.2 Vendor bill
create type vendor_bill_status as enum (
  'draft', 'verified', 'approved', 'partially_paid', 'paid', 'closed', 'reversed'
);

-- §10.1 Payments — verification separated from preparation (§13)
create type payment_status as enum ('submitted', 'verified', 'rejected', 'reversed');

create type payment_method as enum (
  'bank_transfer', 'cheque', 'cash', 'card', 'online_gateway', 'offset', 'other'
);

-- §21 / §12.1 Exceptions
create type exception_status as enum (
  'open', 'assigned', 'investigating', 'action_required', 'resolved', 'closed', 'reopened'
);

create type exception_type as enum (
  'cargo', 'schedule', 'documentation', 'customs', 'commercial', 'delivery', 'system'
);

create type severity_level as enum ('low', 'medium', 'high', 'critical');

-- §12.2 Claims
create type claim_status as enum (
  'draft', 'submitted', 'under_review', 'additional_info_required',
  'negotiation', 'approved', 'rejected', 'settled', 'closed'
);

-- §21 / §11.2 Documents
create type document_status as enum (
  'uploaded', 'under_review', 'verified', 'rejected', 'expired', 'superseded'
);

-- §11.1 Document categories
create type document_category as enum (
  'commercial', 'transport', 'customs', 'cargo', 'finance', 'delivery', 'claim'
);

-- §9.1 Transport modes
create type transport_mode as enum (
  'air', 'sea', 'road', 'rail', 'courier', 'warehouse_transfer', 'other'
);

-- §9.1 / §9.4 Visibility — explicit, never inferred from status
create type visibility_level as enum ('customer', 'internal', 'restricted');

-- §9.4 Event provenance
create type event_source as enum (
  'manual', 'partner', 'carrier_api', 'gps_iot', 'email_ingestion', 'batch_import'
);

-- §8.1 Charge groups
create type charge_group as enum (
  'origin', 'main_carriage', 'destination', 'protection', 'speedmax', 'adjustments'
);

-- §10.4 Allocation methods
create type allocation_method as enum (
  'direct', 'quantity', 'weight', 'volume', 'value', 'equal', 'manual'
);

-- §13 / BR-013 Assignment roles
create type assignment_role as enum (
  'origin_agent', 'destination_agent', 'carrier', 'broker',
  'transporter', 'warehouse', 'coordinator'
);

-- §11.3 Customs
create type customs_scope as enum ('export', 'import', 'transit');

create type customs_status as enum (
  'preparing', 'submitted', 'query', 'examination', 'hold', 'assessed', 'paid', 'released'
);

-- §9.2 Milestone grouping
create type milestone_phase as enum ('origin', 'transit', 'destination', 'delivery');

-- §22 Notification channels
create type notification_channel as enum ('in_app', 'email', 'sms');

-- §7.1 Service priority
create type service_priority as enum ('standard', 'express', 'urgent');

-- -----------------------------------------------------------------------------
-- Control-number sequences (§14.2 — human-readable numbers separate from PKs)
--
-- Security helper functions live in 0002, after the identity tables they read.
-- A `language sql` body is parsed and validated when the function is created,
-- so they cannot be declared ahead of `profiles` and `organizations`.
-- -----------------------------------------------------------------------------

create sequence shipping_order_seq start 1000;
create sequence quotation_seq      start 1000;
create sequence shipment_seq       start 1000;
create sequence booking_seq        start 1000;
create sequence invoice_seq        start 1000;
create sequence payment_seq        start 1000;
create sequence vendor_bill_seq    start 1000;
create sequence exception_seq      start 1000;
create sequence claim_seq          start 1000;
create sequence customs_case_seq   start 1000;

-- Format a control number as PREFIX-YYYY-NNNNNN.
create or replace function app_control_number(prefix text, seq_name text)
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  n bigint;
begin
  execute format('select nextval(%L)', seq_name) into n;
  return prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
end;
$$;

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create or replace function app_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
