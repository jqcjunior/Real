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
    try {
      const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1KXTNAm9F8Pabw-aTGaspH2tJc7EVUsP5oAsVmm3QRCA/export?format=xlsx";
      
      console.log(`[Proxy] Buscando template: ${GOOGLE_SHEET_URL}`);
      
      const response = await fetch(GOOGLE_SHEET_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        redirect: 'follow'
      });

      const contentType = response.headers.get('content-type');
      console.log(`[Proxy] Resposta do Google: ${response.status} ${response.statusText}`);
      console.log(`[Proxy] Content-Type: ${contentType}`);

      if (!response.ok) {
        console.error(`[Proxy] Erro na resposta do Google: ${response.status}`);
        return res.status(response.status).send(`Erro ao buscar template no Google: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      console.log(`[Proxy] Tamanho do buffer recebido: ${buffer.byteLength} bytes`);

      // Se o Google retornar HTML, provavelmente é uma página de login ou erro
      if (contentType && contentType.includes('text/html')) {
        const htmlContent = Buffer.from(buffer).toString('utf8').substring(0, 500);
        console.error("[Proxy] Google retornou HTML em vez de XLSX.");
        console.error("[Proxy] Início do HTML:", htmlContent);
        
        if (htmlContent.includes('ServiceLogin') || htmlContent.includes('accounts.google.com')) {
          return res.status(403).send("A planilha do Google requer login. Certifique-se de que ela está configurada como 'Qualquer pessoa com o link' (Leitor).");
        }
        return res.status(403).send("O Google retornou uma página de erro ou login em vez do arquivo. Verifique as permissões da planilha.");
      }

      if (buffer.byteLength < 500) {
        console.error("[Proxy] Buffer muito pequeno, provavelmente não é um arquivo XLSX válido.");
        return res.status(500).send("O arquivo retornado pelo Google é muito pequeno ou inválido.");
      }
      
      // Verificar assinatura de arquivo ZIP (PK..)
      const firstBytes = Buffer.from(buffer.slice(0, 4));
      if (firstBytes[0] !== 0x50 || firstBytes[1] !== 0x4B) {
        console.error("[Proxy] O arquivo não possui assinatura ZIP válida (PK).");
        return res.status(500).send("O arquivo retornado pelo Google não é um arquivo Excel (.xlsx) válido.");
      }
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=template.xlsx');
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Erro no proxy do servidor:", error);
      res.status(500).send("Erro interno ao buscar template");
    }
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
