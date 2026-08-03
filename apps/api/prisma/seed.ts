// Seed script opcional (SPEC-01, seção 3): cria dados mínimos de exemplo
// (1 admin, 1 agent, 1 customer, 1 ticket) para facilitar desenvolvimento
// local. Não é obrigatório para produção.

import { PrismaClient, Role, TicketPriority, TicketCategory } from '@prisma/client';

const prisma = new PrismaClient();

// Mesma tabela de SLA por prioridade descrita na SPEC-01, seção 3.1.
const SLA_HOURS_BY_PRIORITY: Record<TicketPriority, number> = {
  URGENT: 4,
  HIGH: 8,
  MEDIUM: 24,
  LOW: 72,
};

function calculateDueAt(createdAt: Date, priority: TicketPriority): Date {
  const hours = SLA_HOURS_BY_PRIORITY[priority];
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@helpdesk.local' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@helpdesk.local',
      role: Role.ADMIN,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@helpdesk.local' },
    update: {},
    create: {
      name: 'Agente',
      email: 'agent@helpdesk.local',
      role: Role.AGENT,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@helpdesk.local' },
    update: {},
    create: {
      name: 'Cliente',
      email: 'customer@helpdesk.local',
      role: Role.CUSTOMER,
    },
  });

  const createdAt = new Date();
  const priority = TicketPriority.MEDIUM;

  await prisma.ticket.upsert({
    where: { id: 'seed-ticket-1' },
    update: {},
    create: {
      id: 'seed-ticket-1',
      title: 'Não consigo acessar minha conta',
      description: 'Ao tentar logar, recebo um erro de credenciais inválidas.',
      category: TicketCategory.ACCOUNT,
      priority,
      createdById: customer.id,
      assignedToId: agent.id,
      dueAt: calculateDueAt(createdAt, priority),
      createdAt,
    },
  });

  console.log('Seed concluído:', { admin: admin.email, agent: agent.email, customer: customer.email });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
