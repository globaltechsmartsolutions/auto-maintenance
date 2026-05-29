import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthField = {
  name: string;
  label: string;
  type?: string;
  placeholder: string;
  defaultValue?: string;
};

export function AuthCard({
  title,
  description,
  fields,
  action,
  submitLabel,
  footerLabel,
  footerHref,
  footerText,
  error,
  message,
  icon: Icon,
}: {
  title: string;
  description: string;
  fields: AuthField[];
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  footerLabel: string;
  footerHref: string;
  footerText: string;
  error?: string;
  message?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border/70 bg-card/90 shadow-xl">
        <CardHeader className="space-y-4">
          <div className="flex size-11 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" />
              <AlertTitle>No se ha podido continuar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {message ? (
            <Alert className="mb-4">
              <AlertCircle className="size-4" />
              <AlertTitle>Solicitud enviada</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <form action={action} className="space-y-4">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                  required
                />
              </div>
            ))}
            <Button className="w-full" size="lg">
              {submitLabel}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{footerText}</span>
            <Link href={footerHref} className="font-medium text-primary">
              {footerLabel}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
