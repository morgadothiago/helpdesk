'use client';

import { yupResolver } from '@hookform/resolvers/yup';
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
import { AuthError, register as registerUser } from '@/lib/auth';
import { registerSchema, type RegisterFormValues } from '@/lib/validation';

/**
 * Tela de criação de conta (SPEC-05): cria usuário `CUSTOMER` via
 * `POST /auth/register`. O backend não seta cookie nesta resposta (não há
 * login automático), então após sucesso a UI direciona para `/login`.
 *
 * Validação via `react-hook-form` + `yup` (`registerSchema`,
 * `src/lib/validation.ts`, SPEC-09), espelhando `RegisterDto` do backend.
 */
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
    <div className="flex flex-1 items-center justify-center bg-secondary/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>
            Crie sua conta para abrir e acompanhar chamados de suporte.
          </CardDescription>
        </CardHeader>

        {success ? (
          <CardContent className="flex flex-col gap-4">
            <Alert role="status">
              <AlertDescription>
                Conta criada com sucesso. Você já pode entrar.
              </AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <Link href="/login">Ir para o login</Link>
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <CardContent className="flex flex-col gap-4">
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
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
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

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Criando conta...' : 'Criar conta'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{' '}
                <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
                  Entrar
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
