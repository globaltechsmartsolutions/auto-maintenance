"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDemo, type DemoService } from "@/components/demo/demo-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const monthLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];

function getServiceCategory(service: DemoService) {
  const text = `${service.title} ${service.customer} ${service.recurrence}`.toLowerCase();
  if (text.includes("oficina") || text.includes("cowork")) return "Oficinas";
  if (text.includes("comunidad") || text.includes("residencial") || text.includes("garaje")) {
    return "Comunidades";
  }
  if (text.includes("hotel")) return "Hoteles";
  if (text.includes("obra")) return "Final de obra";
  if (text.includes("desinfección") || text.includes("desinfeccion") || text.includes("industrial")) {
    return "Industrial";
  }
  return "Otros";
}

function buildRevenueSeries(services: DemoService[]) {
  return monthLabels.map((month, index) => {
    const monthServices = services.filter((service) => {
      const date = new Date(service.start);
      return date.getFullYear() === 2026 && date.getMonth() === index;
    });

    return {
      month,
      revenue: Math.round(
        monthServices.reduce(
          (total, service) => total + service.price * (1 + service.vatRate / 100),
          0
        )
      ),
      services: monthServices.length,
    };
  });
}

function buildServiceMix(services: DemoService[]) {
  const totals = services.reduce<Record<string, number>>((current, service) => {
    const category = getServiceCategory(service);
    current[category] = (current[category] ?? 0) + 1;
    return current;
  }, {});

  return Object.entries(totals)
    .map(([name, value]) => ({ name, value }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 5);
}

function useElementWidth() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;
    const update = () => setWidth(Math.floor(element.clientWidth));
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.floor(entries[0]?.contentRect.width ?? element.clientWidth));
    });

    update();
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export function DashboardCharts() {
  const { services } = useDemo();
  const [revenueRef, revenueWidth] = useElementWidth();
  const [mixRef, mixWidth] = useElementWidth();
  const revenueSeries = React.useMemo(() => buildRevenueSeries(services), [services]);
  const serviceMix = React.useMemo(() => buildServiceMix(services), [services]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ingresos y servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={revenueRef} className="h-[320px] min-w-0">
            {revenueWidth > 0 ? (
              <AreaChart
                data={revenueSeries}
                margin={{ left: 8, right: 8 }}
                width={Math.max(revenueWidth, 320)}
                height={320}
              >
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.34}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Ingresos"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            ) : (
              <div className="h-full rounded-md border border-border/70 bg-muted/30" />
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mix de servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={mixRef} className="h-[320px] min-w-0">
            {mixWidth > 0 ? (
              <BarChart
                data={serviceMix}
                layout="vertical"
                margin={{ left: 8 }}
                width={Math.max(mixWidth, 320)}
                height={320}
              >
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={96}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar
                  dataKey="value"
                  name="Peso"
                  fill="var(--chart-2)"
                  radius={5}
                />
              </BarChart>
            ) : (
              <div className="h-full rounded-md border border-border/70 bg-muted/30" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
