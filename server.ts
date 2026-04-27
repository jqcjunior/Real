import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import fs from "fs";
import { exportBuyOrderToExcel } from "./services/excelExportService";

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

  // Endpoint para exportação de pedido de compra usando ExcelJS
  app.post("/api/exportar-comprar-ordem-excel", async (req, res) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: 'orderId é obrigatório' });
      }

      console.log(`📦 Exportando pedido: ${orderId}`);

      // Gerar Excel usando o novo serviço ExcelJS
      const excelBuffer = await exportBuyOrderToExcel(orderId);

      const fileName = `Pedido_${orderId}.xlsx`;
      
      // Armazena no cache para download direto (evita problemas de Blob em iFrame)
      const id = Math.random().toString(36).substring(2, 15);
      fileCache.set(id, { buffer: excelBuffer, fileName, timestamp: Date.now() });

      res.json({ success: true, downloadId: id });

    } catch (error: any) {
      console.error('❌ Erro ao exportar Excel:', error);
      res.status(500).json({ 
        error: 'Erro ao gerar Excel',
        message: error.message
      });
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
