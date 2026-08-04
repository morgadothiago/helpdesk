'use client';

import { yupResolver } from '@hookform/resolvers/yup';
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
 */
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
    <div className="flex flex-1 items-center justify-center bg-secondary/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Acesse sua conta do helpdesk.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="flex flex-col gap-4">
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
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
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

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Não tem conta?{' '}
              <Link href="/registro" className="font-medium text-foreground underline underline-offset-4">
                Criar conta
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
