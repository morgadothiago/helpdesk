'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { AuthError, homePathForRole, login } from '@/lib/auth';
import { loginSchema, type LoginFormValues } from '@/lib/validation';

/**
 * Tela de login (SPEC-05, RF02/RF03): autentica via `POST /auth/login`
 * (cookie httpOnly setado pelo Nest) e redireciona conforme o papel do
 * usuário retornado na resposta.
 *
 * Validação de campo via `react-hook-form` + `yup`
 * (`loginSchema`/`src/lib/validation.ts`, SPEC-09) — espelha `LoginDto` do
 * backend só como feedback antecipado de UX; a validação real continua
 * sendo sempre a do Nest.
 *
 * Direção visual: SPEC-09, item 11 (refeita do refinamento do item 9,
 * commit `7c50878`) — ver `apps/web/DESIGN.md`, seção "Refinamento visual
 * de `/login` e `/registro`".
 */

const FOCUS_GLOW =
  'transition-transform duration-200 focus-visible:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-ring/20';
const LINK_CLASS =
  'rounded-sm font-medium text-foreground underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: yupResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    setIsLoading(true);

    try {
      const user = await login(values);
      router.push(homePathForRole(user.role));
    } catch (err) {
      setError(
        err instanceof AuthError
          ? err.message
          : 'Não foi possível entrar agora. Tente novamente.',
      );
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
        className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-secondary/40 blur-3xl"
      />

      <div className="relative grid w-full max-w-6xl grid-cols-1 items-stretch gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="flex items-center justify-center py-6 lg:py-10">
          <Card className="w-full max-w-md animate-auth-card rounded-3xl border-border/60 bg-card/95 shadow-2xl shadow-zinc-950/10 backdrop-blur-sm dark:shadow-black/40">
            <CardHeader className="gap-2 px-8 pb-6 pt-8">
              <CardTitle className="text-3xl font-bold tracking-tight sm:text-4xl">
                Entrar
              </CardTitle>
              <CardDescription className="text-base">
                Acesse sua conta do helpdesk.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <CardContent className="flex flex-col gap-6 px-8 pb-2">
                {error ? (
                  <Alert variant="destructive" id="login-error" role="alert">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className={FOCUS_GLOW}
                    aria-describedby={
                      errors.email ? 'email-error' : error ? 'login-error' : undefined
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
                    autoComplete="current-password"
                    className={FOCUS_GLOW}
                    aria-describedby={
                      errors.password
                        ? 'password-error'
                        : error
                          ? 'login-error'
                          : undefined
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
                  ) : null}
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
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Não tem conta?{' '}
                  <Link href="/registro" className={LINK_CLASS}>
                    Criar conta
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>

        <AuthShowcasePanel tagline="Acompanhe e resolva chamados de suporte em um só lugar." />
      </div>
    </div>
  );
}
