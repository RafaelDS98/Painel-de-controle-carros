import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  ShoppingCart,
  MessageSquare,
  Star,
  Users,
  Paperclip,
  Wrench,
  Play,
  CheckSquare,
  Ban,
} from "lucide-react";

type TabKey = "principal" | "itens" | "pagamentos" | "compras" | "cotacoes" | "observacoes" | "avaliacao" | "orcamento" | "mecanicos" | "anexos";

const statusLabels: Record<string, string> = {
  em_cotacao: "Em cotação",
  aguardando_entrega: "Aguardando entrega",
  para_aprovacao: "Para aprovação",
  aprovada: "Aprovada",
  em_andamento: "Em andamento",
  cancelada: "Cancelada",
  finalizada: "Finalizada",
};

const statusColors: Record<string, string> = {
  em_cotacao: "bg-yellow-100 text-yellow-800 border-yellow-300",
  aguardando_entrega: "bg-purple-100 text-purple-800 border-purple-300",
  para_aprovacao: "bg-blue-100 text-blue-800 border-blue-300",
  aprovada: "bg-green-100 text-green-800 border-green-300",
  em_andamento: "bg-orange-100 text-orange-800 border-orange-300",
  cancelada: "bg-red-100 text-red-800 border-red-300",
  finalizada: "bg-gray-100 text-gray-800 border-gray-300",
};

export const Route = createFileRoute("/_authenticated/ordens-servico/$id")({
  component: EditarOrdemServicoPage,
});

function EditarOrdemServicoPage() {
  const { id } = useParams({ from: "/_authenticated/ordens-servico/$id" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("principal");

  // Query OS detalhe
  const { data: osResult, isLoading, refetch } = useQuery({
    queryKey: ["ordem-servico", id],
    queryFn: async () => {
      const res = await fetch(`/api/ordens-servico/${id}`);
      if (!res.ok) throw new Error("Erro ao carregar OS");
      return res.json();
    },
  });

  const os = osResult?.data;

  // Queries cadastros
  const { data: veiculos } = useQuery({
    queryKey: ["veiculos"],
    queryFn: async () => {
      const { data } = await supabase.from("veiculos").select("id, placa, prefixo, modelo, montadora, km_atual").eq("status", "ativo").order("placa");
      return data ?? [];
    },
  });
  const { data: lojas } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, nome").eq("ativa", true).order("nome");
      return data ?? [];
    },
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data } = await supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });
  const { data: tiposOs } = useQuery({
    queryKey: ["tipos_os"],
    queryFn: async () => {
      const { data } = await supabase.from("tipos_os").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });
  const { data: centrosCusto } = useQuery({
    queryKey: ["centros_custo"],
    queryFn: async () => {
      const { data } = await supabase.from("centros_custo").select("id, codigo, nome").eq("ativo", true).order("codigo");
      return data ?? [];
    },
  });
  const { data: posicoes } = useQuery({
    queryKey: ["posicoes_operacionais"],
    queryFn: async () => {
      const { data } = await supabase.from("posicoes_operacionais").select("id, codigo, nome, tipo").eq("ativo", true).order("codigo");
      return data ?? [];
    },
  });
  const { data: operadores } = useQuery({
    queryKey: ["operadores"],
    queryFn: async () => {
      const { data } = await supabase.from("operadores").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });
  const { data: mecanicos } = useQuery({
    queryKey: ["mecanicos"],
    queryFn: async () => {
      const { data } = await supabase.from("mecanicos").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (os) {
      setFormData({
        veiculoId: os.veiculo_id,
        km: os.km,
        lojaId: os.loja_id,
        fornecedorId: os.fornecedor_id,
        tipoOsId: os.tipo_os_id,
        centroCustoId: os.centro_custo_id,
        status: os.status,
        hora: os.hora,
        tanqueInicial: os.tanque_inicial,
        gnvInicial: os.gnv_inicial,
        posicaoInicialId: os.posicao_inicial_id,
        tipoAtendimento: os.tipo_atendimento,
        contratoId: os.contrato_id,
        condutorNome: os.condutor_nome,
        condutorContato: os.condutor_contato,
        notaFiscal: os.nota_fiscal,
        recuperado: os.recuperado,
        referenciaOsExterna: os.referencia_os_externa,
        obs1: os.obs1,
        obs2: os.obs2,
        previsaoConclusao: os.previsao_conclusao,
        formaPagamento: os.forma_pagamento,
        solicitanteId: os.solicitante_id,
        autorizadorId: os.autorizador_id,
        pendencia: os.pendencia,
        descPendencia: os.desc_pendencia,
        agendarProximaOs: os.agendar_proxima_os,
        executado: os.executado,
        autorizadoCliente: os.autorizado_cliente,
        dataFinal: os.data_final,
        horaFinal: os.hora_final,
        kmFinal: os.km_final,
        tanqueFinal: os.tanque_final,
        gnvFinal: os.gnv_final,
        posicaoFinalId: os.posicao_final_id,
      });
    }
  }, [os]);

  // Mutation update
  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch(`/api/ordens-servico/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao atualizar OS");
      return res.json();
    },
    onSuccess: () => {
      toast.success("O.S. atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ordem-servico", id] });
      queryClient.invalidateQueries({ queryKey: ["ordens-servico"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar");
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleStatusChange = (newStatus: string) => {
    setFormData((f: any) => ({ ...f, status: newStatus }));
    updateMutation.mutate({ status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Carregando ordem de serviço...</div>
      </div>
    );
  }

  if (!os) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600">Ordem de serviço não encontrada</p>
            <Button onClick={() => navigate({ to: "/ordens-servico" })} className="mt-4">
              Voltar para lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const posicoesIniciais = posicoes?.filter((p) => p.tipo === "inicial") ?? [];
  const posicoesFinais = posicoes?.filter((p) => p.tipo === "final") ?? [];
  const podeFinalizar = os.status === "aprovada" || os.status === "em_andamento";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 px-6 py-4 shadow-lg">
        <div className="mx-auto max-w-[1600px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/ordens-servico" })} className="text-white hover:bg-blue-700">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">O.S. #{os.numero}</h1>
                <Badge className={statusColors[os.status] || "bg-gray-100"}>
                  {statusLabels[os.status] || os.status}
                </Badge>
              </div>
              <p className="text-blue-200 text-sm">
                {os.veiculo?.placa} - {os.veiculo?.modelo || os.veiculo?.montadora} | Aberta em {os.data ? format(new Date(os.data + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "-"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Botões de status */}
            {os.status === "para_aprovacao" && (
              <Button onClick={() => handleStatusChange("aprovada")} className="bg-green-500 hover:bg-green-600 text-white">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Aprovar
              </Button>
            )}
            {os.status === "aprovada" && (
              <Button onClick={() => handleStatusChange("em_andamento")} className="bg-orange-500 hover:bg-orange-600 text-white">
                <Play className="mr-2 h-4 w-4" />
                Iniciar
              </Button>
            )}
            {podeFinalizar && (
              <Button onClick={() => handleStatusChange("finalizada")} className="bg-gray-600 hover:bg-gray-700 text-white">
                <CheckSquare className="mr-2 h-4 w-4" />
                Finalizar
              </Button>
            )}
            {os.status !== "cancelada" && os.status !== "finalizada" && (
              <Button variant="outline" onClick={() => handleStatusChange("cancelada")} className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300">
                <Ban className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            )}
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-blue-500 hover:bg-blue-600 text-white">
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] p-6">
        {/* Resumo totais */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Total O.S.</p>
              <p className="text-xl font-bold text-blue-900">R$ {parseFloat(os.total_os || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-3 text-center">
              <p className="text-xs text-green-600 font-medium">Total Serviço</p>
              <p className="text-xl font-bold text-green-900">R$ {parseFloat(os.total_servico || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="py-3 text-center">
              <p className="text-xs text-orange-600 font-medium">Total Estoque</p>
              <p className="text-xl font-bold text-orange-900">R$ {parseFloat(os.total_estoque || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="py-3 text-center">
              <p className="text-xs text-purple-600 font-medium">Total Compras</p>
              <p className="text-xl font-bold text-purple-900">R$ {parseFloat(os.total_compras || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="py-3 text-center">
              <p className="text-xs text-slate-600 font-medium">Itens</p>
              <p className="text-xl font-bold text-slate-900">{os.os_itens?.length || 0}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="space-y-4">
          <TabsList className="bg-white border border-slate-200 p-1 h-auto flex-wrap justify-start">
            <TabsTrigger value="principal" className="gap-1.5"><FileText className="h-4 w-4" />Principal</TabsTrigger>
            <TabsTrigger value="itens" className="gap-1.5"><Wrench className="h-4 w-4" />Itens ({os.os_itens?.length || 0})</TabsTrigger>
            <TabsTrigger value="pagamentos" className="gap-1.5"><DollarSign className="h-4 w-4" />Pagamentos ({os.os_pagamentos?.length || 0})</TabsTrigger>
            <TabsTrigger value="compras" className="gap-1.5"><ShoppingCart className="h-4 w-4" />Compras ({os.os_compras?.length || 0})</TabsTrigger>
            <TabsTrigger value="cotacoes" className="gap-1.5"><FileText className="h-4 w-4" />Cotações</TabsTrigger>
            <TabsTrigger value="observacoes" className="gap-1.5"><MessageSquare className="h-4 w-4" />Observações ({os.os_observacoes_cliente?.length || 0})</TabsTrigger>
            <TabsTrigger value="avaliacao" className="gap-1.5"><Star className="h-4 w-4" />Avaliação</TabsTrigger>
            <TabsTrigger value="orcamento" className="gap-1.5"><DollarSign className="h-4 w-4" />Orçamento</TabsTrigger>
            <TabsTrigger value="mecanicos" className="gap-1.5"><Users className="h-4 w-4" />Mecânicos</TabsTrigger>
            <TabsTrigger value="anexos" className="gap-1.5"><Paperclip className="h-4 w-4" />Anexos ({os.os_anexos?.length || 0})</TabsTrigger>
          </TabsList>

          {/* ABA PRINCIPAL */}
          <TabsContent value="principal">
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="py-3 bg-blue-50 border-b border-blue-100">
                <CardTitle className="text-base font-semibold text-blue-900">Dados da Ordem de Serviço</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Veículo *</Label>
                    <Select value={formData.veiculoId?.toString() || ""} onValueChange={(v) => setFormData((f: any) => ({ ...f, veiculoId: v ? parseInt(v) : null }))}>
                      <SelectTrigger className="h-10 bg-yellow-50 border-yellow-300">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {veiculos?.map((v) => (
                          <SelectItem key={v.id} value={v.id.toString()}>
                            {v.placa} {v.prefixo ? `(${v.prefixo})` : ""} - {v.modelo || v.montadora}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">KM *</Label>
                    <Input type="number" value={formData.km || ""} onChange={(e) => setFormData((f: any) => ({ ...f, km: parseInt(e.target.value) || 0 }))} className="h-10 bg-yellow-50 border-yellow-300" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Data Abertura</Label>
                    <Input type="date" value={os.data || ""} readOnly className="h-10 bg-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Hora</Label>
                    <Input type="time" value={formData.hora || ""} onChange={(e) => setFormData((f: any) => ({ ...f, hora: e.target.value }))} className="h-10" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Loja *</Label>
                    <Select value={formData.lojaId?.toString() || ""} onValueChange={(v) => setFormData((f: any) => ({ ...f, lojaId: v ? parseInt(v) : null }))}>
                      <SelectTrigger className="h-10 bg-yellow-50 border-yellow-300"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {lojas?.map((l) => (<SelectItem key={l.id} value={l.id.toString()}>{l.nome}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Oficina/Autopeças *</Label>
                    <Select value={formData.fornecedorId?.toString() || ""} onValueChange={(v) => setFormData((f: any) => ({ ...f, fornecedorId: v ? parseInt(v) : null }))}>
                      <SelectTrigger className="h-10 bg-yellow-50 border-yellow-300"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {fornecedores?.map((f) => (<SelectItem key={f.id} value={f.id.toString()}>{f.nome}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Tipo O.S. *</Label>
                    <Select value={formData.tipoOsId?.toString() || ""} onValueChange={(v) => setFormData((f: any) => ({ ...f, tipoOsId: v ? parseInt(v) : null }))}>
                      <SelectTrigger className="h-10 bg-yellow-50 border-yellow-300"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tiposOs?.map((t) => (<SelectItem key={t.id} value={t.id.toString()}>{t.nome}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Centro de Custo *</Label>
                    <Select value={formData.centroCustoId?.toString() || ""} onValueChange={(v) => setFormData((f: any) => ({ ...f, centroCustoId: v ? parseInt(v) : null }))}>
                      <SelectTrigger className="h-10 bg-yellow-50 border-yellow-300"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {centrosCusto?.map((c) => (<SelectItem key={c.id} value={c.id.toString()}>{c.codigo} - {c.nome}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Finalização */}
                {(os.status === "em_andamento" || os.status === "finalizada") && (
                  <div className="border-t border-slate-200 pt-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Dados de Finalização</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Data Final</Label>
                        <Input type="date" value={formData.dataFinal || ""} onChange={(e) => setFormData((f: any) => ({ ...f, dataFinal: e.target.value }))} className="h-10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Hora Final</Label>
                        <Input type="time" value={formData.horaFinal || ""} onChange={(e) => setFormData((f: any) => ({ ...f, horaFinal: e.target.value }))} className="h-10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">KM Final</Label>
                        <Input type="number" value={formData.kmFinal || ""} onChange={(e) => setFormData((f: any) => ({ ...f, kmFinal: parseInt(e.target.value) || null }))} className="h-10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Posição Final</Label>
                        <Select value={formData.posicaoFinalId?.toString() || ""} onValueChange={(v) => setFormData((f: any) => ({ ...f, posicaoFinalId: v ? parseInt(v) : null }))}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Posição" /></SelectTrigger>
                          <SelectContent>
                            {posicoesFinais.map((p) => (<SelectItem key={p.id} value={p.id.toString()}>{p.codigo} - {p.nome}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Observações */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Observação 1</Label>
                    <Textarea value={formData.obs1 || ""} onChange={(e) => setFormData((f: any) => ({ ...f, obs1: e.target.value }))} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Observação 2</Label>
                    <Textarea value={formData.obs2 || ""} onChange={(e) => setFormData((f: any) => ({ ...f, obs2: e.target.value }))} rows={3} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA ITENS */}
          <TabsContent value="itens">
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-blue-900">Serviços Efetuados / Itens</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-green-600 border-green-300"><CheckCircle2 className="mr-1 h-4 w-4" />Autorizar todos</Button>
                  <Button variant="outline" size="sm" className="text-red-600 border-red-300"><XCircle className="mr-1 h-4 w-4" />Desautorizar todos</Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Novo Item</Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {os.os_itens?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left">Aprovação</th>
                          <th className="px-3 py-2 text-left">Descrição</th>
                          <th className="px-3 py-2 text-right">Qtd</th>
                          <th className="px-3 py-2 text-right">Vl. Unit.</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-left">Tipo</th>
                          <th className="px-3 py-2 text-left">Mecânico</th>
                          <th className="px-3 py-2 w-20"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {os.os_itens.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <Badge variant="outline" className={
                                item.aprovacao === "autorizado" ? "bg-green-100 text-green-800" :
                                item.aprovacao === "negado" ? "bg-red-100 text-red-800" :
                                "bg-yellow-100 text-yellow-800"
                              }>
                                {item.aprovacao === "autorizado" ? "Autorizado" : item.aprovacao === "negado" ? "Negado" : "Pendente"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">{item.descricao}</td>
                            <td className="px-3 py-2 text-right">{parseFloat(item.quantidade).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">R$ {parseFloat(item.valor_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right font-medium">R$ {parseFloat(item.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2">{item.peca_servico === "peca" ? "Peça" : "Serviço"}</td>
                            <td className="px-3 py-2">{item.mecanico?.nome || "-"}</td>
                            <td className="px-3 py-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Wrench className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Nenhum item cadastrado</p>
                    <Button className="mt-4 bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" />Adicionar primeiro item</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Outras abas - placeholders funcionais */}
          <TabsContent value="pagamentos">
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-blue-900">Pagamentos</CardTitle>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Novo Pagamento</Button>
              </CardHeader>
              <CardContent className="pt-4">
                {os.os_pagamentos?.length ? (
                  <div className="space-y-2">
                    {os.os_pagamentos.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                        <div>
                          <p className="font-medium">R$ {parseFloat(p.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          <p className="text-sm text-slate-500">{p.fornecedor?.nome} • {p.forma_pagamento}</p>
                        </div>
                        <Badge variant={p.aceito ? "default" : "outline"} className={p.aceito ? "bg-green-500" : ""}>
                          {p.aceito ? "Aceito" : "Pendente"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Nenhum pagamento lançado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compras">
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-blue-900">Compras Vinculadas</CardTitle>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Vincular Compra</Button>
              </CardHeader>
              <CardContent className="pt-4">
                {os.os_compras?.length ? (
                  <div className="space-y-2">
                    {os.os_compras.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                        <div>
                          <p className="font-medium">#{c.numero_compra}</p>
                          <p className="text-sm text-slate-500">{c.descricao}</p>
                        </div>
                        <span className="font-medium">R$ {parseFloat(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Nenhuma compra vinculada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cotacoes">
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="py-3 bg-blue-50 border-b border-blue-100">
                <CardTitle className="text-base font-semibold text-blue-900">Cotações (até 3 por item)</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-center py-12 text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Funcionalidade de cotações disponível após adicionar itens</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="observacoes">
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-blue-900">Observações do Cliente</CardTitle>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Nova Observação</Button>
              </CardHeader>
              <CardContent className="pt-4">
                {os.os_observacoes_cliente?.length ? (
                  <div className="space-y-2">
                    {os.os_observacoes_cliente.map((o: any) => (
                      <div key={o.id} className="p-3 bg-slate-50 rounded border">
                        <p>{o.descricao}</p>
                        <p className="text-xs text-slate-400 mt-1">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Nenhuma observação registrada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="avaliacao">
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="py-3 bg-blue-50 border-b border-blue-100">
                <CardTitle className="text-base font-semibold text-blue-900">Avaliação do Fornecedor</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-center py-12 text-slate-500">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Avaliação disponível após finalização da O.S.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orcamento">
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-blue-900">Orçamento para o Cliente</CardTitle>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Novo Item</Button>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-center py-12 text-slate-500">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Monte o orçamento para apresentação ao cliente</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mecanicos">
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-blue-900">Mecânicos Atribuídos</CardTitle>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Adicionar Mecânico</Button>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-center py-12 text-slate-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Atribua mecânicos responsáveis por esta O.S.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="anexos">
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold text-blue-900">Anexos</CardTitle>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Upload Anexo</Button>
              </CardHeader>
              <CardContent className="pt-4">
                {os.os_anexos?.length ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {os.os_anexos.map((a: any) => (
                      <div key={a.id} className="p-3 bg-slate-50 rounded border text-center">
                        <Paperclip className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm truncate">{a.nome_arquivo}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Paperclip className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Nenhum arquivo anexado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}