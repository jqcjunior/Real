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

  // API para buscar o template do Google Sheets ou OneDrive sem problemas de CORS
  app.get("/api/proxy-template", async (req, res) => {
    const sheetId = "1KXTNAm9F8Pabw-aTGaspH2tJc7EVUsP5oAsVmm3QRCA";
    const oneDriveUrl = "https://1drv.ms/x/c/c6fa712d2b8cf9f7/IQCjnS2HxitQQZ-RatFogEFXAb9KGFQL7fRNm3MgmIWOJ7s?e=tB0BQR";
    
    // Função para converter link do OneDrive em link de download direto
    const getOneDriveDirectLink = (url: string) => {
      const base64Value = Buffer.from(url).toString('base64');
      const encodedUrl = base64Value.replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
      return `https://api.onedrive.com/v1.0/shares/u!${encodedUrl}/root/content`;
    };

    const urls = [
      getOneDriveDirectLink(oneDriveUrl), // Tenta OneDrive primeiro agora
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=xlsx`,
      `https://docs.google.com/spreadsheet/ccc?key=${sheetId}&output=xlsx`,
      `https://docs.google.com/spreadsheets/u/0/d/${sheetId}/export?format=xlsx`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&id=${sheetId}`
    ];

    console.log(`[Proxy] Iniciando busca de template. Prioridade: OneDrive`);

    for (const url of urls) {
      try {
        console.log(`[Proxy] Tentando URL: ${url.substring(0, 100)}...`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,text/html,application/xhtml+xml'
          },
          redirect: 'follow'
        });

        const contentType = response.headers.get('content-type') || '';
        console.log(`[Proxy] Status: ${response.status} | Content-Type: ${contentType}`);

        if (!response.ok) {
          console.warn(`[Proxy] Resposta não OK para URL. Status: ${response.status}`);
          continue;
        }

        const buffer = await response.arrayBuffer();
        console.log(`[Proxy] Tamanho do buffer: ${buffer.byteLength} bytes`);
        
        // Verificação robusta de arquivo ZIP (XLSX é um ZIP)
        if (buffer.byteLength > 5000) {
          const firstBytes = Buffer.from(buffer.slice(0, 4));
          // Assinatura PK (0x50 0x4B 0x03 0x04)
          if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4B) {
            console.log(`[Proxy] Assinatura PK detectada. Enviando buffer...`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=template.xlsx');
            res.setHeader('Content-Length', buffer.byteLength);
            return res.send(Buffer.from(buffer));
          } else {
            console.warn(`[Proxy] Buffer não possui assinatura PK. Primeiros bytes: ${firstBytes.toString('hex')}`);
          }
        } else {
          console.warn(`[Proxy] Buffer muito pequeno (${buffer.byteLength} bytes). Provavelmente erro ou página de login.`);
        }
        
        if (contentType.includes('text/html')) {
          const htmlSnippet = Buffer.from(buffer).toString('utf8').substring(0, 500);
          console.warn(`[Proxy] Recebido HTML em vez de XLSX. Snippet: ${htmlSnippet.replace(/\s+/g, ' ')}`);
        }
      } catch (err) {
        console.error(`[Proxy] Erro fatal ao tentar URL:`, err);
      }
    }

    console.error("[Proxy] Falha total: Nenhuma URL retornou um XLSX válido.");
    res.status(403).send("O servidor não conseguiu baixar o template (OneDrive/Google). Certifique-se de que o arquivo está compartilhado corretamente. Se o erro persistir, use o botão 'Carregar Template Local' no sistema.");
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
