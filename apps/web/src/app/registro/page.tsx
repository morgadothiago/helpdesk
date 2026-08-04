'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { AuthShowcasePanel } from '@/components/auth/auth-showcase-panel';
import { AuthError, register as registerUser } from '@/lib/auth';
import { registerSchema, type RegisterFormValues } from '@/lib/validation';

/**
 * Tela de criação de conta (SPEC-05): cria usuário `CUSTOMER` via
 * `POST /auth/register`. O backend não seta cookie nesta resposta (não há
 * login automático), então após sucesso a UI direciona para `/login`.
 *
 * Validação via `react-hook-form` + `yup` (`registerSchema`,
 * `src/lib/validation.ts`, SPEC-09), espelhando `RegisterDto` do backend.
 *
 * Direção visual: SPEC-09, item 11 (refeita do refinamento do item 9,
 * commit `7c50878`) — ver `apps/web/DESIGN.md`, seção "Refinamento visual
 * de `/login` e `/registro`".
 */

const FOCUS_GLOW =
  'transition-transform duration-200 focus-visible:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-ring/20';
const LINK_CLASS =
  'rounded-sm font-medium text-foreground underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export default function RegistroPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: yupResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onSubmit(values: RegisterFormValues) {
    setError(null);
    setIsLoading(true);

    try {
      await registerUser({ ...values, name: values.name ?? '' });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof AuthError
          ? err.message
          : 'Não foi possível criar sua conta agora. Tente novamente.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex flex-1 items-stretch justify-center overflow-hidden bg-background px-4 py-10 lg:px-6 lg:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-secondary/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-secondary/40 blur-3xl"
      />

      <div className="relative grid w-full max-w-6xl grid-cols-1 items-stretch gap-8 lg:grid-cols-2 lg:gap-12">
        <AuthShowcasePanel
          className="lg:order-first"
          tagline="Crie sua conta e abra seu primeiro chamado de suporte em minutos."
        />

        <div className="flex items-center justify-center py-6 lg:py-10">
          <Card className="w-full max-w-md animate-auth-card rounded-3xl border-border/60 bg-card/95 shadow-2xl shadow-zinc-950/10 backdrop-blur-sm dark:shadow-black/40">
            <CardHeader className="gap-2 px-8 pb-6 pt-8">
              <CardTitle className="text-3xl font-bold tracking-tight sm:text-4xl">
                Criar conta
              </CardTitle>
              <CardDescription className="text-base">
                Crie sua conta para abrir e acompanhar chamados de suporte.
              </CardDescription>
            </CardHeader>

            {success ? (
              <CardContent className="flex flex-col gap-4 px-8 pb-8 pt-4">
                <Alert role="status">
                  <AlertDescription>
                    Conta criada com sucesso. Você já pode entrar.
                  </AlertDescription>
                </Alert>
                <Button asChild className="h-11 w-full rounded-xl text-base font-medium">
                  <Link href="/login">Ir para o login</Link>
                </Button>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <CardContent className="flex flex-col gap-6 px-8 pb-2">
                  {error ? (
                    <Alert variant="destructive" id="registro-error" role="alert">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      type="text"
                      autoComplete="name"
                      className={FOCUS_GLOW}
                      aria-describedby={error ? 'registro-error' : undefined}
                      {...register('name')}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className={FOCUS_GLOW}
                      aria-describedby={
                        errors.email
                          ? 'email-error'
                          : error
                            ? 'registro-error'
                            : undefined
                      }
                      aria-invalid={errors.email ? true : undefined}
                      {...register('email')}
                    />
                    {errors.email ? (
                      <p id="email-error" role="alert" className="text-sm text-destructive">
                        {errors.email.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password">Senha</Label>
                    <PasswordInput
                      id="password"
                      autoComplete="new-password"
                      className={FOCUS_GLOW}
                      aria-describedby={
                        errors.password ? 'password-error' : 'password-hint'
                      }
                      aria-invalid={errors.password ? true : undefined}
                      {...register('password')}
                    />
                    {errors.password ? (
                      <p
                        id="password-error"
                        role="alert"
                        className="text-sm text-destructive"
                      >
                        {errors.password.message}
                      </p>
                    ) : (
                      <p id="password-hint" className="text-xs text-muted-foreground">
                        Mínimo de 8 caracteres.
                      </p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-5 px-8 pb-8 pt-4">
                  <Button
                    type="submit"
                    className="h-11 w-full gap-2 rounded-xl text-base font-medium transition-transform duration-200 active:scale-[0.98]"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Criando conta...
                      </>
                    ) : (
                      'Criar conta'
                    )}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Já tem conta?{' '}
                    <Link href="/login" className={LINK_CLASS}>
                      Entrar
                    </Link>
                  </p>
                </CardFooter>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
