import * as yup from 'yup';

/**
 * Schemas `yup` usados com `react-hook-form` (`@hookform/resolvers/yup`,
 * SPEC-09) em todos os formulários de autenticação/tickets/comentários.
 *
 * Cada schema espelha manualmente a validação `zod`/`class-validator` já
 * existente no backend — mesma convenção de duplicação manual já aceita
 * para os enums e tipos de domínio em `src/lib/tickets.ts`/`src/lib/auth.ts`
 * (a fonte de verdade da validação continua sendo sempre o backend; isto é
 * só feedback antecipado de UX). Mensagens sempre em português,
 * referenciadas junto ao campo pelo `react-hook-form`.
 */

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 5000;
const COMMENT_MAX_LENGTH = 5000;

/** Espelha `LoginDto` (`apps/api/src/auth/dto/login.dto.ts`, SPEC-02). */
export const loginSchema = yup.object({
  email: yup
    .string()
    .trim()
    .required('Email é obrigatório.')
    .email('Informe um email válido.'),
  password: yup.string().required('Senha é obrigatória.'),
});

export type LoginFormValues = yup.InferType<typeof loginSchema>;

/** Espelha `RegisterDto` (`apps/api/src/auth/dto/register.dto.ts`, SPEC-02). */
export const registerSchema = yup.object({
  name: yup.string().trim().optional(),
  email: yup
    .string()
    .trim()
    .required('Email é obrigatório.')
    .email('Informe um email válido.'),
  password: yup
    .string()
    .required('Senha é obrigatória.')
    .min(8, 'Senha deve ter no mínimo 8 caracteres.'),
});

export type RegisterFormValues = yup.InferType<typeof registerSchema>;

/**
 * Espelha `createTicketSchema`
 * (`apps/api/src/tickets/dto/create-ticket.schema.ts`, SPEC-03): usado tanto
 * na criação (SPEC-06) quanto na edição de título/descrição pelo `CUSTOMER`
 * (SPEC-07, `CustomerEditCard`) — mesmos limites em ambos os casos.
 */
export const ticketFieldsSchema = yup.object({
  title: yup
    .string()
    .trim()
    .required('Título é obrigatório.')
    .max(
      TITLE_MAX_LENGTH,
      `Título deve ter no máximo ${TITLE_MAX_LENGTH} caracteres.`,
    ),
  description: yup
    .string()
    .trim()
    .required('Descrição é obrigatória.')
    .max(
      DESCRIPTION_MAX_LENGTH,
      `Descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`,
    ),
});

export type TicketFieldsFormValues = yup.InferType<typeof ticketFieldsSchema>;

/**
 * Espelha `createCommentSchema`
 * (`apps/api/src/comments/dto/create-comment.schema.ts`, SPEC-04).
 */
export const commentSchema = yup.object({
  content: yup
    .string()
    .trim()
    .required('Comentário é obrigatório.')
    .max(
      COMMENT_MAX_LENGTH,
      `Comentário deve ter no máximo ${COMMENT_MAX_LENGTH} caracteres.`,
    ),
});

export type CommentFormValues = yup.InferType<typeof commentSchema>;

/**
 * Espelha `updateTicketSchema` no subconjunto de campos editáveis pelo
 * `AGENT`/`ADMIN` na tela de detalhe (SPEC-07 `AgentEditCard`):
 * `status`/`priority`/`category` sempre presentes (o `<Select>` nunca fica
 * vazio), `assignedToId` é texto livre opcional (SPEC-07, seção 10 — sem
 * endpoint de listagem de usuários).
 */
export const agentEditSchema = yup.object({
  status: yup.string().required(),
  priority: yup.string().required(),
  category: yup.string().required(),
  assignedToId: yup.string().trim().optional(),
});

export type AgentEditFormValues = yup.InferType<typeof agentEditSchema>;
