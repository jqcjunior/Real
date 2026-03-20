import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Armazenamento temporário em memória para arquivos
const fileCache = new Map<string, { buffer: Buffer, fileName: string, timestamp: number }>();

// Limpeza periódica do cache (arquivos com mais de 30 minutos)
setInterval(() => {
  const now = Date.now();
  for (const [id, file] of fileCache.entries()) {
    if (now - file.timestamp > 30 * 60 * 1000) {
      fileCache.delete(id);
    }
  }
}, 5 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API para buscar o template do Google Sheets sem problemas de CORS
  app.get("/api/proxy-template", async (req, res) => {
    const sheetId = "1KXTNAm9F8Pabw-aTGaspH2tJc7EVUsP5oAsVmm3QRCA";
    const urls = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=xlsx`,
      `https://docs.google.com/spreadsheet/ccc?key=${sheetId}&output=xlsx`,
      `https://docs.google.com/spreadsheets/u/0/d/${sheetId}/export?format=xlsx`
    ];

    for (const url of urls) {
      try {
        console.log(`[Proxy] Tentando buscar template: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,text/html'
          },
          redirect: 'follow'
        });

        const contentType = response.headers.get('content-type') || '';
        console.log(`[Proxy] Resposta (${url}): ${response.status} ${response.statusText}`);
        console.log(`[Proxy] Content-Type: ${contentType}`);

        const buffer = await response.arrayBuffer();
        
        if (response.ok && !contentType.includes('text/html') && buffer.byteLength > 5000) {
          const firstBytes = Buffer.from(buffer.slice(0, 4));
          if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4B) {
            console.log(`[Proxy] Template obtido com sucesso! (${buffer.byteLength} bytes)`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=template.xlsx');
            return res.send(Buffer.from(buffer));
          }
        } 
        
        if (contentType.includes('text/html')) {
          const htmlSnippet = Buffer.from(buffer).toString('utf8').substring(0, 1000);
          console.warn(`[Proxy] URL ${url} retornou HTML. Início: ${htmlSnippet.substring(0, 100)}...`);
          
          // Se for o aviso de "Virus Scan" do Google, ele tem um link com "confirm="
          if (htmlSnippet.includes('confirm=')) {
            const match = htmlSnippet.match(/href="([^"]+confirm=[^"]+)"/);
            if (match) {
              const confirmUrl = match[1].replace(/&amp;/g, '&');
              console.log(`[Proxy] Detectado aviso de vírus. Tentando link de confirmação: ${confirmUrl}`);
              // Recursão simples para tentar o link de confirmação (opcional, mas arriscado)
            }
          }
        }
      } catch (err) {
        console.error(`[Proxy] Erro ao tentar ${url}:`, err);
      }
    }

    console.error("[Proxy] Todas as tentativas de buscar o template falharam.");
    res.status(403).send("Não foi possível baixar a planilha do Google. O Google pode estar bloqueando o acesso automatizado. Por favor, anexe o arquivo .xlsx diretamente no chat para que eu possa salvá-lo no sistema.");
  });

  // Endpoint para receber o arquivo do cliente e gerar um link de download direto
  app.post("/api/prepare-download", express.json({ limit: '50mb' }), (req, res) => {
    try {
      const { base64, fileName } = req.body;
      if (!base64 || !fileName) {
        return res.status(400).send("Dados incompletos");
      }

      const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const buffer = Buffer.from(base64, 'base64');
      
      fileCache.set(id, {
        buffer,
        fileName,
        timestamp: Date.now()
      });

      res.json({ id });
    } catch (error) {
      console.error("Erro ao preparar download:", error);
      res.status(500).send("Erro ao preparar download");
    }
  });

  // Endpoint de download direto (GET) para evitar problemas com blob URLs em iframes
  app.get("/api/download-file/:id", (req, res) => {
    const { id } = req.params;
    const file = fileCache.get(id);

    if (!file) {
      return res.status(404).send("Arquivo não encontrado ou link expirado");
    }

    // Cabeçalhos robustos para forçar o download e evitar bloqueios de permissão
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    res.send(file.buffer);
  });

  // Vite middleware para desenvolvimento
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
