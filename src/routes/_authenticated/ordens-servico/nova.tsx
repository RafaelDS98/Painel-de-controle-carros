import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  DollarSign,
  ShoppingCart,
  MessageSquare,
  Star,
  Users,
  Paperclip,
  Wrench,
} from "lucide-react";

type TabKey = "principal" | "itens" | "pagamentos" | "compras" | "cotacoes" | "observacoes" | "avaliacao" | "orcamento" | "mecanicos" | "anexos";

export const Route = createFileRoute("/_authenticated/ordens-servico/nova")({
  component: NovaOrdemServicoPage,
});

function NovaOrdemServicoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("principal");
  const [formData, setFormData] = useState({
    veiculoId: null as number | null,
    km: "",
    data: format(new Date(), "yyyy-MM-dd"),
    hora: format(new Date(), "HH:mm"),
    lojaId: null as number | null,
    fornecedorId: null as number | null,
    tipoOsId: null as number | null,
    centroCustoId: null as number | null,
    tanqueInicial: "",
    gnvInicial: "",
    posicaoInicialId: null as number | null,
    tipoAtendimento: "",
    contratoId: null as number | null,
    condutorNome: "",
    condutorContato: "",
    notaFiscal: "",
    recuperado: false,
    referenciaOsExterna: "",
    obs1: "",
    obs2: "",
    previsaoConclusao: "",
    formaPagamento: "",
    solicitanteId: null as number | null,
    autorizadorId: null as number | null,
    pendencia: false,
    descPendencia: "",
    agendarProximaOs: false,
    executado: "nao",
    autorizadoCliente: "pendente",
  });

  // Queries para cadastros
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

  const { data: contasOrc } = useQuery({
    queryKey: ["contas_orcamentarias"],
    queryFn: async () => {
      const { data } = await supabase.from("contas_orcamentarias").select("id, codigo, nome").eq("ativo", true).order("codigo");
      return data ?? [];
    },
  });

  const { data: classificacoes } = useQuery({
    queryKey: ["classificacoes_servico"],
    queryFn: async () => {
      const { data } = await supabase.from("classificacoes_servico").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  // Mutation para criar OS
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/ordens-servico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          veiculoId: data.veiculoId,
          km: parseInt(data.km) || 0,
          data: data.data,
          hora: data.hora,
          lojaId: data.lojaId,
          fornecedorId: data.fornecedorId,
          tipoOsId: data.tipoOsId,
          centroCustoId: data.centroCustoId,
          tanqueInicial: data.tanqueInicial || undefined,
          gnvInicial: data.gnvInicial || undefined,
          posicaoInicialId: data.posicaoInicialId || undefined,
          tipoAtendimento: data.tipoAtendimento || undefined,
          contratoId: data.contratoId || undefined,
          condutorNome: data.condutorNome || undefined,
          condutorContato: data.condutorContato || undefined,
          notaFiscal: data.notaFiscal || undefined,
          recuperado: data.recuperado,
          referenciaOsExterna: data.referenciaOsExterna || undefined,
          obs1: data.obs1 || undefined,
          obs2: data.obs2 || undefined,
          previsaoConclusao: data.previsaoConclusao || undefined,
          formaPagamento: data.formaPagamento || undefined,
          solicitanteId: data.solicitanteId || undefined,
          autorizadorId: data.autorizadorId || undefined,
          pendencia: data.pendencia,
          descPendencia: data.descPendencia || undefined,
          agendarProximaOs: data.agendarProximaOs,
          executado: data.executado,
          autorizadoCliente: data.autorizadoCliente,
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar OS");
      return res.json();
    },
    onSuccess: (result) => {
      toast.success(`O.S. ${result.numero} criada com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["ordens-servico"] });
      navigate({ to: `/ordens-servico/${result.data.id}` });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar ordem de serviço");
    },
  });

  // Auto-preencher KM ao selecionar veículo
  useEffect(() => {
    if (formData.veiculoId && veiculos) {
      const v = veiculos.find((v) => v.id === formData.veiculoId);
      if (v?.km_atual) {
        setFormData((f) => ({ ...f, km: String(v.km_atual) }));
      }
    }
  }, [formData.veiculoId, veiculos]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.veiculoId || !formData.lojaId || !formData.fornecedorId || !formData.tipoOsId || !formData.centroCustoId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createMutation.mutate(formData);
  };

  const posicoesIniciais = posicoes?.filter((p) => p.tipo === "inicial") ?? [];
  const posicoesFinais = posicoes?.filter((p) => p.tipo === "final") ?? [];

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
              <h1 className="text-2xl font-bold text-white">Nova Ordem de Serviço</h1>
              <p className="text-blue-200 text-sm">Preencha os dados para abrir uma nova O.S.</p>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} className="bg-green-500 hover:bg-green-600 text-white">
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending ? "Salvando..." : "Salvar O.S."}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] p-6">
        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="space-y-4">
            <TabsList className="bg-white border border-slate-200 p-1 h-auto flex-wrap justify-start">
              <TabsTrigger value="principal" className="gap-1.5"><FileText className="h-4 w-4" />Principal</TabsTrigger>
              <TabsTrigger value="itens" className="gap-1.5"><Wrench className="h-4 w-4" />Itens/Serviços</TabsTrigger>
              <TabsTrigger value="pagamentos" className="gap-1.5"><DollarSign className="h-4 w-4" />Pagamentos</TabsTrigger>
              <TabsTrigger value="compras" className="gap-1.5"><ShoppingCart className="h-4 w-4" />Compras</TabsTrigger>
              <TabsTrigger value="cotacoes" className="gap-1.5"><FileText className="h-4 w-4" />Cotações</TabsTrigger>
              <TabsTrigger value="observacoes" className="gap-1.5"><MessageSquare className="h-4 w-4" />Observações</TabsTrigger>
              <TabsTrigger value="avaliacao" className="gap-1.5"><Star className="h-4 w-4" />Avaliação</TabsTrigger>
              <TabsTrigger value="orcamento" className="gap-1.5"><DollarSign className="h-4 w-4" />Orçamento Cliente</TabsTrigger>
              <TabsTrigger value="mecanicos" className="gap-1.5"><Users className="h-4 w-4" />Mecânicos</TabsTrigger>
              <TabsTrigger value="anexos" className="gap-1.5"><Paperclip className="h-4 w-4" />Anexos</TabsTrigger>
            </TabsList>

            {/* ABA PRINCIPAL */}
            <TabsContent value="principal">
              <Card className="border-blue-200 shadow-sm">
                <CardHeader className="py-3 bg-blue-50 border-b border-blue-100">
                  <CardTitle className="text-base font-semibold text-blue-900">Dados da Ordem de Serviço</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-6">
                  {/* Linha 1: Campos obrigatórios */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Veículo *</Label>
                      <Select value={formData.veiculoId?.toString() || ""} onValueChange={(v) => setFormData((f) => ({ ...f, veiculoId: v ? parseInt(v) : null }))}>
                        <SelectTrigger className="h-10 bg-yellow-50 border-yellow-300">
                          <SelectValue placeholder="Selecione por placa/prefixo" />
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
                      <Input type="number" value={formData.km} onChange={(e) => setFormData((f) => ({ ...f, km: e.target.value }))} className="h-10 bg-yellow-50 border-yellow-300" placeholder="Quilometragem atual" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Data *</Label>
                      <Input type="date" value={formData.data} readOnly className="h-10 bg-slate-100 border-slate-300" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Hora</Label>
                      <Input type="time" value={formData.hora} onChange={(e) => setFormData((f) => ({ ...f, hora: e.target.value }))} className="h-10" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Loja *</Label>
                      <Select value={formData.lojaId?.toString() || ""} onValueChange={(v) => setFormData((f) => ({ ...f, lojaId: v ? parseInt(v) : null }))}>
                        <SelectTrigger className="h-10 bg-yellow-50 border-yellow-300">
                          <SelectValue placeholder="Selecione a loja" />
                        </SelectTrigger>
                        <SelectContent>
                          {lojas?.map((l) => (<SelectItem key={l.id} value={l.id.toString()}>{l.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Oficina/Autopeças *</Label>
                      <Select value={formData.fornecedorId?.toString() || ""} onValueChange={(v) => setFormData((f) => ({ ...f, fornecedorId: v ? parseInt(v) : null }))}>
                        <SelectTrigger className="h-10 bg-yellow-50 border-yellow-300">
                          <SelectValue placeholder="Selecione o fornecedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {fornecedores?.map((f) => (<SelectItem key={f.id} value={f.id.toString()}>{f.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Tipo O.S. *</Label>
                      <Select value={formData.tipoOsId?.toString() || ""} onValueChange={(v) => setFormData((f) => ({ ...f, tipoOsId: v ? parseInt(v) : null }))}>
                        <SelectTrigger className="h-10 bg-yellow-50 border-yellow-300">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposOs?.map((t) => (<SelectItem key={t.id} value={t.id.toString()}>{t.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Centro de Custo *</Label>
                      <Select value={formData.centroCustoId?.toString() || ""} onValueChange={(v) => setFormData((f) => ({ ...f, centroCustoId: v ? parseInt(v) : null }))}>
                        <SelectTrigger className="h-10 bg-yellow-50 border-yellow-300">
                          <SelectValue placeholder="Selecione o centro" />
                        </SelectTrigger>
                        <SelectContent>
                          {centrosCusto?.map((c) => (<SelectItem key={c.id} value={c.id.toString()}>{c.codigo} - {c.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Linha 2: Tanque, GNV, Posição, Tipo Atendimento */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Tanque Inicial</Label>
                      <Select value={formData.tanqueInicial} onValueChange={(v) => setFormData((f) => ({ ...f, tanqueInicial: v }))}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Nível do tanque" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reserva">Reserva</SelectItem>
                          <SelectItem value="1_8">1/8</SelectItem>
                          <SelectItem value="2_8">2/8</SelectItem>
                          <SelectItem value="3_8">3/8</SelectItem>
                          <SelectItem value="4_8">4/8</SelectItem>
                          <SelectItem value="5_8">5/8</SelectItem>
                          <SelectItem value="6_8">6/8</SelectItem>
                          <SelectItem value="7_8">7/8</SelectItem>
                          <SelectItem value="cheio">Cheio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">GNV Inicial</Label>
                      <Select value={formData.gnvInicial} onValueChange={(v) => setFormData((f) => ({ ...f, gnvInicial: v }))}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Nível GNV" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Posição Inicial</Label>
                      <Select value={formData.posicaoInicialId?.toString() || ""} onValueChange={(v) => setFormData((f) => ({ ...f, posicaoInicialId: v ? parseInt(v) : null }))}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Posição do veículo" /></SelectTrigger>
                        <SelectContent>
                          {posicoesIniciais.map((p) => (<SelectItem key={p.id} value={p.id.toString()}>{p.codigo} - {p.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Tipo Atendimento</Label>
                      <Select value={formData.tipoAtendimento} onValueChange={(v) => setFormData((f) => ({ ...f, tipoAtendimento: v }))}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Tipo de atendimento" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="programado">P - Programado</SelectItem>
                          <SelectItem value="emergencial">E - Emergencial</SelectItem>
                          <SelectItem value="normal">N - Normal/Rotina</SelectItem>
                          <SelectItem value="devolucao">D - Devolução</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Linha 3: Condutor, NF, Recuperado, Referência */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Condutor (Nome)</Label>
                      <Input value={formData.condutorNome} onChange={(e) => setFormData((f) => ({ ...f, condutorNome: e.target.value }))} className="h-10" placeholder="Nome do condutor" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Condutor (Contato)</Label>
                      <Input value={formData.condutorContato} onChange={(e) => setFormData((f) => ({ ...f, condutorContato: e.target.value }))} className="h-10" placeholder="Telefone do condutor" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Nota Fiscal</Label>
                      <Input value={formData.notaFiscal} onChange={(e) => setFormData((f) => ({ ...f, notaFiscal: e.target.value }))} className="h-10" placeholder="Número da NF" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Referência O.S. Externa</Label>
                      <Input value={formData.referenciaOsExterna} onChange={(e) => setFormData((f) => ({ ...f, referenciaOsExterna: e.target.value }))} className="h-10" placeholder="Ref. externa" />
                    </div>
                  </div>

                  {/* Linha 4: Flags e datas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Previsão Conclusão</Label>
                      <Input type="date" value={formData.previsaoConclusao} onChange={(e) => setFormData((f) => ({ ...f, previsaoConclusao: e.target.value }))} className="h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Forma de Pagamento</Label>
                      <Select value={formData.formaPagamento} onValueChange={(v) => setFormData((f) => ({ ...f, formaPagamento: v }))}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                          <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="boleto">Boleto</SelectItem>
                          <SelectItem value="transferencia">Transferência</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="cortesia">Cortesia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Solicitante</Label>
                      <Select value={formData.solicitanteId?.toString() || ""} onValueChange={(v) => setFormData((f) => ({ ...f, solicitanteId: v ? parseInt(v) : null }))}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Quem solicitou" /></SelectTrigger>
                        <SelectContent>
                          {operadores?.map((o) => (<SelectItem key={o.id} value={o.id.toString()}>{o.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Autorizador</Label>
                      <Select value={formData.autorizadorId?.toString() || ""} onValueChange={(v) => setFormData((f) => ({ ...f, autorizadorId: v ? parseInt(v) : null }))}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Quem autoriza" /></SelectTrigger>
                        <SelectContent>
                          {operadores?.filter((o) => o.id).map((o) => (<SelectItem key={o.id} value={o.id.toString()}>{o.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Flags */}
                  <div className="flex flex-wrap gap-6 pt-2 border-t border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={formData.recuperado} onCheckedChange={(c) => setFormData((f) => ({ ...f, recuperado: !!c }))} />
                      <span className="text-sm">Recuperado</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={formData.pendencia} onCheckedChange={(c) => setFormData((f) => ({ ...f, pendencia: !!c }))} />
                      <span className="text-sm">Com Pendência</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={formData.agendarProximaOs} onCheckedChange={(c) => setFormData((f) => ({ ...f, agendarProximaOs: !!c }))} />
                      <span className="text-sm">Agendar serviços p/ próxima O.S.</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Executado:</span>
                      <Select value={formData.executado} onValueChange={(v) => setFormData((f) => ({ ...f, executado: v }))}>
                        <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Autorizado Cliente:</span>
                      <Select value={formData.autorizadoCliente} onValueChange={(v) => setFormData((f) => ({ ...f, autorizadoCliente: v }))}>
                        <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                          <SelectItem value="pendente">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Descrição Pendência (condicional) */}
                  {formData.pendencia && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Descrição da Pendência</Label>
                      <Textarea value={formData.descPendencia} onChange={(e) => setFormData((f) => ({ ...f, descPendencia: e.target.value }))} placeholder="Descreva a pendência..." rows={2} />
                    </div>
                  )}

                  {/* Observações */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Observação 1</Label>
                      <Textarea value={formData.obs1} onChange={(e) => setFormData((f) => ({ ...f, obs1: e.target.value }))} placeholder="Observações gerais..." rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Observação 2</Label>
                      <Textarea value={formData.obs2} onChange={(e) => setFormData((f) => ({ ...f, obs2: e.target.value }))} placeholder="Observações adicionais..." rows={3} />
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
                    <Button variant="outline" size="sm" className="text-green-600 border-green-300"><CheckCircle2 className="mr-1 h-4 w-4" />Marcar todos concluídos</Button>
                    <Button variant="outline" size="sm" className="text-blue-600 border-blue-300"><CheckCircle2 className="mr-1 h-4 w-4" />Autorizar todos</Button>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-300"><XCircle className="mr-1 h-4 w-4" />Desautorizar todos</Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Novo Item</Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center py-12 text-slate-500">
                    <Wrench className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Salve a O.S. primeiro para adicionar itens</p>
                    <p className="text-sm mt-2">Após salvar, você poderá adicionar peças e serviços aqui</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA PAGAMENTOS */}
            <TabsContent value="pagamentos">
              <Card className="border-blue-200 shadow-sm">
                <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold text-blue-900">Pagamentos</CardTitle>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Novo Pagamento</Button>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center py-12 text-slate-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Salve a O.S. primeiro para lançar pagamentos</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA COMPRAS */}
            <TabsContent value="compras">
              <Card className="border-blue-200 shadow-sm">
                <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold text-blue-900">Compras Vinculadas</CardTitle>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Vincular Compra</Button>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center py-12 text-slate-500">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Salve a O.S. primeiro para vincular compras</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA COTAÇÕES */}
            <TabsContent value="cotacoes">
              <Card className="border-blue-200 shadow-sm">
                <CardHeader className="py-3 bg-blue-50 border-b border-blue-100">
                  <CardTitle className="text-base font-semibold text-blue-900">Cotações (até 3 fornecedores por item)</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center py-12 text-slate-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Adicione itens primeiro para solicitar cotações</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA OBSERVAÇÕES */}
            <TabsContent value="observacoes">
              <Card className="border-blue-200 shadow-sm">
                <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold text-blue-900">Observações do Cliente</CardTitle>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Nova Observação</Button>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center py-12 text-slate-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Salve a O.S. primeiro para registrar observações do cliente</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA AVALIAÇÃO */}
            <TabsContent value="avaliacao">
              <Card className="border-blue-200 shadow-sm">
                <CardHeader className="py-3 bg-blue-50 border-b border-blue-100">
                  <CardTitle className="text-base font-semibold text-blue-900">Avaliação do Fornecedor</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center py-12 text-slate-500">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Salve e finalize a O.S. para avaliar o fornecedor</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA ORÇAMENTO CLIENTE */}
            <TabsContent value="orcamento">
              <Card className="border-blue-200 shadow-sm">
                <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold text-blue-900">Orçamento para o Cliente</CardTitle>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Novo Item Orçamento</Button>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center py-12 text-slate-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Salve a O.S. primeiro para montar o orçamento do cliente</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA MECÂNICOS */}
            <TabsContent value="mecanicos">
              <Card className="border-blue-200 shadow-sm">
                <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold text-blue-900">Mecânicos Atribuídos</CardTitle>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Adicionar Mecânico</Button>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center py-12 text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Salve a O.S. primeiro para atribuir mecânicos</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA ANEXOS */}
            <TabsContent value="anexos">
              <Card className="border-blue-200 shadow-sm">
                <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold text-blue-900">Anexos</CardTitle>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-1 h-4 w-4" />Upload Anexo</Button>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center py-12 text-slate-500">
                    <Paperclip className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Salve a O.S. primeiro para anexar arquivos</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </div>
    </div>
  );
}