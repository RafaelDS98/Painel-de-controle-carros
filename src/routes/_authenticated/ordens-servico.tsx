import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Plus,
  Trash2,
  Download,
  FileText,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  MoreHorizontal,
} from "lucide-react";

// Tipos
type OsStatus = "em_cotacao" | "aguardando_entrega" | "para_aprovacao" | "aprovada" | "em_andamento" | "cancelada" | "finalizada";
type TipoAtendimento = "programado" | "emergencial" | "normal" | "devolucao";

interface OrdemServico {
  id: number;
  numero: number;
  status: OsStatus;
  data: string;
  data_final: string | null;
  km: number;
  km_final: number | null;
  total_os: string;
  pendencia: boolean;
  recuperado: boolean;
  referencia_os_externa: string | null;
  nota_fiscal: string | null;
  veiculo: { placa: string; prefixo: string | null; modelo: string | null; montadora: string | null; categoria: string | null };
  loja: { nome: string };
  fornecedor: { nome: string };
  tipo_os: { nome: string };
  centro_custo: { codigo: string; nome: string };
  posicao_inicial: { codigo: string; nome: string } | null;
  posicao_final: { codigo: string; nome: string } | null;
  tipo_atendimento: TipoAtendimento | null;
  status_pagamento: string;
}

interface Filtros {
  status: string[];
  tipoOs: number[];
  numero: string;
  centroCustoId: number | null;
  recuperado: boolean | null;
  referenciaOs: string;
  dataInicial: Date | null;
  dataFinal: Date | null;
  palavraChave: string;
  fornecedorId: number | null;
  numeroCompra: string;
  comPendencia: boolean;
  lojaId: number | null;
  placaPrefixo: string;
  montadora: string;
  modelo: string;
  contratoId: number | null;
  infoPagamento: string;
  pecaEstoque: string;
  categoriaVeiculo: string;
  clienteId: number | null;
  tipoAtendimento: TipoAtendimento | null;
  mecanicoId: number | null;
  classificacaoServicoId: number | null;
}

const statusLabels: Record<OsStatus, string> = {
  em_cotacao: "Em cotação",
  aguardando_entrega: "Aguardando entrega",
  para_aprovacao: "Para aprovação",
  aprovada: "Aprovada",
  em_andamento: "Em andamento",
  cancelada: "Cancelada",
  finalizada: "Finalizada",
};

const statusColors: Record<OsStatus, string> = {
  em_cotacao: "bg-yellow-100 text-yellow-800 border-yellow-300",
  aguardando_entrega: "bg-purple-100 text-purple-800 border-purple-300",
  para_aprovacao: "bg-blue-100 text-blue-800 border-blue-300",
  aprovada: "bg-green-100 text-green-800 border-green-300",
  em_andamento: "bg-orange-100 text-orange-800 border-orange-300",
  cancelada: "bg-red-100 text-red-800 border-red-300",
  finalizada: "bg-gray-100 text-gray-800 border-gray-300",
};

const tipoAtendimentoLabels: Record<TipoAtendimento, string> = {
  programado: "Programado",
  emergencial: "Emergencial",
  normal: "Normal",
  devolucao: "Devolução",
};

export const Route = createFileRoute("/_authenticated/ordens-servico")({
  component: OrdensServicoPage,
});

function OrdensServicoPage() {
  const navigate = useNavigate();
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState("data");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [filtros, setFiltros] = useState<Filtros>({
    status: [],
    tipoOs: [],
    numero: "",
    centroCustoId: null,
    recuperado: null,
    referenciaOs: "",
    dataInicial: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    dataFinal: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    palavraChave: "",
    fornecedorId: null,
    numeroCompra: "",
    comPendencia: false,
    lojaId: null,
    placaPrefixo: "",
    montadora: "",
    modelo: "",
    contratoId: null,
    infoPagamento: "",
    pecaEstoque: "",
    categoriaVeiculo: "",
    clienteId: null,
    tipoAtendimento: null,
    mecanicoId: null,
    classificacaoServicoId: null,
  });

  // Queries para cadastros de apoio
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

  const { data: mecanicos } = useQuery({
    queryKey: ["mecanicos"],
    queryFn: async () => {
      const { data } = await supabase.from("mecanicos").select("id, nome").eq("ativo", true).order("nome");
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

  // Query principal de ordens de serviço
  const { data: osResult, isLoading, refetch } = useQuery({
    queryKey: ["ordens-servico", filtros, page, pageSize, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtros.status.length) params.set("status", filtros.status.join(","));
      if (filtros.tipoOs.length) params.set("tipoOs", filtros.tipoOs.join(","));
      if (filtros.numero) params.set("numero", filtros.numero);
      if (filtros.centroCustoId) params.set("centroCustoId", String(filtros.centroCustoId));
      if (filtros.recuperado !== null) params.set("recuperado", String(filtros.recuperado));
      if (filtros.referenciaOs) params.set("referenciaOs", filtros.referenciaOs);
      if (filtros.dataInicial) params.set("dataInicial", format(filtros.dataInicial, "yyyy-MM-dd"));
      if (filtros.dataFinal) params.set("dataFinal", format(filtros.dataFinal, "yyyy-MM-dd"));
      if (filtros.palavraChave) params.set("palavraChave", filtros.palavraChave);
      if (filtros.fornecedorId) params.set("fornecedorId", String(filtros.fornecedorId));
      if (filtros.numeroCompra) params.set("numeroCompra", filtros.numeroCompra);
      if (filtros.comPendencia) params.set("comPendencia", "true");
      if (filtros.lojaId) params.set("lojaId", String(filtros.lojaId));
      if (filtros.placaPrefixo) params.set("placaPrefixo", filtros.placaPrefixo);
      if (filtros.montadora) params.set("montadora", filtros.montadora);
      if (filtros.modelo) params.set("modelo", filtros.modelo);
      if (filtros.contratoId) params.set("contratoId", String(filtros.contratoId));
      if (filtros.infoPagamento) params.set("infoPagamento", filtros.infoPagamento);
      if (filtros.categoriaVeiculo) params.set("categoriaVeiculo", filtros.categoriaVeiculo);
      if (filtros.tipoAtendimento) params.set("tipoAtendimento", filtros.tipoAtendimento);
      if (filtros.mecanicoId) params.set("mecanicoId", String(filtros.mecanicoId));
      if (filtros.classificacaoServicoId) params.set("classificacaoServicoId", String(filtros.classificacaoServicoId));
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/ordens-servico?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar ordens de serviço");
      return res.json();
    },
  });

  const ordens = osResult?.data ?? [];
  const total = osResult?.total ?? 0;
  const totalPages = osResult?.totalPages ?? 1;

  // Agrupamento
  const groupedData = useMemo(() => {
    if (!groupBy) return { groups: [{ key: "all", items: ordens }] };
    const groups: Record<string, OrdemServico[]> = {};
    for (const os of ordens) {
      let key = "Outros";
      switch (groupBy) {
        case "status":
          key = statusLabels[os.status as OsStatus] || os.status;
          break;
        case "tipo":
          key = os.tipo_os?.nome || "Sem tipo";
          break;
        case "loja":
          key = os.loja?.nome || "Sem loja";
          break;
        case "fornecedor":
          key = os.fornecedor?.nome || "Sem fornecedor";
          break;
        case "centroCusto":
          key = os.centro_custo ? `${os.centro_custo.codigo} - ${os.centro_custo.nome}` : "Sem centro";
          break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(os);
    }
    return { groups: Object.entries(groups).map(([key, items]) => ({ key, items })) };
  }, [ordens, groupBy]);

  const limparFiltros = () => {
    setFiltros({
      status: [],
      tipoOs: [],
      numero: "",
      centroCustoId: null,
      recuperado: null,
      referenciaOs: "",
      dataInicial: null,
      dataFinal: null,
      palavraChave: "",
      fornecedorId: null,
      numeroCompra: "",
      comPendencia: false,
      lojaId: null,
      placaPrefixo: "",
      montadora: "",
      modelo: "",
      contratoId: null,
      infoPagamento: "",
      pecaEstoque: "",
      categoriaVeiculo: "",
      clienteId: null,
      tipoAtendimento: null,
      mecanicoId: null,
      classificacaoServicoId: null,
    });
    setPage(1);
  };

  const toggleStatus = (status: string) => {
    setFiltros((f) => ({
      ...f,
      status: f.status.includes(status) ? f.status.filter((s) => s !== status) : [...f.status, status],
    }));
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 px-6 py-4 shadow-lg">
        <div className="mx-auto max-w-[1800px] flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Ordens de Serviço</h1>
            <p className="text-blue-200 text-sm">Gestão completa de manutenção da frota</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate({ to: "/ordens-servico/nova" })}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova O.S.
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] p-6 space-y-4">
        {/* Filtros */}
        <Card className="border-blue-200 shadow-sm">
          <CardHeader
            className="py-3 cursor-pointer hover:bg-blue-50 transition-colors"
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-blue-900 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8">
                {filtrosAbertos ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          {filtrosAbertos && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Status/Legenda */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Status/Legenda</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between text-left h-9 text-sm">
                        {filtros.status.length ? `${filtros.status.length} selecionado(s)` : "Selecione um Status"}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2">
                      <div className="space-y-1">
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <label key={value} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer">
                            <Checkbox
                              checked={filtros.status.includes(value)}
                              onCheckedChange={() => toggleStatus(value)}
                            />
                            <span className="text-sm">{label}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Tipo O.S. */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Tipo O.S./Legenda</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between text-left h-9 text-sm">
                        {filtros.tipoOs.length ? `${filtros.tipoOs.length} selecionado(s)` : "Selecione um Tipo O.S"}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 max-h-64 overflow-auto">
                      <div className="space-y-1">
                        {tiposOs?.map((tipo) => (
                          <label key={tipo.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer">
                            <Checkbox
                              checked={filtros.tipoOs.includes(tipo.id)}
                              onCheckedChange={(checked) =>
                                setFiltros((f) => ({
                                  ...f,
                                  tipoOs: checked ? [...f.tipoOs, tipo.id] : f.tipoOs.filter((id) => id !== tipo.id),
                                }))
                              }
                            />
                            <span className="text-sm">{tipo.nome}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Número O.S. */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Número O.S.</Label>
                  <Input
                    placeholder="Número O.S."
                    value={filtros.numero}
                    onChange={(e) => setFiltros((f) => ({ ...f, numero: e.target.value }))}
                    className="h-9 text-sm bg-yellow-50 border-yellow-200"
                  />
                </div>

                {/* C. Custo */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">C. Custo</Label>
                  <Select
                    value={filtros.centroCustoId?.toString() || ""}
                    onValueChange={(v) => setFiltros((f) => ({ ...f, centroCustoId: v ? parseInt(v) : null }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione um Centro de Custo" />
                    </SelectTrigger>
                    <SelectContent>
                      {centrosCusto?.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id.toString()}>
                          {cc.codigo} - {cc.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Recuperado */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Recuperado</Label>
                  <Select
                    value={filtros.recuperado === null ? "" : filtros.recuperado.toString()}
                    onValueChange={(v) => setFiltros((f) => ({ ...f, recuperado: v === "" ? null : v === "true" }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Referência O.S. */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Referência O.S.</Label>
                  <Input
                    placeholder="Número O.S."
                    value={filtros.referenciaOs}
                    onChange={(e) => setFiltros((f) => ({ ...f, referenciaOs: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Data Inicial */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Data Inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left h-9 text-sm font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filtros.dataInicial ? format(filtros.dataInicial, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filtros.dataInicial || undefined}
                        onSelect={(date) => setFiltros((f) => ({ ...f, dataInicial: date || null }))}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Data Final */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left h-9 text-sm font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filtros.dataFinal ? format(filtros.dataFinal, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filtros.dataFinal || undefined}
                        onSelect={(date) => setFiltros((f) => ({ ...f, dataFinal: date || null }))}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Palavra Chave */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Palavra Chave</Label>
                  <Input
                    placeholder="Palavra Chave"
                    value={filtros.palavraChave}
                    onChange={(e) => setFiltros((f) => ({ ...f, palavraChave: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Oficina/Autopeças */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Oficina/Autopeças</Label>
                  <Select
                    value={filtros.fornecedorId?.toString() || ""}
                    onValueChange={(v) => setFiltros((f) => ({ ...f, fornecedorId: v ? parseInt(v) : null }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione um Fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores?.map((f) => (
                        <SelectItem key={f.id} value={f.id.toString()}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Nº Compra */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Nº Compra</Label>
                  <Input
                    placeholder="Compra"
                    value={filtros.numeroCompra}
                    onChange={(e) => setFiltros((f) => ({ ...f, numeroCompra: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Com Pendência */}
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2 h-9 cursor-pointer">
                    <Checkbox
                      checked={filtros.comPendencia}
                      onCheckedChange={(checked) => setFiltros((f) => ({ ...f, comPendencia: !!checked }))}
                    />
                    <span className="text-sm">Com Pendência(s)</span>
                  </label>
                </div>

                {/* Loja */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Loja</Label>
                  <Select
                    value={filtros.lojaId?.toString() || ""}
                    onValueChange={(v) => setFiltros((f) => ({ ...f, lojaId: v ? parseInt(v) : null }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione uma Loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {lojas?.map((l) => (
                        <SelectItem key={l.id} value={l.id.toString()}>
                          {l.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Placa Veículo / Prefixo */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Placa Veículo / Prefixo</Label>
                  <Input
                    placeholder="PLACA"
                    value={filtros.placaPrefixo}
                    onChange={(e) => setFiltros((f) => ({ ...f, placaPrefixo: e.target.value.toUpperCase() }))}
                    className="h-9 text-sm uppercase"
                  />
                </div>

                {/* Montadora */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Montadora</Label>
                  <Input
                    placeholder="Selecione uma Marca"
                    value={filtros.montadora}
                    onChange={(e) => setFiltros((f) => ({ ...f, montadora: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Modelo */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Modelo</Label>
                  <Input
                    placeholder="Selecione um Modelo"
                    value={filtros.modelo}
                    onChange={(e) => setFiltros((f) => ({ ...f, modelo: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Contrato */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Contrato</Label>
                  <Input
                    placeholder="Contrato"
                    value={filtros.contratoId?.toString() || ""}
                    onChange={(e) => setFiltros((f) => ({ ...f, contratoId: e.target.value ? parseInt(e.target.value) : null }))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Informação de Pagamento */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Informação de Pagamento</Label>
                  <Select
                    value={filtros.infoPagamento}
                    onValueChange={(v) => setFiltros((f) => ({ ...f, infoPagamento: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_aberto">Em aberto</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="cortesia">Cortesia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Peça (estoque) */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Peça (estoque)</Label>
                  <Input
                    placeholder="Selecione uma Peça"
                    value={filtros.pecaEstoque}
                    onChange={(e) => setFiltros((f) => ({ ...f, pecaEstoque: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Categoria Veículo */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Categoria Veículo</Label>
                  <Input
                    placeholder="Selecione"
                    value={filtros.categoriaVeiculo}
                    onChange={(e) => setFiltros((f) => ({ ...f, categoriaVeiculo: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Cliente */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Cliente</Label>
                  <Input
                    placeholder="Selecione um cliente"
                    value={filtros.clienteId?.toString() || ""}
                    onChange={(e) => setFiltros((f) => ({ ...f, clienteId: e.target.value ? parseInt(e.target.value) : null }))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Tipo Atendimento */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Tipo Atendimento</Label>
                  <Select
                    value={filtros.tipoAtendimento || ""}
                    onValueChange={(v) => setFiltros((f) => ({ ...f, tipoAtendimento: (v as TipoAtendimento) || null }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione um Tipo Atendimento" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(tipoAtendimentoLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mecânico */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Mecânico</Label>
                  <Select
                    value={filtros.mecanicoId?.toString() || ""}
                    onValueChange={(v) => setFiltros((f) => ({ ...f, mecanicoId: v ? parseInt(v) : null }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione um mecânico" />
                    </SelectTrigger>
                    <SelectContent>
                      {mecanicos?.map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Classificação Serviço */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-600">Classificação Serviço</Label>
                  <Select
                    value={filtros.classificacaoServicoId?.toString() || ""}
                    onValueChange={(v) => setFiltros((f) => ({ ...f, classificacaoServicoId: v ? parseInt(v) : null }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione uma classificação" />
                    </SelectTrigger>
                    <SelectContent>
                      {classificacoes?.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Botões de ação dos filtros */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
                  <Search className="mr-2 h-4 w-4" />
                  Pesquisar
                </Button>
                <Button variant="outline" onClick={limparFiltros}>
                  <X className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
                <Button variant="outline" className="text-teal-600 border-teal-300 hover:bg-teal-50">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Pagamento
                </Button>
                <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir Pagamento
                </Button>
                <Button variant="outline" className="text-slate-600">
                  <FileText className="mr-2 h-4 w-4" />
                  Controle Aceites
                </Button>
                <Button variant="outline" className="text-blue-600 border-blue-300 hover:bg-blue-50">
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  Relatórios
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Agrupamento */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Agrupar por:</span>
          <Select value={groupBy || ""} onValueChange={(v) => setGroupBy(v || null)}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder="Sem agrupamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem agrupamento</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="tipo">Tipo O.S.</SelectItem>
              <SelectItem value="loja">Loja</SelectItem>
              <SelectItem value="fornecedor">Fornecedor</SelectItem>
              <SelectItem value="centroCusto">Centro de Custo</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-500 ml-auto">{total} registro(s)</span>
        </div>

        {/* Tabela */}
        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-800 text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-10">
                    <Checkbox />
                  </th>
                  <th className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-blue-700" onClick={() => handleSort("status")}>
                    <div className="flex items-center gap-1">Status Pgto <SortIcon column="status" /></div>
                  </th>
                  <th className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-blue-700" onClick={() => handleSort("tipo_os_id")}>
                    <div className="flex items-center gap-1">Tipo <SortIcon column="tipo_os_id" /></div>
                  </th>
                  <th className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-blue-700" onClick={() => handleSort("numero")}>
                    <div className="flex items-center gap-1">No. <SortIcon column="numero" /></div>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Tipo Atendi...</th>
                  <th className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-blue-700" onClick={() => handleSort("data")}>
                    <div className="flex items-center gap-1">Data Abert... <SortIcon column="data" /></div>
                  </th>
                  <th className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-blue-700" onClick={() => handleSort("data_final")}>
                    <div className="flex items-center gap-1">Data Finali... <SortIcon column="data_final" /></div>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Placa</th>
                  <th className="px-3 py-2 text-left font-medium">Pr...</th>
                  <th className="px-3 py-2 text-left font-medium">Modelo</th>
                  <th className="px-3 py-2 text-left font-medium">KM</th>
                  <th className="px-3 py-2 text-left font-medium">Pos. Op.</th>
                  <th className="px-3 py-2 text-left font-medium">Oficina</th>
                  <th className="px-3 py-2 text-left font-medium">Centro Custo</th>
                  <th className="px-3 py-2 text-left font-medium">Nota Fiscal</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={16} className="px-3 py-8 text-center text-slate-500">
                      Carregando...
                    </td>
                  </tr>
                ) : groupedData.groups.length === 0 || groupedData.groups.every((g) => g.items.length === 0) ? (
                  <tr>
                    <td colSpan={16} className="px-3 py-8 text-center text-slate-500">
                      Sem dados
                    </td>
                  </tr>
                ) : (
                  groupedData.groups.map((group) => (
                    <>
                      {groupBy && (
                        <tr key={`group-${group.key}`} className="bg-slate-100">
                          <td colSpan={16} className="px-3 py-2 font-semibold text-slate-700">
                            {group.key} ({group.items.length})
                          </td>
                        </tr>
                      )}
                      {group.items.map((os) => (
                        <tr
                          key={os.id}
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                          onDoubleClick={() => navigate({ to: `/ordens-servico/${os.id}` })}
                        >
                          <td className="px-3 py-2">
                            <Checkbox />
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs">
                              {os.status_pagamento === "pago" ? "Pago" : os.status_pagamento === "cortesia" ? "Cortesia" : "Em aberto"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs">{os.tipo_os?.nome}</td>
                          <td className="px-3 py-2 font-medium text-blue-700">{os.numero}</td>
                          <td className="px-3 py-2 text-xs">
                            {os.tipo_atendimento ? tipoAtendimentoLabels[os.tipo_atendimento] : "-"}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {os.data ? format(new Date(os.data + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {os.data_final ? format(new Date(os.data_final + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                          </td>
                          <td className="px-3 py-2 font-medium">{os.veiculo?.placa}</td>
                          <td className="px-3 py-2 text-xs">{os.veiculo?.prefixo || "-"}</td>
                          <td className="px-3 py-2 text-xs">{os.veiculo?.modelo || "-"}</td>
                          <td className="px-3 py-2 text-xs">{os.km?.toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-2 text-xs">
                            {os.posicao_final?.codigo || os.posicao_inicial?.codigo || "-"}
                          </td>
                          <td className="px-3 py-2 text-xs truncate max-w-[120px]" title={os.fornecedor?.nome}>
                            {os.fornecedor?.nome}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {os.centro_custo ? `${os.centro_custo.codigo}` : "-"}
                          </td>
                          <td className="px-3 py-2 text-xs">{os.nota_fiscal || "-"}</td>
                          <td className="px-3 py-2 text-right font-medium">
                            R$ {parseFloat(os.total_os || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
              <span className="text-sm text-slate-600">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}