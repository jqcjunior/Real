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
    // Novo link fornecido pelo usuário com permissão de edição
    const oneDriveUrl = "https://1drv.ms/x/c/c6fa712d2b8cf9f7/IQCjnS2HxitQQZ-RatFogEFXAb9KGFQL7fRNm3MgmIWOJ7s?e=L7Vhwa";
    
    // Função para converter link do OneDrive em link de download direto
    const getOneDriveDirectLink = (url: string) => {
      try {
        // Remove parâmetros de query para garantir um base64 limpo do link de compartilhamento
        const cleanUrl = url.split('?')[0];
        const base64Value = Buffer.from(cleanUrl).toString('base64');
        const encodedUrl = base64Value.replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
        return `https://api.onedrive.com/v1.0/shares/u!${encodedUrl}/root/content`;
      } catch (e) {
        return url;
      }
    };

    const urls = [
      // Estratégia 1: API de Compartilhamento do OneDrive (Mais oficial)
      getOneDriveDirectLink(oneDriveUrl),
      
      // Estratégia 2: Link Direto via parâmetro download=1 (Funciona em muitos casos)
      `${oneDriveUrl.split('?')[0]}?download=1`,
      
      // Estratégia 3: Link Direto via parâmetro e=...&download=1
      `${oneDriveUrl}&download=1`,
      
      // Estratégia 4: Substituição de subdomínio (Específico para alguns tipos de link)
      oneDriveUrl.replace("1drv.ms/x/c/", "1drv.ms/x/u/").replace("?e=", "?download=1&e="),
      
      // Estratégia 5: Link para OneDrive Personal (Formato alternativo)
      `https://onedrive.live.com/download?cid=c6fa712d2b8cf9f7&resid=c6fa712d2b8cf9f7!IQCjnS2HxitQQZ-RatFogEFXAb9KGFQL7fRNm3MgmIWOJ7s&authkey=L7Vhwa`
    ];

    console.log(`[Proxy] Iniciando busca de template EXCLUSIVO OneDrive (Novo Link)`);

    for (const url of urls) {
      try {
        console.log(`[Proxy] Tentando URL: ${url.substring(0, 120)}...`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream'
          },
          redirect: 'follow'
        });

        if (!response.ok) {
          console.warn(`[Proxy] Resposta não OK (${response.status}) para URL: ${url.substring(0, 50)}...`);
          continue;
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';
        
        // Verificação de assinatura PK (0x50 0x4B)
        if (buffer.byteLength > 5000) {
          const firstBytes = Buffer.from(buffer.slice(0, 4));
          if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4B) {
            console.log(`[Proxy] Template OneDrive obtido com SUCESSO! (${buffer.byteLength} bytes)`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=template.xlsx');
            return res.send(Buffer.from(buffer));
          } else {
            const snippet = Buffer.from(buffer.slice(0, 100)).toString('utf8');
            console.warn(`[Proxy] Falha na assinatura PK. Content-Type: ${contentType}. Snippet: ${snippet.substring(0, 50)}...`);
          }
        } else {
          console.warn(`[Proxy] Buffer muito pequeno (${buffer.byteLength} bytes).`);
        }
      } catch (err) {
        console.error(`[Proxy] Erro ao tentar URL OneDrive:`, err);
      }
    }

    console.error("[Proxy] Todas as estratégias de download do OneDrive falharam.");
    res.status(403).send("Não foi possível baixar o template do OneDrive automaticamente. O link pode estar bloqueado ou expirado. Tente carregar o arquivo .xlsx manualmente.");
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
