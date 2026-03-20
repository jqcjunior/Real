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

  // API para buscar o template do OneDrive sem problemas de CORS
  app.get("/api/proxy-template", async (req, res) => {
    const oneDriveUrl = "https://1drv.ms/x/c/c6fa712d2b8cf9f7/IQCjnS2HxitQQZ-RatFogEFXAb9KGFQL7fRNm3MgmIWOJ7s?e=tB0BQR";
    
    // Função para converter link do OneDrive em link de download direto
    const getOneDriveDirectLink = (url: string) => {
      // Remove parâmetros de query para garantir um base64 limpo do link de compartilhamento
      const cleanUrl = url.split('?')[0];
      const base64Value = Buffer.from(cleanUrl).toString('base64');
      const encodedUrl = base64Value.replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
      return `https://api.onedrive.com/v1.0/shares/u!${encodedUrl}/root/content`;
    };

    const urls = [
      getOneDriveDirectLink(oneDriveUrl),
      // Link direto alternativo para OneDrive Personal (URL completa)
      `https://api.onedrive.com/v1.0/shares/u!${Buffer.from(oneDriveUrl).toString('base64').replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '')}/root/content`,
      // Variação sem o parâmetro ?e=
      getOneDriveDirectLink(oneDriveUrl.split('?')[0]),
      // Fallback: Tenta o link original com parâmetro de download
      `${oneDriveUrl.split('?')[0]}?download=1`,
      `${oneDriveUrl}&download=1`,
      // Link de download direto para OneDrive Business/Personal (outro formato)
      oneDriveUrl.replace("1drv.ms/x/c/", "1drv.ms/x/u/").replace("?e=", "?download=1&e="),
      // Link para OneDrive Personal (outro formato comum)
      `https://onedrive.live.com/download?cid=${oneDriveUrl.split('/')[5] || ''}&resid=${oneDriveUrl.split('/')[6] || ''}&authkey=${oneDriveUrl.split('e=')[1] || ''}`
    ];

    console.log(`[Proxy] Iniciando busca de template EXCLUSIVO OneDrive`);

    for (const url of urls) {
      try {
        console.log(`[Proxy] Tentando URL: ${url.substring(0, 100)}...`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream'
          },
          redirect: 'follow'
        });

        if (!response.ok) {
          console.warn(`[Proxy] Resposta não OK (${response.status}). Pulando...`);
          continue;
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';
        
        if (buffer.byteLength > 5000) {
          const firstBytes = Buffer.from(buffer.slice(0, 4));
          if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4B) {
            console.log(`[Proxy] Template OneDrive obtido com sucesso! (${buffer.byteLength} bytes)`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=template.xlsx');
            return res.send(Buffer.from(buffer));
          } else {
            console.warn(`[Proxy] Buffer não possui assinatura PK. Content-Type: ${contentType}. Primeiros 100 bytes: ${Buffer.from(buffer.slice(0, 100)).toString('utf8')}`);
          }
        } else {
          console.warn(`[Proxy] Buffer muito pequeno (${buffer.byteLength} bytes). Provavelmente erro ou página de login.`);
        }
      } catch (err) {
        console.error(`[Proxy] Erro ao tentar URL OneDrive:`, err);
      }
    }

    console.error("[Proxy] Todas as tentativas de buscar o template no OneDrive falharam.");
    res.status(403).send("Não foi possível baixar o template do OneDrive automaticamente. Por favor, baixe o arquivo .xlsx manualmente e use o botão 'Carregar Template Local' no sistema.");
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
