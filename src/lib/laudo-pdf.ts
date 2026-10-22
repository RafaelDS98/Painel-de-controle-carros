import { jsPDF } from "jspdf";
import logoAsset from "@/assets/logo-anpexc.png.asset.json";
import { VISTORIA_TERM } from "@/lib/vistoria-term";

export interface LaudoAnswer {
  label: string;
  group_name: string | null;
  kind: string;
  status: string | null;
  value: string | null;
  note: string | null;
  photo_path: string | null;
  photo_taken_at: string | null;
}

export interface LaudoData {
  number: number;
  plate: string;
  operation: string;
  createdAt: string;
  model: string;
  inspector: string;
  client: string;
  driver: string;
  km: number | null;
  fuel: string | null;
  notes: string | null;
  questionnaire: string;
  validationCode: string;
  details: Record<string, string>;
  answers: LaudoAnswer[];
  urls: Record<string, string>;
  inspectorSignature: string | null;
  driverSignature: string | null;
}

const FUEL_LEVEL: Record<string, number> = {
  Reserva: 0.06,
  "1/4": 0.25,
  "1/2": 0.5,
  "3/4": 0.75,
  Cheio: 1,
};
const STATUS_COLOR: Record<string, [number, number, number]> = {
  bom: [34, 160, 80],
  ruim: [210, 50, 50],
  atencao: [230, 170, 20],
  na: [150, 150, 150],
};
const STATUS_MARK: Record<string, string> = { bom: "OK", ruim: "X", atencao: "!", na: "N/A" };

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((ok) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as string);
      r.onerror = () => ok(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(",", "");

/** Laudo no mesmo formato do VEX: dados principais, checklist, fotos, termo, assinaturas e código. */
export async function buildLaudoPdf(d: LaudoData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 14;
  const logo = await toDataUrl(logoAsset.url);
  const img = async (p: string | null) => (p && d.urls[p] ? toDataUrl(d.urls[p]) : null);
  let y = 0;

  const newPage = (first = false) => {
    if (!first) doc.addPage();
    y = 42;
  };
  const ensure = (h: number) => {
    if (y + h > 280) newPage();
  };
  const field = (x: number, w: number, label: string, value: string) => {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(30);
    const lab = doc.splitTextToSize(label, w - 2);
    doc.text(lab, x, y);
    doc.setFont("helvetica", "normal").setTextColor(60);
    doc.text(doc.splitTextToSize(value || "—", w - 2), x, y + lab.length * 3.2);
    doc
      .setDrawColor(225)
      .line(x, y + lab.length * 3.2 + 2.5, x + w - 4, y + lab.length * 3.2 + 2.5);
  };
  const row = (cols: [string, string][], h = 11, widths?: number[]) => {
    ensure(h);
    let x = M;
    cols.forEach(([l, v], i) => {
      const w = widths?.[i] ?? 45;
      field(x, w, l, v);
      x += w;
    });
    y += h;
  };

  // Página 1 — Dados principais
  newPage(true);
  doc.setFont("helvetica", "normal").setFontSize(15).setTextColor(20);
  doc.text("Dados Principais", M, y);
  y += 8;
  row([
    ["Tipo Operação", d.operation.toUpperCase()],
    ["Data/Hora", fmt(d.createdAt)],
  ]);
  row(
    [
      ["VEICULO", d.model.toUpperCase()],
      ["PLACA", d.plate],
    ],
    11,
    [90, 30],
  );
  // Marcador de combustível ao lado da placa
  {
    const gx = 135,
      gy = y - 14,
      gw = 60;
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(40);
    ["E", "1/4", "1/2", "3/4", "F"].forEach((t, i) =>
      doc.text(t, gx + (gw * i) / 4, gy, { align: "center" }),
    );
    doc.setFillColor(225).rect(gx, gy + 2, gw, 3, "F");
    const lvl = d.fuel ? (FUEL_LEVEL[d.fuel] ?? 0) : 0;
    doc.setFillColor(40, 120, 200).rect(gx, gy + 2, gw * lvl, 3, "F");
    doc.setFillColor(170, 20, 30).rect(gx, gy + 2, 2.5, 3, "F");
  }
  const det = d.details;
  row([
    ["VISTORIADOR", d.inspector.toUpperCase()],
    ["CLIENTE", d.client.toUpperCase()],
  ]);
  row(
    [
      ["Motorista", d.driver.toUpperCase()],
      ["Pertences Retirados", det["pertences"] ?? ""],
      ["Km Odometro", d.km != null ? `${d.km} Km` : ""],
      ["Whatsapp do Cliente", det["whatsapp"] ?? ""],
    ],
    12,
  );
  row(
    [
      ["Pneu Dianteiro Esquerdo", det["pneu_de"] ?? ""],
      ["Pneu Dianteiro Direito", det["pneu_dd"] ?? ""],
      ["Pneu Traseiro Esquerdo", det["pneu_te"] ?? ""],
      ["Pneu Traseiro Direito", det["pneu_td"] ?? ""],
    ],
    14,
  );
  row([["Pneu Estepe", det["pneu_estepe"] ?? ""]]);
  row([["Observacao", d.notes ?? ""]], 12, [180]);
  row(
    [
      ["Avaliação Técnica", ""],
      ["Pertences retirados?", (det["pertences"] ?? "").toUpperCase()],
    ],
    11,
    [90, 90],
  );
  row(
    [
      ["Tipo de Veículo?", det["tipo_veiculo"] ?? ""],
      ["Câmbio", det["cambio"] ?? ""],
    ],
    11,
    [90, 90],
  );

  // Questionário
  ensure(20);
  doc.setDrawColor(200).line(M, y, W - M, y);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(14).setTextColor(20);
  doc.text(`Questionário: ${d.questionnaire}`, M, y);
  y += 6;
  const checks = d.answers.filter((a) => a.kind !== "photo");
  const groups = [...new Set(checks.map((a) => a.group_name ?? "Checklist"))];
  for (const g of groups) {
    ensure(18);
    doc.setFontSize(9).setTextColor(60).text(`Grupo - ${g}`, M, y);
    y += 3;
    const items = checks.filter((a) => (a.group_name ?? "Checklist") === g);
    const cw = (W - 2 * M) / 3;
    for (let i = 0; i < items.length; i += 3) {
      ensure(12);
      items.slice(i, i + 3).forEach((a, j) => {
        const x = M + j * cw;
        doc.setDrawColor(215).rect(x, y, cw, 11);
        const c = STATUS_COLOR[a.status ?? ""] ?? [200, 200, 200];
        doc.setFillColor(...c).roundedRect(x + 3, y + 2.5, 6, 6, 1, 1, "F");
        doc
          .setFont("helvetica", "bold")
          .setFontSize(a.status === "na" ? 4.5 : 7)
          .setTextColor(255);
        doc.text(a.status ? STATUS_MARK[a.status]! : a.value ? "" : "", x + 6, y + 6.6, {
          align: "center",
        });
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(40);
        const txt = a.status ? a.label : `${a.label}: ${a.value ?? "—"}`;
        doc.text(doc.splitTextToSize(txt, cw - 14).slice(0, 2), x + 12, y + 5);
        if (a.note)
          doc
            .setFontSize(6.5)
            .setTextColor(170, 40, 40)
            .text(doc.splitTextToSize(a.note, cw - 14)[0], x + 12, y + 9);
      });
      y += 11;
    }
    y += 4;
  }

  // Fotos — duas por página, como no laudo atual
  const photos = d.answers.filter((a) => a.photo_path && d.urls[a.photo_path]);
  if (photos.length) {
    newPage();
    doc.setFont("helvetica", "normal").setFontSize(14).setTextColor(20);
    doc.text(`Fotos da ${d.operation.toUpperCase()}`, M, y);
    y += 10;
    const pw = (W - 2 * M - 6) / 2;
    for (let i = 0; i < photos.length; i++) {
      const col = i % 2;
      if (i > 0 && col === 0) newPage();
      const p = photos[i]!;
      const x = M + col * (pw + 6);
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(40);
      doc.text(`${i + 1}/${photos.length} - ${p.label.toUpperCase()}`, x, y);
      const data = await img(p.photo_path);
      if (data) {
        const prop = doc.getImageProperties(data);
        const h = Math.min(160, (pw * prop.height) / prop.width);
        doc.addImage(data, "JPEG", x, y + 3, (h * prop.width) / prop.height, h);
      }
    }
  }

  // Termo de aceite
  newPage();
  doc
    .setFont("helvetica", "normal")
    .setFontSize(14)
    .setTextColor(20)
    .text("Termos de Aceite", M, y);
  y += 8;
  for (const para of VISTORIA_TERM) {
    const heading = /^[A-ZÇÃÕÉÍÓÚÂÊ0-9 .–-]{8,}$/.test(para);
    doc
      .setFont("helvetica", heading ? "bold" : "normal")
      .setFontSize(8)
      .setTextColor(30);
    const lines = doc.splitTextToSize(para, W - 2 * M);
    ensure(lines.length * 3.6 + 2);
    doc.text(lines, M, y);
    y += lines.length * 3.6 + 2;
  }

  // Assinaturas
  newPage();
  const sigs: [string, string | null, string[]][] = [
    [
      "Assinatura RESPONSAVEL",
      d.driverSignature,
      [
        `Nome : ${det["resp_nome"] || d.driver}`,
        `RG: ${det["resp_rg"] ?? ""}`,
        `Telefone: ${det["resp_tel"] ?? ""}`,
      ],
    ],
    ["Assinatura VISTORIADOR", d.inspectorSignature, [`Vistoriador: ${d.inspector.toUpperCase()}`]],
  ];
  for (let i = 0; i < sigs.length; i++) {
    const [label, path, lines] = sigs[i]!;
    const x = M + i * 92;
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(30).text(label, x, y);
    const data = await img(path);
    if (data) doc.addImage(data, "PNG", x, y + 3, 80, 27);
    doc.setDrawColor(150).line(x, y + 32, x + 80, y + 32);
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    lines.forEach((l, k) => doc.text(l, x, y + 38 + k * 5));
  }
  y += 60;
  doc
    .setFontSize(9)
    .setTextColor(60)
    .text(`Valide este laudo pelo código ${d.validationCode} no painel ANPEXC.`, W / 2, y, {
      align: "center",
    });

  // Cabeçalho e rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (logo) doc.addImage(logo, "PNG", M, 8, 22, 22);
    doc
      .setFont("helvetica", "normal")
      .setFontSize(9)
      .setTextColor(90)
      .text(`Página ${p} de ${total}`, W - M, 12, { align: "right" });
    doc.setFillColor(238).rect(W - M - 70, 15, 70, 7, "F");
    doc
      .setFontSize(8)
      .setTextColor(60)
      .text("Nº Vistoria:", W - M - 22, 19.8, { align: "right" });
    doc
      .setFont("helvetica", "bold")
      .setFontSize(10)
      .setTextColor(20)
      .text(String(d.number), W - M - 2, 20, { align: "right" });
    doc.setDrawColor(220).line(M, 287, W - M, 287);
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(120);
    doc.text(`ANPEXC Vistorias · código ${d.validationCode}`, M, 291);
    doc.text("anpexc.app - Todos os direitos reservados", M, 294);
  }
  return doc;
}

export function laudoFileName(plate: string, number: number, createdAt: string): string {
  const dt = new Date(createdAt);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${plate}_${p(dt.getDate())}${p(dt.getMonth() + 1)}${dt.getFullYear()}${p(dt.getHours())}${p(dt.getMinutes())}_${number}.pdf`;
}
