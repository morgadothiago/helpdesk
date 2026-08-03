/**
 * Placeholder mínimo (SPEC-05, seção 3): existe apenas para que o
 * redirecionamento pós-login de usuários `CUSTOMER` (RF02) tenha um destino
 * real e testável via middleware. A tela de listagem/criação de tickets é
 * escopo da SPEC-06 — não implementada aqui.
 */
export default function TicketsPlaceholderPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <p className="text-sm text-muted-foreground">
        Área de tickets em construção (SPEC-06).
      </p>
    </div>
  );
}
