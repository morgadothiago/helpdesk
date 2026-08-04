'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CATEGORY_LABELS,
  createTicket,
  PRIORITY_LABELS,
  TicketsError,
  uploadTicketAttachment,
  type TicketCategory,
  type TicketPriority,
} from '@/lib/tickets';
import { ticketFieldsSchema, type TicketFieldsFormValues } from '@/lib/validation';

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 5000;

const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CATEGORY_OPTIONS: TicketCategory[] = [
  'GENERAL',
  'TECHNICAL',
  'BILLING',
  'ACCOUNT',
  'FEATURE_REQUEST',
  'OTHER',
];

/**
 * Tela de criação de ticket (SPEC-06, seção 3). Submete via
 * `POST /tickets` e, se houver anexo selecionado, envia em uma segunda
 * chamada (`POST /tickets/:id/attachments`) após a criação ter sucesso —
 * sequenciamento documentado em `src/lib/tickets.ts` (`uploadTicketAttachment`).
 *
 * Validação de título/descrição via `react-hook-form` + `yup`
 * (`ticketFieldsSchema`, `src/lib/validation.ts`, SPEC-09), espelhando
 * `createTicketSchema` do backend. Prioridade/categoria/anexo continuam
 * fora do `react-hook-form` controlado por `Select`/`input[type=file]`
 * nativos (sem regra de validação própria — sempre têm um valor padrão
 * válido ou são opcionais).
 *
 * Sucesso redireciona para `/tickets` com indicador de sucesso.
 */
export default function NovoTicketPage() {
  const router = useRouter();
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [category, setCategory] = useState<TicketCategory>('GENERAL');
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TicketFieldsFormValues>({
    resolver: yupResolver(ticketFieldsSchema),
    defaultValues: { title: '', description: '' },
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function onSubmit(values: TicketFieldsFormValues) {
    setSubmitError(null);
    setIsLoading(true);
    try {
      const ticket = await createTicket({
        title: values.title,
        description: values.description,
        priority,
        category,
      });

      if (file) {
        try {
          await uploadTicketAttachment(ticket.id, file);
        } catch {
          // Ticket já foi criado com sucesso; falha de anexo não deve
          // bloquear o fluxo (SPEC-06, seção 3) — apenas segue para a
          // listagem sem exibir o ticket como erro de criação.
        }
      }

      router.push('/tickets?created=true');
    } catch (err) {
      setSubmitError(
        err instanceof TicketsError
          ? err.message
          : 'Não foi possível criar o ticket agora. Tente novamente.',
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-start justify-center bg-secondary/40 px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Novo ticket</CardTitle>
          <CardDescription>
            Descreva o problema ou a solicitação. Nossa equipe vai responder
            o mais breve possível.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="flex flex-col gap-4">
            {submitError ? (
              <Alert variant="destructive" id="novo-ticket-error" role="alert">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                type="text"
                maxLength={TITLE_MAX_LENGTH}
                aria-describedby={
                  errors.title ? 'title-error' : undefined
                }
                aria-invalid={errors.title ? true : undefined}
                {...register('title')}
              />
              {errors.title ? (
                <p id="title-error" role="alert" className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={5}
                maxLength={DESCRIPTION_MAX_LENGTH}
                aria-describedby={
                  errors.description ? 'description-error' : undefined
                }
                aria-invalid={errors.description ? true : undefined}
                {...register('description')}
              />
              {errors.description ? (
                <p
                  id="description-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.description.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as TicketPriority)}
                >
                  <SelectTrigger id="priority" aria-label="Prioridade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {PRIORITY_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as TicketCategory)}
                >
                  <SelectTrigger id="category" aria-label="Categoria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {CATEGORY_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="attachment">Anexo (opcional)</Label>
              <Input
                id="attachment"
                name="attachment"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/csv,application/msword,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                Máximo de 10MB. Formatos aceitos: imagem, PDF, texto ou
                documentos office.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Criando ticket...' : 'Criar ticket'}
            </Button>
            <Link
              href="/tickets"
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Cancelar e voltar para meus tickets
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
