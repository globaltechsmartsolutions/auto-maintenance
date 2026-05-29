import { NextResponse } from "next/server";
import { automations } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({
    reminders: automations.filter((automation) =>
      ["SERVICE_REMINDER", "SERVICE_CONFIRMATION", "REVIEW_REQUEST"].includes(
        automation.trigger
      )
    ),
  });
}
