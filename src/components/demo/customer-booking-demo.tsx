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
  if (serviceTitle.includes("office")) return 1260;
  if (serviceTitle.includes("construction")) return 1800;
  if (serviceTitle.includes("Disinfection")) return 780;
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
  const [email, setEmail] = React.useState("ana@residentialprado.demo");
  const [phone, setPhone] = React.useState("+34 622 140 900");
  const [title, setTitle] = React.useState("Extra window cleaning");
  const [city, setCity] = React.useState("Madrid");
  const [address, setAddress] = React.useState("120 Alcala Street, Madrid");
  const [preferredDate, setPreferredDate] = React.useState(getDefaultDate);
  const [preferredTime, setPreferredTime] = React.useState("10:00");
  const [description, setDescription] = React.useState(
    "We need exterior window cleaning and a touch-up of the common areas before a residents' visit."
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
                CleanWorks Demo Ltd
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Online booking
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
              Customer
            </Badge>
            <CardTitle className="text-2xl sm:text-3xl">
              <h1>Request a cleaning service</h1>
            </CardTitle>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Enter the service details and our team will confirm availability.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer">Company or residential community</Label>
                  <Input
                    id="customer"
                    value={customer}
                    onChange={(event) => setCustomer(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact person</Label>
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
                  <Label htmlFor="phone">Phone</Label>
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
                  <Label htmlFor="title">Service</Label>
                  <select
                    id="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                  >
                    <option>Extra window cleaning</option>
                    <option>Recurring office cleaning</option>
                    <option>Post-construction cleaning</option>
                    <option>Disinfection and maintenance</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="preferredDate">Date</Label>
                  <Input
                    id="preferredDate"
                    type="date"
                    value={preferredDate}
                    onChange={(event) => setPreferredDate(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredTime">Time</Label>
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
                <Label htmlFor="description">Details</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-28"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  We will review your request and send you a confirmation.
                </div>
                <Button type="submit" className="gap-2">
                  Send request
                  <ArrowRight className="size-4" />
                </Button>
              </div>
              {submitted ? (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                    <div>
                      <p className="font-semibold">Request sent successfully</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        We received {submitted.title} for {submitted.customer} on{" "}
                        {formatDate(submitted.scheduledAt)}. We will contact you to confirm
                        availability and the assigned team.
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
