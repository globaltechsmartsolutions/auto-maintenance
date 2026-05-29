import { CalendarDays, Link2, Plus } from "lucide-react";
import { ScheduleBoard } from "@/components/calendar/schedule-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Asignación de equipos</p>
          <h1 className="mt-1 text-3xl font-semibold">Calendario</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <Link2 className="size-4" />
            Google Calendar
          </Button>
          <Button>
            <Plus className="size-4" />
            Nueva visita
          </Button>
        </div>
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" />
            Semana operativa
          </CardTitle>
          <Tabs defaultValue="week">
            <TabsList>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mes</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <ScheduleBoard />
        </CardContent>
      </Card>
    </div>
  );
}
