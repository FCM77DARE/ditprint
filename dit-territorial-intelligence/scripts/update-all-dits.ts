import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { reporterAgent } from '../server/agents/reporterAgent';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const monthMap: Record<string, string> = {
  'JANEIRO': '01', 'FEVEREIRO': '02', 'MARCO': '03', 'ABRIL': '04', 'MAIO': '05', 'JUNHO': '06',
  'JULHO': '07', 'AGOSTO': '08', 'SETEMBRO': '09', 'OUTUBRO': '10', 'NOVEMBRO': '11', 'DEZEMBRO': '12',
  'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04', 'MAI': '05', 'JUN': '06',
  'JUL': '07', 'AGO': '08', 'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12'
};

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const files = fs.readdirSync(process.cwd()).filter(f => f.startsWith('DIT_') && f.endsWith('.md'));
  
  console.log(`Encontrados ${files.length} relatórios para atualização.`);

  for (const file of files) {
    console.log(`\nProcessando ${file}...`);
    
    // Parse filename: DIT_SLUG_MES_ANO.md
    const parts = file.replace('.md', '').split('_');
    if (parts.length < 4) {
      console.log(`Pulando ${file} (formato inesperado)`);
      continue;
    }

    const slug = parts[1].toLowerCase();
    const monthName = parts[2].toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const year = parts[3];
    const month = monthMap[monthName];

    if (!month) {
      console.log(`Mês não reconhecido: ${monthName} em ${file}`);
      continue;
    }

    const period = `${year}-${month}`;
    
    // 1. Achar território no DB
    const territory = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1).then(r=>r[0]);
    if (!territory) {
      console.log(`Território ${slug} não encontrado no DB.`);
      continue;
    }

    // 2. Gerar seção de fontes
    console.log(`Gerando fontes para ${territory.name} em ${period}...`);
    const sourcesSection = await reporterAgent.generateSourcesSection(territory.id, period);

    // 3. Atualizar arquivo
    let content = fs.readFileSync(file, 'utf-8');
    
    // Se já tiver a seção, remover a antiga para evitar duplicatas
    const splitKey1 = "## 4. Metodologia e Fontes Coletadas";
    const splitKey2 = "## 4. Metodologia e Inteligência Conectada";
    if (content.includes(splitKey1)) {
      content = content.split(splitKey1)[0].trim();
    } else if (content.includes(splitKey2)) {
      content = content.split(splitKey2)[0].trim();
    }
    
    // Remover o "Confidencial" do final se existir para colocar antes das fontes ou depois
    const confidentialityLine = "*Confidencial - Gerado pela Inteligência DIT PRINT*";
    content = content.replace(confidentialityLine, "").trim();

    const newContent = content + "\n\n" + sourcesSection + "\n---\n" + confidentialityLine + "\n";
    
    fs.writeFileSync(file, newContent);
    console.log(`✅ ${file} atualizado!`);
  }

  console.log(`\nFim da atualização retroativa.`);
  process.exit(0);
}

run().catch(console.error);
