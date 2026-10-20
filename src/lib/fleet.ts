import { normalizePlate } from '@/lib/normalize';
export const fleetFields: Record<string,string> = {plate:'Placa',chassi:'Chassi',fabricante:'Montadora',modelo:'Modelo',pos_operacional:'Posição operacional',status:'Situação',categoria:'Categoria',grupo:'Grupo veículo',ano_modelo:'Ano/modelo',prefixo:'Prefixo',ano:'Ano',estado:'Estado',loja_op:'Loja de operação',loja_proprietaria:'Loja proprietária',idade:'Idade (meses)',final:'Final da placa',reserva:'Veículo reserva',tipo:'Tipo',ano_emplacamento:'Ano emplacamento',status_veiculo:'Status do veículo'};
export function fleetValue(row: Record<string,unknown>, key:string):string {
 const extra = (row['extra_data'] ?? {}) as Record<string,unknown>;
 const keys:Record<string,string>={estado:'Estado',loja_proprietaria:'Loja Proprietária',idade:'Idade (meses)',reserva:'Veículo Reserva',tipo:'Tipo',ano_emplacamento:'Ano Emplacamento',status_veiculo:'Status do Veículo'};
 return String(key==='final' ? normalizePlate(String(row['plate']??'')).slice(-1) : row[key] ?? extra[keys[key]??key] ?? '');
}
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function matchesFleet(row:Record<string,unknown>,filters:Record<string,string>,ageMode='gte') {
 return Object.entries(filters).every(([k,v])=>!v || (k==='idade' ? fleetValue(row,k)!=='' && (ageMode==='gte'?Number(fleetValue(row,k))>=Number(v):Number(fleetValue(row,k))<=Number(v)) : k==='plate' ? normalizePlate(String(row['plate']??'')).includes(normalizePlate(v)) : norm(fleetValue(row,k)).includes(norm(v))));
}
export function canCreateVehicle(role:string){return role==='master'||role==='gerente';}
export function importFleetRow(row:Record<string,unknown>) {
 const plate=normalizePlate(String(row['Placa']??''));
 if(!/^[A-Z]{3}[A-Z0-9]{4}$/.test(plate)) return null;
 const fields:Record<string,string>={prefixo:'Prefixo',loja_op:'Loja Op',pos_operacional:'Pos. Operacional',grupo:'Grupo',categoria:'Categoria',fabricante:'Fabricante',modelo:'Modelo',cor:'Cor',chassi:'Chassi',renavam:'Renavam',status:'Status'};
 const result:Record<string,unknown>={plate,extra_data:Object.fromEntries(Object.entries(row).filter(([,v])=>v!==null&&v!==undefined&&v!==''))};
 for(const [key,label] of Object.entries(fields)) if(row[label]!==null&&row[label]!==undefined&&String(row[label]).trim()) result[key]=String(row[label]).trim();
 for(const [key,label] of Object.entries({km_atual:'Km Atual',ano:'Ano',ano_modelo:'Ano / Modelo',tanque:'Tanque',sgloc_id:'ID'})){const v=row[label];if(v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)))result[key]=Number(v);}
 return result;
}