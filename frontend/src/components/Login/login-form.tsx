import * as React from "react"

import { PhoneIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useLogin } from "@/hooks/use-login"
import { cn } from "@/lib/utils"

export function LoginForm({ className }: { className?: string }) {
  const { register, onSubmit, formState } = useLogin()
  const { errors, isSubmitting } = formState

  return (
    <Card className={cn("w-full max-w-sm gap-5 py-6 sm:gap-6 sm:py-8", className)}>
      <CardHeader className="justify-items-center gap-2 text-center sm:gap-3">
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-foreground/10 bg-foreground/4 py-1 pr-3 pl-1.5">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary">
            <PhoneIcon className="size-3.5" />
          </span>
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Central telefônica
          </span>
          <span
            aria-hidden="true"
            className="animate-lamp-pulse size-1.5 rounded-full bg-emerald-500"
            style={{ "--lamp-color": "oklch(0.72 0.19 145)" } as React.CSSProperties}
          />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Sofon PABX
          </CardTitle>
          <CardDescription>
            Entre com sua conta para acessar o painel
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="username">E-mail</FieldLabel>
              <Input
                id="username"
                type="email"
                placeholder="voce@empresa.com.br"
                autoComplete="username"
                {...register("username", {
                  required: "Informe o e-mail",
                })}
              />
              {errors.username && (
                <FieldError>{errors.username.message}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password", {
                  required: "Informe a senha",
                  minLength: {
                    value: 6,
                    message: "Mínimo de 6 caracteres",
                  },
                })}
              />
              {errors.password && (
                <FieldError>{errors.password.message}</FieldError>
              )}
            </Field>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
