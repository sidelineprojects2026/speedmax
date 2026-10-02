import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/ui/layout";
import { NewOrderForm } from "./NewOrderForm";

export const metadata: Metadata = { title: "New Shipping Order" };

export default function NewOrderPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Shipping Orders", href: "/portal/orders" },
          { label: "New" },
        ]}
        title="New Shipping Order"
        description="Tell us what needs to move, from where, by when. You can save a draft and finish later."
      />
      <PageBody>
        <div className="max-w-5xl">
          <NewOrderForm />
        </div>
      </PageBody>
    </>
  );
}
