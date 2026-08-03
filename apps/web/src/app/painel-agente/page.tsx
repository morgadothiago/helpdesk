/**
 * Placeholder mínimo (SPEC-05, seção 3): existe apenas para que o
 * redirecionamento pós-login de usuários `AGENT`/`ADMIN` (RF02) tenha um
 * destino real e testável via middleware. O painel do agente completo é
 * escopo da SPEC-08 — não implementado aqui.
 */
export default function PainelAgentePlaceholderPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <p className="text-sm text-muted-foreground">
        Painel do agente em construção (SPEC-08).
      </p>
    </div>
  );
}
