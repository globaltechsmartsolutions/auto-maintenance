"use client";

import * as React from "react";
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { useDemo } from "@/components/demo/demo-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";

function getDefaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 4);
  return date.toISOString().slice(0, 10);
}

function estimateServicePrice(serviceTitle: string) {
  if (serviceTitle.includes("oficinas")) return 1260;
  if (serviceTitle.includes("obra")) return 1800;
  if (serviceTitle.includes("Desinfección")) return 780;
  return 680;
}

type SubmittedBooking = {
  customer: string;
  scheduledAt: string;
  title: string;
};

export function CustomerBookingDemo() {
  const { createBookingRequest } = useDemo();
  const [customer, setCustomer] = React.useState("Residencial Prado");
  const [contactName, setContactName] = React.useState("Ana Martín");
  const [email, setEmail] = React.useState("ana@residencialprado.demo");
  const [phone, setPhone] = React.useState("+34 622 140 900");
  const [title, setTitle] = React.useState("Limpieza extra de cristales");
  const [city, setCity] = React.useState("Madrid");
  const [address, setAddress] = React.useState("Calle Alcalá 120, Madrid");
  const [preferredDate, setPreferredDate] = React.useState(getDefaultDate);
  const [preferredTime, setPreferredTime] = React.useState("10:00");
  const [description, setDescription] = React.useState(
    "Necesitamos limpieza de cristales exteriores y repaso de zonas comunes antes de una visita de propietarios."
  );
  const [submitted, setSubmitted] = React.useState<SubmittedBooking | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const booking = createBookingRequest({
      customer,
      contactName,
      email,
      phone,
      title,
      city,
      address,
      preferredDate,
      preferredTime,
      description,
      estimatedPrice: estimateServicePrice(title),
    });

    setSubmitted({
      customer,
      scheduledAt: booking.scheduledAt,
      title,
    });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-5 px-4 py-5 sm:px-6 lg:py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg border border-primary/35 bg-primary/12 text-primary">
              <Building2 className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-none">
                Limpiezas Demo SL
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Reserva online
              </span>
            </span>
          </div>
          <Badge variant="outline" className="rounded-md">
            Madrid
          </Badge>
        </header>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="gap-2">
            <Badge variant="secondary" className="w-fit rounded-md">
              Cliente final
            </Badge>
            <CardTitle className="text-2xl sm:text-3xl">
              <h1>Solicitar limpieza</h1>
            </CardTitle>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Indica los datos del servicio y el equipo confirmará disponibilidad.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer">Empresa o comunidad</Label>
                  <Input
                    id="customer"
                    value={customer}
                    onChange={(event) => setCustomer(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Persona de contacto</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Servicio</Label>
                  <select
                    id="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                  >
                    <option>Limpieza extra de cristales</option>
                    <option>Limpieza recurrente de oficinas</option>
                    <option>Limpieza fin de obra</option>
                    <option>Desinfección y mantenimiento</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="preferredDate">Fecha</Label>
                  <Input
                    id="preferredDate"
                    type="date"
                    value={preferredDate}
                    onChange={(event) => setPreferredDate(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredTime">Hora</Label>
                  <Input
                    id="preferredTime"
                    type="time"
                    value={preferredTime}
                    onChange={(event) => setPreferredTime(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Detalles</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-28"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  La empresa revisará la solicitud y enviará una confirmación.
                </div>
                <Button type="submit" className="gap-2">
                  Enviar solicitud
                  <ArrowRight className="size-4" />
                </Button>
              </div>
              {submitted ? (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                    <div>
                      <p className="font-semibold">Solicitud enviada correctamente</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Hemos recibido {submitted.title} para {submitted.customer} el{" "}
                        {formatDate(submitted.scheduledAt)}. Te contactaremos para confirmar
                        disponibilidad y equipo.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
