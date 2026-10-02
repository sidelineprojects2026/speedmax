import type { Metadata } from "next";
import { PageBody, PageHeader, Panel } from "@/components/ui/layout";
import {
  DateText,
  Money,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Value,
} from "@/components/ui/data";
import { getFinanceSession } from "@/lib/finance/session";
import { listCustomerAccounts } from "@/lib/finance/queries";

export const metadata: Metadata = { title: "Customer Accounts" };

export default async function AccountsPage() {
  const session = await getFinanceSession();
  const accounts = await listCustomerAccounts();

  return (
    <>
      <PageHeader
        title="Customer Accounts"
        description="Balance, credit position and aging by customer. Statements of account are generated from this."
      />

      <PageBody>
        <div className="space-y-6">
          {accounts.map((account) => (
            <Panel
              key={account.id}
              title={
                <span className="text-base font-semibold tracking-normal normal-case text-slate-900">
                  {account.name}
                </span>
              }
              description={`${account.paymentTerms} · ${account.currency}`}
              actions={
                <button
                  type="button"
                  className="text-sm font-medium text-steel-600 hover:text-navy-900"
                >
                  Statement of account
                </button>
              }
              padded={false}
            >
              <div className="grid gap-5 border-b border-slate-200 p-5 sm:grid-cols-4">
                <Metric label="Balance">
                  <Money
                    amount={account.balance}
                    currency={account.currency}
                    emphasis
                  />
                </Metric>
                <Metric label="Credit limit">
                  <Money
                    amount={account.creditLimit}
                    currency={account.currency}
                  />
                </Metric>
                <Metric label="Credit used">
                  {account.creditUsedPct === null ? (
                    <span className="text-slate-400">No limit set</span>
                  ) : (
                    <span className="tnum">
                      {account.creditUsedPct.toFixed(1)}%
                    </span>
                  )}
                </Metric>
                <Metric label="Oldest due">
                  {account.oldestDueDate ? (
                    <DateText
                      value={account.oldestDueDate}
                      timeZone={session.timezone}
                    />
                  ) : (
                    <Value>{null}</Value>
                  )}
                </Metric>
              </div>

              {/* Credit utilisation bar. §28 D-04 leaves credit policy open, so
                  this reports the position rather than enforcing a rule. */}
              {account.creditUsedPct !== null && (
                <div className="px-5 pt-5">
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-slate-150"
                    role="img"
                    aria-label={`${account.creditUsedPct.toFixed(1)} percent of credit limit used`}
                  >
                    <div
                      className={`h-full rounded-full ${
                        account.creditUsedPct > 85
                          ? "bg-tone-danger-fg"
                          : account.creditUsedPct > 60
                            ? "bg-tone-warning-fg"
                            : "bg-steel-500"
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(2, account.creditUsedPct))}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <Table>
                <THead>
                  <TH>Current</TH>
                  <TH>1–30 days</TH>
                  <TH>31–60 days</TH>
                  <TH>61–90 days</TH>
                  <TH>Over 90 days</TH>
                  <TH align="right">Open invoices</TH>
                </THead>
                <TBody>
                  <TR>
                    <TD><Money amount={account.current} currency={account.currency} /></TD>
                    <TD>
                      <Money
                        amount={account.days1to30}
                        currency={account.currency}
                        className={Number(account.days1to30) > 0 ? "text-tone-warning-fg" : ""}
                      />
                    </TD>
                    <TD>
                      <Money
                        amount={account.days31to60}
                        currency={account.currency}
                        className={Number(account.days31to60) > 0 ? "text-tone-danger-fg" : ""}
                      />
                    </TD>
                    <TD>
                      <Money
                        amount={account.days61to90}
                        currency={account.currency}
                        className={Number(account.days61to90) > 0 ? "text-tone-danger-fg" : ""}
                      />
                    </TD>
                    <TD>
                      <Money
                        amount={account.over90}
                        currency={account.currency}
                        className={Number(account.over90) > 0 ? "text-tone-danger-fg" : ""}
                      />
                    </TD>
                    <TD align="right" className="tnum">
                      {account.openInvoiceCount}
                    </TD>
                  </TR>
                </TBody>
              </Table>
            </Panel>
          ))}
        </div>
      </PageBody>
    </>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium tracking-[0.06em] text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-lg text-slate-900">{children}</p>
    </div>
  );
}
