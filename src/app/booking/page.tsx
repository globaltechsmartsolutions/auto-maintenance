import { CustomerBookingDemo } from "@/components/demo/customer-booking-demo";
import { DemoProvider } from "@/components/demo/demo-provider";

export default function BookingPage() {
  return (
    <DemoProvider>
      <CustomerBookingDemo />
    </DemoProvider>
  );
}
