import type { Metadata } from "next";
import { Check, Info } from "lucide-react";
import { PageBody, PageHeader, Panel, buttonStyles } from "@/components/ui/layout";
import {
  Definition,
  DefinitionList,
  Money,
  Ref,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Value,
} from "@/components/ui/data";
import { getSession } from "@/lib/portal/session";
import { getCompanyProfile } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Company Profile" };

const roleLabels: Record<string, string> = {
  customer_requestor: "Requestor",
  customer_approver: "Approver",
  customer_finance: "Finance",
};

const roleDescriptions: Record<string, string> = {
  customer_requestor: "Creates and submits shipping orders",
  customer_approver: "Creates orders and accepts quotations",
  customer_finance: "Views invoices and submits payment evidence",
};

export default async function ProfilePage() {
  const session = await getSession();
  const company = await getCompanyProfile();

  return (
    <>
      <PageHeader
        title="Company Profile"
        description="Your organisation's details as Speedmax holds them, the addresses we ship to, and who is authorised to act."
        actions={
          <button type="button" className={buttonStyles.secondary}>
            Request a change
          </button>
        }
      />

      <PageBody>
        <div className="space-y-6">
          <Panel title="Organisation">
            <DefinitionList columns={3}>
              <Definition label="Legal name">{company.legalName}</Definition>
              <Definition label="Trading name">
                <Value>{company.tradingName}</Value>
              </Definition>
              <Definition label="Country">{company.countryCode}</Definition>
              <Definition label="Registration number">
                {company.registrationNo ? (
                  <Ref>{company.registrationNo}</Ref>
                ) : (
                  <Value>{null}</Value>
                )}
              </Definition>
              <Definition label="Tax identification">
                {company.taxId ? <Ref>{company.taxId}</Ref> : <Value>{null}</Value>}
              </Definition>
              <Definition label="Website">
                <Value>{company.website}</Value>
              </Definition>
              <Definition label="Payment terms">
                <Value>{company.paymentTerms}</Value>
              </Definition>
              <Definition label="Credit limit">
                <Money
                  amount={company.creditLimit}
                  currency={company.creditCurrency ?? session.currency}
                />
              </Definition>
            </DefinitionList>
          </Panel>

          <Panel
            title="Addresses"
            description="Used for pickup, delivery and billing on your orders."
            padded={false}
          >
            <Table>
              <THead>
                <TH>Label</TH>
                <TH>Address</TH>
                <TH>City</TH>
                <TH>Postal code</TH>
                <TH align="center">Pickup</TH>
                <TH align="center">Delivery</TH>
                <TH align="center">Billing</TH>
              </THead>
              <TBody>
                {company.addresses.map((address) => (
                  <TR key={address.id}>
                    <TD className="font-medium text-slate-900">
                      {address.label}
                    </TD>
                    <TD>
                      {address.line1}
                      {address.line2 && (
                        <>
                          <br />
                          {address.line2}
                        </>
                      )}
                    </TD>
                    <TD>
                      {address.city}
                      {address.stateRegion && `, ${address.stateRegion}`}
                    </TD>
                    <TD>
                      <Value>{address.postalCode}</Value>
                    </TD>
                    <TD align="center">
                      <UseFlag on={address.isPickup} label="Pickup address" />
                    </TD>
                    <TD align="center">
                      <UseFlag on={address.isDelivery} label="Delivery address" />
                    </TD>
                    <TD align="center">
                      <UseFlag on={address.isBilling} label="Billing address" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Panel>

          <Panel
            title="Authorised users"
            description="Who may act on your company's behalf, and what each of them can do."
            padded={false}
          >
            <Table>
              <THead>
                <TH>Name</TH>
                <TH>Job title</TH>
                <TH>Email</TH>
                <TH>Phone</TH>
                <TH>Role</TH>
                <TH>Status</TH>
              </THead>
              <TBody>
                {company.contacts.map((contact) => (
                  <TR key={contact.id}>
                    <TD>
                      <span className="font-medium text-slate-900">
                        {contact.fullName}
                      </span>
                      {contact.email === session.email && (
                        <span className="ml-2 rounded-sm bg-ice-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                          You
                        </span>
                      )}
                    </TD>
                    <TD>
                      <Value>{contact.jobTitle}</Value>
                    </TD>
                    <TD className="break-all">{contact.email}</TD>
                    <TD>
                      <Value>{contact.phone}</Value>
                    </TD>
                    <TD>
                      <span className="font-medium text-slate-800">
                        {roleLabels[contact.role] ?? contact.role}
                      </span>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {roleDescriptions[contact.role]}
                      </p>
                    </TD>
                    <TD>
                      <span
                        className={
                          contact.isActive
                            ? "text-tone-success-fg"
                            : "text-slate-400"
                        }
                      >
                        {contact.isActive ? "Active" : "Inactive"}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Panel>

          <div className="flex gap-3 rounded-sm border border-tone-info-br bg-tone-info-bg p-4">
            <Info
              className="mt-0.5 size-5 shrink-0 text-tone-info-fg"
              aria-hidden="true"
            />
            <p className="text-sm text-tone-info-fg">
              Company details, addresses and user access are maintained by
              Speedmax so that billing and compliance records stay consistent.
              Request a change and your account manager will action it — changes
              to who can accept quotations or submit payments are treated as
              access changes and are logged.
            </p>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function UseFlag({ on, label }: { on: boolean; label: string }) {
  return on ? (
    <>
      <Check
        className="mx-auto size-4 text-tone-success-fg"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </>
  ) : (
    <span className="text-slate-300" aria-hidden="true">
      —
    </span>
  );
}
