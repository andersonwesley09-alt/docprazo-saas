'use strict';
// Gerador OOXML/ZIP em Node.js puro, sem dependências externas.
// Dados textuais são serializados como inlineStr: nunca executam fórmulas de clientes.
const zlib = require('node:zlib');
const { Buffer } = require('node:buffer');

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const clean = v => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'');
const xml = v => clean(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const serial = d => d && /^\d{4}-\d\d-\d\d$/.test(d) ? Math.round((Date.parse(d+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000) : null;
const dateBR = iso => iso ? iso.split('-').reverse().join('/') : '—';
const daysUntil = (date,today) => Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
const situation = (d,today) => {const n=daysUntil(d.expires_on,today);return n<0?'Vencido':n===0?'Vence hoje':n<=d.lead_days?'A vencer':'Em dia';};

// CRC-32 padrão PKZIP.
const crcTable = new Uint32Array(256);
for (let i=0;i<256;i++){let n=i;for(let j=0;j<8;j++)n=n&1?0xEDB88320^(n>>>1):n>>>1;crcTable[i]=n>>>0;}
function crc32(buf){let c=0xFFFFFFFF;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function zip(entries){
 const local=[],central=[];let offset=0;
 for(const [name,source] of entries){
  const filename=Buffer.from(name);const original=Buffer.from(source,'utf8');const compressed=zlib.deflateRawSync(original, {level:6});const crc=crc32(original);
  const hdr=Buffer.alloc(30);hdr.writeUInt32LE(0x04034B50,0);hdr.writeUInt16LE(20,4);hdr.writeUInt16LE(0,6);hdr.writeUInt16LE(8,8);hdr.writeUInt32LE(crc,14);hdr.writeUInt32LE(compressed.length,18);hdr.writeUInt32LE(original.length,22);hdr.writeUInt16LE(filename.length,26);
  local.push(hdr,filename,compressed);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014B50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(original.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
  central.push(c,filename);offset+=hdr.length+filename.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054B50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,directory,end]);
}
const cols = [8,40,23,21,25,16,16,16,19,17,13,52];
const letters=n=>{let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const C = (col,row,v,style=0,kind='text') => {
 const addr=letters(col)+row;
 if(v==null||v==='')return `<c r="${addr}" s="${style}"/>`;
 if(kind==='number'||kind==='date')return `<c r="${addr}" s="${style}"><v>${Number(v)}</v></c>`;
 return `<c r="${addr}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
};
function sheetXml(rows,options={}){
 const last=options.endRow||rows.length;
 const widths=(options.widths||cols).map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
 const data=rows.map(r=>`<row r="${r.n}"${r.h?` ht="${r.h}" customHeight="1"`:''}>${r.cells.join('')}</row>`).join('');
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0" showGridLines="0">${options.freeze?`<pane ySplit="${options.freeze}" topLeftCell="A${options.freeze+1}" activePane="bottomLeft" state="frozen"/>`:''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${widths}</cols><sheetData>${data}</sheetData>${options.merges?.length?`<mergeCells count="${options.merges.length}">${options.merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:''}${options.filter?`<autoFilter ref="${options.filter}"/>`:''}<pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.25" footer="0.25"/><pageSetup orientation="landscape" paperSize="9"/></worksheet>`;
}
const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Aptos"/><color rgb="FF1E3251"/></font><font><b/><sz val="21"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="10"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FF0D2546"/></font></fonts>
<fills count="10"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF112D50"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2356D6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF0FF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5FB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE8EA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF0D6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE4F6ED"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="hair"><color rgb="FFDBE4F1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="9" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="7" borderId="1" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="8" borderId="1" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function workbookXml(){return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Documentos" sheetId="1" r:id="rId1"/><sheet name="Resumo" sheetId="2" r:id="rId2"/></sheets></workbook>`;}
function makeXlsx(docs,{company='Empresa',today,scope='Todos os documentos'}={}){
 if(docs.length>20000)throw new Error('A exportação Excel suporta até 20.000 documentos por arquivo. Aplique filtros.');
 const situationCounts={Vencido:0,'Vence hoje':0,'A vencer':0,'Em dia':0};
 const categories=new Map();for(const d of docs){const s=situation(d,today);situationCounts[s]++;categories.set(d.category,(categories.get(d.category)||0)+1);}
 const rows=[
  {n:1,h:31,cells:[C(0,1,'DOCPRAZO  |  CONTROLE DE VENCIMENTOS',1)]},
  {n:2,h:17,cells:[C(0,2,`${company}  •  Gerado em ${dateBR(today)}  •  ${scope}`,1)]},
  {n:4,h:25,cells:[C(0,4,'TOTAL DE DOCUMENTOS',2),C(3,4,'VENCIDOS',2),C(6,4,'EM ALERTA (INCLUI HOJE)',2),C(9,4,'EM DIA',2)]},
  {n:5,h:30,cells:[C(0,5,docs.length,3,'number'),C(3,5,situationCounts.Vencido,8,'number'),C(6,5,situationCounts['A vencer']+situationCounts['Vence hoje'],9,'number'),C(9,5,situationCounts['Em dia'],10,'number')]},
  {n:7,h:21,cells:[C(0,7,`VISÃO: ${scope.toUpperCase()}`,3)]},
 ];
 const header=['#','Documento','Categoria','Referência','Responsável','Emissão','Vencimento','Dias restantes','Alerta (dias)','Situação','Anexos','Observações'];
 rows.push({n:9,h:29,cells:header.map((h,i)=>C(i,9,h,2))});
 docs.forEach((d,i)=>{
  const r=i+10,base=i%2?5:4,dt=serial(d.expires_on),issued=serial(d.issue_date),s=situation(d,today);
  const sStyle=s==='Vencido'||s==='Vence hoje'?8:s==='A vencer'?9:10;
  const values=[i+1,d.title,d.category,d.reference,d.responsible,issued,dt,daysUntil(d.expires_on,today),d.lead_days,s,Number(d.attachment_count||0),d.notes];
  rows.push({n:r,h:24,cells:values.map((v,j)=>C(j,r,v,j===9?sStyle:(j===5||j===6)?(base===4?6:7):base,[0,5,6,7,8,10].includes(j)?j===5||j===6?'date':'number':'text'))});
 });
 const end=Math.max(10,docs.length+9);
 const sheet1=sheetXml(rows,{freeze:9,filter:`A9:L${end}`,merges:['A1:L1','A2:L2','A4:C4','D4:F4','G4:I4','J4:L4','A5:C5','D5:F5','G5:I5','J5:L5','A7:L7'],endRow:end});
 const r2=[{n:1,h:34,cells:[C(0,1,'DOCPRAZO  |  RESUMO DO RELATÓRIO',1)]},
 {n:2,h:24,cells:[C(0,2,company,3)]},{n:3,h:24,cells:[C(0,3,`Emissão: ${dateBR(today)} | ${scope}`,3)]},
 {n:5,h:26,cells:[C(0,5,'INDICADOR',2),C(1,5,'QUANTIDADE',2)]},
 ...[['Total',docs.length],['Vencidos',situationCounts.Vencido],['Vencem hoje',situationCounts['Vence hoje']],['Dentro do alerta',situationCounts['A vencer']],['Em dia',situationCounts['Em dia']]].map(([a,b],i)=>({n:i+6,h:23,cells:[C(0,i+6,a,i%2?5:4),C(1,i+6,b,i%2?5:4,'number')]})),
 {n:12,h:26,cells:[C(0,12,'CATEGORIA',2),C(1,12,'DOCUMENTOS',2)]},
 ...[...categories].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')).map(([a,b],i)=>({n:13+i,h:23,cells:[C(0,13+i,a,i%2?5:4),C(1,13+i,b,i%2?5:4,'number')]}))];
 const sheet2=sheetXml(r2,{widths:[38,22],merges:[],endRow:r2[r2.length-1].n});
 const entries=[
  ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
  ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml',workbookXml()],
  ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
  ['xl/worksheets/sheet1.xml',sheet1],['xl/worksheets/sheet2.xml',sheet2],['xl/styles.xml',styles]
 ];
 return zip(entries);
}
module.exports={makeXlsx,daysUntil,situation};
