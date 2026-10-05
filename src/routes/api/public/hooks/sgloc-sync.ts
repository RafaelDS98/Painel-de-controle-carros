import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Tick da sincronização SGLOC (a cada 15 min). Só roda se a integração estiver ativa e o intervalo configurado já tiver passado. */
export const Route = createFileRoute("/api/public/hooks/sgloc-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { loadSyncSettings, lastCompletedStart, runSglocSync, SyncBusyError } = await import("@/lib/sgloc/sync.server");
        const { shouldRunTick } = await import("@/lib/sgloc/sync-core");
        const s = await loadSyncSettings();
        const decision = shouldRunTick({ enabled: Boolean(s?.enabled), base_url: s?.base_url ?? null, interval_minutes: s?.interval_minutes ?? 480, sync_user_id: s?.sync_user_id ?? null },
          await lastCompletedStart("schedule"));
        if (!decision.run) return json({ ran: false, reason: decision.reason });
        try {
          const r = await runSglocSync({ trigger: "schedule", simulate: false, actorId: null });
          return json({ ran: true, status: r.status, dryRun: r.dryRun, counts: r.counts });
        } catch (e) {
          if (e instanceof SyncBusyError) return json({ ran: false, reason: "em andamento" });
          console.error("[sgloc-sync] tick falhou", (e as Error)?.name ?? "erro");
          return json({ ran: false, reason: "erro" }, 500);
        }
      },
    },
  },
});
