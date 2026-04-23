import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import fs from "fs";

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

  // Middleware para JSON com limite maior para pedidos grandes
  app.use(express.json({ limit: '50mb' }));

  // Endpoint para exportação de pedido de compra via Python/OpenPyXL
  app.post("/api/export-buy-order-excel", async (req, res) => {
    try {
      const { order, items, subOrders } = req.body;
      if (!order) return res.status(400).send("Dados do pedido ausentes");

      const templatePath = path.join(__dirname, 'public', 'templates', 'buy_order_template.xlsx');
      const outputPath = path.join(__dirname, 'temp', `export_${Date.now()}.xlsx`);
      const scriptPath = path.join(__dirname, 'scripts', 'export_buy_order.py');

      // Garantir que a pasta temp existe
      if (!fs.existsSync(path.join(__dirname, 'temp'))) {
        fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
      }

      const orderJson = JSON.stringify(order);
      const itemsJson = JSON.stringify(items || []);
      const subOrdersJson = JSON.stringify(subOrders || []);

      // Comando Python - usando escape simples para os argumentos JSON
      // PS: Em produção, o controle de argumentos via shell deve ser robusto
      const command = `python3 "${scriptPath}" "${templatePath}" "${outputPath}" '${orderJson}' '${itemsJson}' '${subOrdersJson}'`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error("Erro ao executar script Python:", stderr);
          // Se falhar o Python (ex: falta openpyxl), podemos tentar um fallback ou retornar o erro
          return res.status(500).json({ error: "Erro na geração do Excel via Python", details: stderr });
        }

        try {
          const result = JSON.parse(stdout);
          if (result.status === 'success' && fs.existsSync(outputPath)) {
            const buffer = fs.readFileSync(outputPath);
            const fileName = `Pedido_${order.numero_pedido || 'Novo'}.xlsx`;
            
            // Armazena no cache para download direto (evita problemas de Blob em iFrame)
            const id = Math.random().toString(36).substring(2, 15);
            fileCache.set(id, { buffer, fileName, timestamp: Date.now() });

            // Remove o arquivo temporário
            fs.unlinkSync(outputPath);

            res.json({ success: true, downloadId: id });
          } else {
            res.status(500).json({ error: "Falha na geração do arquivo", details: result.message });
          }
        } catch (e) {
          console.error("Erro ao parsear saída do Python:", stdout);
          res.status(500).json({ error: "Saída inválida do gerador", details: stdout });
        }
      });

    } catch (error) {
      console.error("Erro na rota de exportação:", error);
      res.status(500).send("Erro interno ao exportar pedido");
    }
  });

  // Endpoint para receber o arquivo do cliente e gerar um link de download direto
  app.post("/api/prepare-download", (req, res) => {
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
