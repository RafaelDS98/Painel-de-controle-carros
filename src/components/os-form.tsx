// Formulário de criação/edição de O.S. — página dedicada com abas.
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Save, Printer, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/searchable-select";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { OsConfig, OsDetail, OsListItem, ItemType, ItemApproval } from "@/lib/os/os-types";
import { TIPO_ATENDIMENTO_LABELS } from "@/lib/os/os-types";
import { displayPlate, displayOsNumber, formatMoney } from "@/lib/os/os-safety";
import { DEFAULT_STATUS_ID, canTransition, canFinalize, allowedNextStatuses, isTerminal } from "@/lib/os/os-status";
import {
  createOrdemServico, updateOrdemServico, transitionOsStatus, finalizeOrdemServico,
  addOsItem, updateOsItem, deleteOsItem, batchApproveItems, getOsDetail, getOsConfig,
} from "@/lib/os/os.functions";
import { OsItemsTab } from "./os-items-tab";
import { OsObservationsTab } from "./os-observations-tab";
import { OsPaymentsTab } from "./os-payments-tab";
import { OsSidebar } from "./os-sidebar";
import { OsStatusBadge } from "./os-status-badge";

interface OsFormProps {
  osId: string | null;
  initialAppointmentId?: string | null;
  onCreated?: (id: string) => void;
}

export function OsForm({ osId, initialAppointmentId, onCreated }: OsFormProps) {
  const navigate = useNavigate();
  const isNew = osId === null;

  // Data state
  const [config, setConfig] = useState<OsConfig | null>(null);
  const [detail, setDetail] = useState<OsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("principal");

  // Form fields (principal tab)
  const [plate, setPlate] = useState("");
  const [km, setKm] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [workshopId, setWorkshopId] = useState("");
  const [tipoAtendimento, setTipoAtendimento] = useState("N");
  const [hora, setHora] = useState("");
  const [tanqueInicial, setTanqueInicial] = useState("");
  const [gnvInicial, setGnvInicial] = useState("");
  const [posicaoInicial, setPosicaoInicial] = useState("");
  const [condutorNome, setCondutorNome] = useState("");
  const [condutorContato, setCondutorContato] = useState("");
  const [nf, setNf] = useState("");
  const [recuperado, setRecuperado] = useState(false);
  const [externaRef, setExternaRef] = useState("");
  const [obs1, setObs1] = useState("");
  const [obs2, setObs2] = useState("");
  const [previsaoConclusao, setPrevisaoConclusao] = useState("");
  const [pagamentoMetodo, setPagamentoMetodo] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [pendencia, setPendencia] = useState(false);
  const [pendenciaDesc, setPendenciaDesc] = useState("");
  const [executado, setExecutado] = useState("N");
  const [autorizadoCliente, setAutorizadoCliente] = useState("Pendente");

  // Load config + detail
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cfg = await getOsConfig({ data: {} });
        if (cancelled) return;
        setConfig(cfg as OsConfig);

        if (osId) {
          const det = await getOsDetail({ data: { id: osId } });
          if (cancelled) return;
          const d = det as OsDetail;
          setDetail(d);
          // Populate form from existing OS
          const os = d.os;
          setPlate(os.plate ?? "");
          setKm(os.km != null ? String(os.km) : "");
          setTipoId(os.tipo_id != null ? String(os.tipo_id) : "");
          setCentroCustoId(os.centro_custo_id ?? "");
          setWorkshopId(os.workshop_id ?? "");
          setTipoAtendimento(os.tipo_atendimento ?? "N");
          setHora(os.hora ?? "");
          setTanqueInicial(os.tanque_inicial ?? "");
          setGnvInicial(os.gnv_inicial ?? "");
          setPosicaoInicial(os.posicao_inicial ?? "");
          setCondutorNome(os.condutor_nome ?? "");
          setCondutorContato(os.condutor_contato ?? "");
          setNf(os.nf ?? "");
          setRecuperado(os.recuperado ?? false);
          setExternaRef(os.externa_ref ?? "");
          setObs1(os.obs1 ?? "");
          setObs2(os.obs2 ?? "");
          setPrevisaoConclusao(os.previsao_conclusao ?? "");
          setPagamentoMetodo(os.pagamento_metodo ?? "");
          setSolicitante(os.solicitante ?? "");
          setPendencia(os.pendencia ?? false);
          setPendenciaDesc(os.pendencia_desc ?? "");
          setExecutado(os.executado ?? "N");
          setAutorizadoCliente(os.autorizado_cliente ?? "Pendente");
        }
      } catch (err) {
        toast.error("Erro ao carregar dados da O.S.");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [osId]);

  const currentStatus = detail?.os.status_id ?? DEFAULT_STATUS_ID;
  const terminal = isTerminal(currentStatus);

  // Save (create or update)
  const handleSave = useCallback(async () => {
    if (!plate.trim()) { toast.error("Informe a placa do veículo."); return; }
    if (!tipoId) { toast.error("Selecione o tipo de O.S."); return; }
    setSaving(true);
    try {
      if (isNew) {
        const result = await createOrdemServico({
          data: {
            plate: plate.trim(),
            km: km ? parseInt(km) : null,
            tipoId: parseInt(tipoId),
            centroCustoId: centroCustoId || null,
            workshopId: workshopId || null,
            tipoAtendimento: tipoAtendimento as "P" | "E" | "N" | "D",
            appointmentId: initialAppointmentId ?? null,
            hora: hora || null,
            tanqueInicial: tanqueInicial || null,
            gnvInicial: gnvInicial || null,
            posicaoInicial: posicaoInicial || null,
            condutorNome: condutorNome || null,
            condutorContato: condutorContato || null,
            nf: nf || null,
            recuperado,
            externaRef: externaRef || null,
            obs1: obs1 || null,
            obs2: obs2 || null,
            previsaoConclusao: previsaoConclusao || null,
            pagamentoMetodo: pagamentoMetodo || null,
            solicitante: solicitante || null,
            pendencia,
            pendenciaDesc: pendenciaDesc || null,
            executado: executado as "S" | "A" | "N",
            autorizadoCliente: autorizadoCliente as "Sim" | "Não" | "Pendente",
          },
        });
        const r = result as { id: string; numero: number };
        toast.success(`O.S. #${String(r.numero).padStart(6, "0")} criada com sucesso!`);
        if (onCreated) onCreated(r.id);
        else navigate({ to: "/os/$id", params: { id: r.id } });
      } else {
        // Build changes object
        const changes: Record<string, unknown> = {};
        const os = detail!.os;
        if (plate.trim() !== os.plate) changes.plate = plate.trim();
        if ((km ? parseInt(km) : null) !== os.km) changes.km = km ? parseInt(km) : null;
        if (parseInt(tipoId) !== os.tipo_id) changes.tipo_id = parseInt(tipoId);
        if ((centroCustoId || null) !== os.centro_custo_id) changes.centro_custo_id = centroCustoId || null;
        if ((workshopId || null) !== os.workshop_id) changes.workshop_id = workshopId || null;
        if (tipoAtendimento !== os.tipo_atendimento) changes.tipo_atendimento = tipoAtendimento;
        if ((hora || null) !== os.hora) changes.hora = hora || null;
        if ((tanqueInicial || null) !== os.tanque_inicial) changes.tanque_inicial = tanqueInicial || null;
        if ((gnvInicial || null) !== os.gnv_inicial) changes.gnv_inicial = gnvInicial || null;
        if ((posicaoInicial || null) !== os.posicao_inicial) changes.posicao_inicial = posicaoInicial || null;
        if ((condutorNome || null) !== os.condutor_nome) changes.condutor_nome = condutorNome || null;
        if ((condutorContato || null) !== os.condutor_contato) changes.condutor_contato = condutorContato || null;
        if ((nf || null) !== os.nf) changes.nf = nf || null;
        if (recuperado !== os.recuperado) changes.recuperado = recuperado;
        if ((externaRef || null) !== os.externa_ref) changes.externa_ref = externaRef || null;
        if ((obs1 || null) !== os.obs1) changes.obs1 = obs1 || null;
        if ((obs2 || null) !== os.obs2) changes.obs2 = obs2 || null;
        if ((previsaoConclusao || null) !== os.previsao_conclusao) changes.previsao_conclusao = previsaoConclusao || null;
        if ((pagamentoMetodo || null) !== os.pagamento_metodo) changes.pagamento_metodo = pagamentoMetodo || null;
        if ((solicitante || null) !== os.solicitante) changes.solicitante = solicitante || null;
        if (pendencia !== os.pendencia) changes.pendencia = pendencia;
        if ((pendenciaDesc || null) !== os.pendencia_desc) changes.pendencia_desc = pendenciaDesc || null;
        if (executado !== os.executado) changes.executado = executado;
        if (autorizadoCliente !== os.autorizado_cliente) changes.autorizado_cliente = autorizadoCliente;

        if (Object.keys(changes).length > 0) {
          await updateOrdemServico({ data: { id: osId!, changes } });
        }
        // Reload detail
        const det = await getOsDetail({ data: { id: osId! } });
        setDetail(det as OsDetail);
        toast.success("O.S. atualizada com sucesso!");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar O.S.");
    } finally {
      setSaving(false);
    }
  }, [plate, km, tipoId, centroCustoId, workshopId, tipoAtendimento, hora, tanqueInicial, gnvInicial, posicaoInicial, condutorNome, condutorContato, nf, recuperado, externaRef, obs1, obs2, previsaoConclusao, pagamentoMetodo, solicitante, pendencia, pendenciaDesc, executado, autorizadoCliente, isNew, osId, detail, initialAppointmentId, onCreated, navigate]);

  // Status transition
  const handleTransition = useCallback(async (newStatusId: number) => {
    if (!osId) return;
    try {
      await transitionOsStatus({ data: { id: osId, newStatusId } });
      const det = await getOsDetail({ data: { id: osId } });
      setDetail(det as OsDetail);
      toast.success("Status atualizado!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao alterar status.");
    }
  }, [osId]);

  // Finalize
  const handleFinalize = useCallback(async () => {
    if (!osId) return;
    try {
      await finalizeOrdemServico({
        data: {
          id: osId,
          kmFinal: km ? parseInt(km) : null,
          tanqueFinal: tanqueInicial || null,
          gnvFinal: gnvInicial || null,
          posicaoFinal: posicaoInicial || null,
        },
      });
      const det = await getOsDetail({ data: { id: osId } });
      setDetail(det as OsDetail);
      toast.success("O.S. finalizada!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao finalizar O.S.");
    }
  }, [osId, km, tanqueInicial, gnvInicial, posicaoInicial]);

  // Item handlers
  const handleAddItem = useCallback(async (item: { description: string; qty: number; unitPrice: number; itemType: ItemType }) => {
    if (!osId) return;
    try {
      await addOsItem({ data: { osId, ...item } });
      const det = await getOsDetail({ data: { id: osId } });
      setDetail(det as OsDetail);
    } catch (err: any) { toast.error(err?.message ?? "Erro ao adicionar item."); }
  }, [osId]);

  const handleUpdateItem = useCallback(async (itemId: string, changes: Record<string, unknown>) => {
    try {
      await updateOsItem({ data: { itemId, changes } });
      if (osId) { const det = await getOsDetail({ data: { id: osId } }); setDetail(det as OsDetail); }
    } catch (err: any) { toast.error(err?.message ?? "Erro ao atualizar item."); }
  }, [osId]);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    try {
      await deleteOsItem({ data: { itemId } });
      if (osId) { const det = await getOsDetail({ data: { id: osId } }); setDetail(det as OsDetail); }
    } catch (err: any) { toast.error(err?.message ?? "Erro ao excluir item."); }
  }, [osId]);

  const handleBatchApprove = useCallback(async (approval: ItemApproval) => {
    if (!osId) return;
    try {
      await batchApproveItems({ data: { osId, approval } });
      const det = await getOsDetail({ data: { id: osId } });
      setDetail(det as OsDetail);
      toast.success(`Itens ${approval.toLowerCase()}s!`);
    } catch (err: any) { toast.error(err?.message ?? "Erro ao aprovar itens."); }
  }, [osId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const tipoOptions = (config?.tipos ?? []).map((t) => ({ value: String(t.id), label: t.label }));
  const centroOptions = (config?.centros_custo ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  const posicaoOptions = (config?.posicoes ?? []).filter((p) => p.is_initial).map((p) => ({ value: p.code, label: `${p.code} - ${p.label}` }));
  const nextStatuses = config ? allowedNextStatuses(currentStatus, false, config.status) : [];

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 lg:p-6 max-w-[1600px] mx-auto">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/os" })}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                {isNew ? "Nova Ordem de Serviço" : `O.S. #${displayOsNumber(detail?.os.numero)}`}
              </h1>
              {!isNew && detail && (
                <div className="flex items-center gap-2 mt-1">
                  <OsStatusBadge statusId={detail.os.status_id} label={detail.os.status_label} color={detail.os.status_color} />
                  <span className="text-sm text-muted-foreground">{displayPlate(detail.os.plate)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Status transitions */}
            {!isNew && !terminal && nextStatuses.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                size="sm"
                onClick={() => handleTransition(s.id)}
                style={{ borderColor: s.color, color: s.color }}
              >
                → {s.label}
              </Button>
            ))}
            {!isNew && canFinalize(currentStatus, false) && (
              <Button size="sm" onClick={handleFinalize} className="bg-emerald-600 hover:bg-emerald-700">
                Finalizar O.S.
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isNew ? "Criar O.S." : "Gravar"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="principal">Principal</TabsTrigger>
            <TabsTrigger value="itens">
              Itens / Serviços
              {detail && detail.items.length > 0 && (
                <span className="ml-1.5 rounded-full bg-teal-100 px-1.5 text-xs dark:bg-teal-900">{detail.items.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="observacoes">Observações</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          </TabsList>

          {/* Principal Tab */}
          <TabsContent value="principal" className="mt-4">
            <Card>
              <CardContent className="pt-6 space-y-6">
                {/* Required fields */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Placa *</Label>
                    <Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC1234" disabled={!isNew && terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">KM</Label>
                    <Input type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} placeholder="Quilometragem" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tipo O.S. *</Label>
                    <SearchableSelect options={tipoOptions} value={tipoId} onChange={setTipoId} placeholder="Selecione o tipo" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Centro de Custo</Label>
                    <SearchableSelect options={centroOptions} value={centroCustoId} onChange={setCentroCustoId} placeholder="Selecione" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo Atendimento</Label>
                    <Select value={tipoAtendimento} onValueChange={setTipoAtendimento} disabled={terminal}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_ATENDIMENTO_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hora Abertura</Label>
                    <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={terminal} />
                  </div>
                </div>

                {/* Optional fields */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tanque Inicial</Label>
                    <Input value={tanqueInicial} onChange={(e) => setTanqueInicial(e.target.value)} placeholder="Reserva, 1/8...Cheio" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">GNV Inicial</Label>
                    <Input value={gnvInicial} onChange={(e) => setGnvInicial(e.target.value)} placeholder="1-4" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Posição Inicial</Label>
                    <SearchableSelect options={posicaoOptions} value={posicaoInicial} onChange={setPosicaoInicial} placeholder="Selecione" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Condutor / Operador</Label>
                    <Input value={condutorNome} onChange={(e) => setCondutorNome(e.target.value)} placeholder="Nome" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contato Condutor</Label>
                    <Input value={condutorContato} onChange={(e) => setCondutorContato(e.target.value)} placeholder="Telefone" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nota Fiscal</Label>
                    <Input value={nf} onChange={(e) => setNf(e.target.value)} placeholder="NF" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ref. O.S. Externa</Label>
                    <Input value={externaRef} onChange={(e) => setExternaRef(e.target.value)} placeholder="Referência" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Previsão Conclusão</Label>
                    <Input type="date" value={previsaoConclusao} onChange={(e) => setPrevisaoConclusao(e.target.value)} disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Solicitante</Label>
                    <Input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} placeholder="Quem solicitou" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Input value={pagamentoMetodo} onChange={(e) => setPagamentoMetodo(e.target.value)} placeholder="Ex: Faturado" disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Executado</Label>
                    <Select value={executado} onValueChange={setExecutado} disabled={terminal}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="S">Sim</SelectItem>
                        <SelectItem value="A">Aguardando</SelectItem>
                        <SelectItem value="N">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Autorizado pelo Cliente</Label>
                    <Select value={autorizadoCliente} onValueChange={setAutorizadoCliente} disabled={terminal}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Sim">Sim</SelectItem>
                        <SelectItem value="Não">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={recuperado} onChange={(e) => setRecuperado(e.target.checked)} disabled={terminal} className="rounded" />
                    Recuperado
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={pendencia} onChange={(e) => setPendencia(e.target.checked)} disabled={terminal} className="rounded" />
                    Com Pendência
                  </label>
                </div>

                {pendencia && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Descrição da Pendência</Label>
                    <Textarea value={pendenciaDesc} onChange={(e) => setPendenciaDesc(e.target.value)} placeholder="Descreva a pendência..." rows={2} disabled={terminal} />
                  </div>
                )}

                {/* Obs fields */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Observação 1</Label>
                    <Textarea value={obs1} onChange={(e) => setObs1(e.target.value)} placeholder="Observações gerais..." rows={3} disabled={terminal} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Observação 2</Label>
                    <Textarea value={obs2} onChange={(e) => setObs2(e.target.value)} placeholder="Observações adicionais..." rows={3} disabled={terminal} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="itens" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <OsItemsTab
                  items={detail?.items ?? []}
                  onAdd={handleAddItem}
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                  onBatchApprove={handleBatchApprove}
                  readOnly={terminal}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Observations Tab */}
          <TabsContent value="observacoes" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <OsObservationsTab
                  observations={detail?.observations ?? []}
                  onAdd={async (content) => {
                    // TODO: wire to server function for observations CRUD
                    toast.info("Funcionalidade de observações em desenvolvimento.");
                  }}
                  onDelete={async (id) => {
                    toast.info("Funcionalidade de exclusão em desenvolvimento.");
                  }}
                  readOnly={terminal}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="pagamentos" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <OsPaymentsTab
                  payments={detail?.payments ?? []}
                  onAdd={async (payment) => {
                    toast.info("Funcionalidade de pagamentos em desenvolvimento.");
                  }}
                  onDelete={async (id) => {
                    toast.info("Funcionalidade de exclusão em desenvolvimento.");
                  }}
                  onAccept={async (id) => {
                    toast.info("Funcionalidade de aceite em desenvolvimento.");
                  }}
                  readOnly={terminal}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sidebar */}
      <OsSidebar os={detail?.os ?? null} loading={loading} />
    </div>
  );
}