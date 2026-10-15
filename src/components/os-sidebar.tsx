// Painel lateral com dados do veículo, últimas O.S. e totais.
import { Car, Clock, DollarSign, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { OsListItem } from "@/lib/os/os-types";
import { displayPlate, displayOsNumber, formatMoney, formatKm, osTotalsDisplay, isOpen } from "@/lib/os/os-safety";
import { OsStatusBadge } from "./os-status-badge";

interface OsSidebarProps {
  os: OsListItem | null;
  recentOs?: OsListItem[];
  loading?: boolean;
}

export function OsSidebar({ os, recentOs = [], loading }: OsSidebarProps) {
  if (!os) {
    return (
      <Card className="w-full lg:w-80 shrink-0">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Selecione ou crie uma O.S. para ver os detalhes.
        </CardContent>
      </Card>
    );
  }

  const totals = osTotalsDisplay(os);

  return (
    <div className="flex w-full flex-col gap-4 lg:w-80 shrink-0">
      {/* Vehicle info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Car className="h-4 w-4 text-teal-600" />
            Veículo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Placa</span>
            <span className="font-mono font-semibold">{displayPlate(os.plate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">KM</span>
            <span>{formatKm(os.km)}</span>
          </div>
          {os.posicao_inicial && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Posição</span>
              <span>{os.posicao_inicial}</span>
            </div>
          )}
          {os.tanque_inicial && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tanque</span>
              <span>{os.tanque_inicial}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OS info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-teal-600" />
            O.S. #{displayOsNumber(os.numero)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status</span>
            <OsStatusBadge statusId={os.status_id} label={os.status_label} color={os.status_color} size="sm" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo</span>
            <span>{os.tipo_label ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Abertura</span>
            <span>{new Date(os.opened_at).toLocaleDateString("pt-BR")}</span>
          </div>
          {os.closed_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fechamento</span>
              <span>{new Date(os.closed_at).toLocaleDateString("pt-BR")}</span>
            </div>
          )}
          {os.workshop_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Oficina</span>
              <span className="truncate max-w-[160px]">{os.workshop_name}</span>
            </div>
          )}
          {os.centro_custo_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">C. Custo</span>
              <span className="truncate max-w-[160px]">{os.centro_custo_name}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-teal-600" />
            Totais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {totals.map((t) => (
            <div key={t.label} className="flex justify-between">
              <span className="text-muted-foreground">{t.label}</span>
              <span className="font-semibold tabular-nums">R$ {t.value}</span>
            </div>
          ))}
          <Separator className="my-1" />
          <div className="flex justify-between font-bold">
            <span>Total Geral</span>
            <span className="tabular-nums text-teal-700 dark:text-teal-400">
              R$ {formatMoney(os.total_os + os.total_compras)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Recent OS for same vehicle */}
      {recentOs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-teal-600" />
              Últimas O.S. do Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentOs.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span className="font-mono">#{displayOsNumber(r.numero)}</span>
                <OsStatusBadge statusId={r.status_id} label={r.status_label} color={r.status_color} size="sm" />
                <span className="text-muted-foreground">
                  {new Date(r.opened_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}