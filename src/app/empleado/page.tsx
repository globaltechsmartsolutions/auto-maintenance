import { EmployeeFieldDemo } from "@/components/demo/employee-field-demo";
import { DemoProvider } from "@/components/demo/demo-provider";

export default function EmpleadoPage() {
  return (
    <DemoProvider>
      <EmployeeFieldDemo />
    </DemoProvider>
  );
}
