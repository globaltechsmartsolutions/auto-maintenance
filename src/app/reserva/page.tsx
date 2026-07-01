import { CustomerBookingDemo } from "@/components/demo/customer-booking-demo";
import { DemoProvider } from "@/components/demo/demo-provider";

export default function ReservaPage() {
  return (
    <DemoProvider>
      <CustomerBookingDemo />
    </DemoProvider>
  );
}
