import type { CSSProperties } from "react"

import { SofonMark } from "@/components/icons/sofon-mark"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useRegister } from "@/hooks/use-register"
import { cn } from "@/lib/utils"

export function RegisterForm({ className }: { className?: string }) {
  const { register, onSubmit, formState } = useRegister()
  const { errors, isSubmitting } = formState

  return (
    <div className={cn("w-full max-w-sm", className)}>
      <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
        <div className="flex w-fit items-center gap-2 rounded-full border border-foreground/10 bg-foreground/4 py-1 pr-3 pl-1.5">
          <SofonMark className="size-5 shrink-0 rounded-full" />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Central telefônica
          </span>
          <span
            aria-hidden="true"
            className="animate-lamp-pulse size-1.5 rounded-full bg-emerald-500"
            style={{ "--lamp-color": "oklch(0.72 0.19 145)" } as CSSProperties}
          />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Sofon PABX</h1>
      </div>

      <div className="mb-6 hidden space-y-1 lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">
          Criar conta de administrador
        </h1>
        <p className="text-sm text-muted-foreground">
          Nenhum usuário cadastrado ainda - crie o primeiro acesso do sistema.
        </p>
      </div>

      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome"
              autoComplete="name"
              {...register("name")}
            />
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="username">E-mail</FieldLabel>
            <Input
              id="username"
              type="email"
              placeholder="voce@empresa.com.br"
              autoComplete="username"
              {...register("username")}
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
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <FieldError>{errors.password.message}</FieldError>
            )}
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Criando conta..." : "Criar conta"}
          </Button>
        </FieldGroup>
      </form>
    </div>
  )
}
