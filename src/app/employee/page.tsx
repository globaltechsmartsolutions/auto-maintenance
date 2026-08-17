import { EmployeeClock } from "@/components/control/employee-clock";
import { WiaControlProvider } from "@/components/control/wia-control-provider";
import { DemoProvider } from "@/components/demo/demo-provider";

export default function EmployeePage() {
  return (
    <DemoProvider>
      <WiaControlProvider>
        <EmployeeClock />
      </WiaControlProvider>
    </DemoProvider>
  );
}
