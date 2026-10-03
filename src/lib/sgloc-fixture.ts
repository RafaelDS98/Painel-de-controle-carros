// Fixture SINTÉTICO que imita o export da "Agenda de Manutenção" do SGLOC. Nenhum dado real de pessoa.
const longIssue = "Veículo apresenta ruído forte na suspensão dianteira ao passar em lombadas.\nCondutor relata também vibração no volante acima de 80 km/h e desgaste irregular nos pneus dianteiros.";

export const sglocFixtureIssue = `${longIssue}${"x".repeat(Math.max(0, 193 - longIssue.length))}`.slice(0, 193);

const badgeYes = '<span class="badge badge-success">Sim</span>';
const badgeEmergency = '<span class="badge badge-danger">Emergencial</span>';
const badgeNormal = '<span class="badge badge-info">Normal</span>';

export const sglocFixtureRows: Record<string, unknown>[] = [
  {
    ID: "1001", "Data Cadastro": "2026-10-01", "Data Atendimento": "05/10/2026", Hora: "10:30:00", Placa: "abc-1d23", Loja: "FI2",
    Modelo: "Furgão Teste", Contato: "Órgão Exemplo A", "Local/Oficina": "Oficina Fictícia Centro Automotivo Ltda", // 40 caracteres
    "Problemas Relatado": sglocFixtureIssue, Observação: 'Cliente pediu "urgente", retirar até 17h, sem lavagem', Operador: "maria exemplo",
    "O.S Externa": "", Realizado: badgeYes, Tipo: badgeEmergency, "OS FORNEC": "5501",
  },
  {
    ID: "1002", "Data Cadastro": "2026-10-02", "Data Atendimento": "06/10/2026", Hora: "08:00", Placa: "ABC1D23", Loja: "FIL",
    Modelo: "Furgão Teste", Contato: "Órgão Exemplo A", "Local/Oficina": "", "Problemas Relatado": "Revisão programada",
    Observação: "", Operador: "MARIA EXEMPLO", "O.S Externa": "", Realizado: "", Tipo: badgeNormal, "OS FORNEC": "",
  },
  {
    // Data de atendimento anterior ao cadastro; mesmo dia/horário que o XYZ9K88.
    ID: "1003", "Data Cadastro": "2026-10-09", "Data Atendimento": "2026-10-07", Hora: "09:00", Placa: "ABC1D23", Loja: "MAT",
    Modelo: "Furgão Teste", Contato: "Órgão Exemplo B", "Local/Oficina": "Oficina Modelo Sul", "Problemas Relatado": "Troca de pastilhas de freio",
    Observação: "-retorno", Operador: "João Teste", "O.S Externa": "", Realizado: badgeYes, Tipo: badgeNormal, "OS FORNEC": "5503",
  },
  {
    ID: "1004", "Data Cadastro": "2026-10-03", "Data Atendimento": "2026-10-07", Hora: "09:00", Placa: "XYZ9K88", Loja: "FI2",
    Modelo: "Picape Exemplo", Contato: "", "Local/Oficina": "oficina modelo sul", "Problemas Relatado": "=HYPERLINK(\"http://exemplo\")",
    Observação: "", Operador: "joão teste", "O.S Externa": "", Realizado: "", Tipo: "", "OS FORNEC": "",
  },
  {
    ID: "1005", "Data Cadastro": "2026-10-03", "Data Atendimento": "", Hora: "manhã", Placa: "QWE4R56", Loja: "FIL",
    Modelo: "", Contato: "Órgão Exemplo C", "Local/Oficina": "", "Problemas Relatado": "", Observação: "", Operador: "",
    "O.S Externa": "", Realizado: "", Tipo: "", "OS FORNEC": "",
  },
  {
    ID: "5 registro(s)", "Data Cadastro": "", "Data Atendimento": "", Hora: "", Placa: "", Loja: "", Modelo: "", Contato: "",
    "Local/Oficina": "", "Problemas Relatado": "", Observação: "", Operador: "", "O.S Externa": "", Realizado: "", Tipo: "", "OS FORNEC": "",
  },
];
