import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

export type PageAction = "novo" | "config";

/** Ações disparadas pela barra superior (?acao=...): executa uma vez e limpa da URL. */
export function usePageAction(handler: (action: PageAction) => void) {
  const navigate = useNavigate();
  const acao = useRouterState({
    select: (s) => (s.location.search as { acao?: string }).acao,
  });
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (acao !== "novo" && acao !== "config") return;
    ref.current(acao);
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, acao: undefined }),
      replace: true,
    } as never);
  }, [acao, navigate]);
}
