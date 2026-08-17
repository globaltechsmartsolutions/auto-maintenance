import { DemoCustomerProfile } from "@/components/demo/demo-customer-profile";

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;

  return <DemoCustomerProfile customerId={customerId} />;
}
