import { CalendarDays, Link2, Plus } from "lucide-react";
import { MonthOverview } from "@/components/calendar/month-overview";
import { ScheduleBoard } from "@/components/calendar/schedule-board";
import { DemoActionButton } from "@/components/demo/demo-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Team assignment</p>
          <h1 className="mt-1 text-3xl font-semibold">Calendar</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoActionButton action="google-calendar" variant="outline">
            <Link2 className="size-4" />
            Google Calendar
          </DemoActionButton>
          <DemoActionButton action="new-visit">
            <Plus className="size-4" />
            New visit
          </DemoActionButton>
        </div>
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <Tabs defaultValue="week" className="gap-0">
          <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" />
              Calendar operativo
            </CardTitle>
            <TabsList>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="week" className="mt-0">
              <ScheduleBoard />
            </TabsContent>
            <TabsContent value="month" className="mt-0">
              <MonthOverview />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
