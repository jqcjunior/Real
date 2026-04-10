import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: false, // Desativa o WebSocket do Vite que está gerando erros no console
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Configurações de otimização
        rollupOptions: {
          output: {
            // Code splitting manual - separa bibliotecas grandes em chunks próprios
            manualChunks: {
              // Chunk 1: React e dependências core (carrega 1x, cache permanente)
              'vendor-react': [
                'react',
                'react-dom',
                'react-router-dom'
              ],
              
              // Chunk 2: Supabase (biblioteca grande, raramente muda)
              'vendor-supabase': [
                '@supabase/supabase-js'
              ],
              
              // Chunk 3: Excel/Planilhas (muito grande, só carrega quando necessário)
              'vendor-excel': [
                'xlsx',
                'jszip'
              ],
              
              // Chunk 4: Gráficos e Charts (se estiver usando)
              // Descomente se você usa bibliotecas de gráficos
              // 'vendor-charts': [
              //   'recharts',
              //   'chart.js'
              // ],
              
              // Chunk 5: Utilitários (lodash, date-fns, etc)
              // Descomente se você usa essas bibliotecas
              // 'vendor-utils': [
              //   'lodash',
              //   'date-fns'
              // ]
            },
            
            // Nomear chunks de forma legível para debug
            chunkFileNames: (chunkInfo) => {
              const facadeModuleId = chunkInfo.facadeModuleId 
                ? chunkInfo.facadeModuleId.split('/').pop() 
                : 'chunk';
              return `assets/[name]-[hash].js`;
            },
            
            // Separar CSS por chunk também
            assetFileNames: (assetInfo) => {
              const info = assetInfo.name?.split('.');
              const ext = info?.[info.length - 1];
              if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name ?? '')) {
                return 'assets/images/[name]-[hash][extname]';
              }
              if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name ?? '')) {
                return 'assets/fonts/[name]-[hash][extname]';
              }
              return 'assets/[name]-[hash][extname]';
            },
          },
        },
        
        // Tamanho mínimo para criar um chunk separado (em KB)
        // Arquivos menores que isso ficam no bundle principal
        minify: 'terser', // Usar terser para melhor compressão
        terserOptions: {
          compress: {
            drop_console: true, // Remove console.log em produção
            drop_debugger: true, // Remove debugger em produção
          },
        },
        
        // Aumentar o limite do aviso (só para não aparecer o warning)
        // IMPORTANTE: Isso só esconde o aviso, o lazy loading é que realmente resolve
        chunkSizeWarningLimit: 1000,
        
        // Ativar source maps apenas em desenvolvimento
        sourcemap: mode === 'development',
      },
      
      // Otimizações de dependências
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-router-dom',
          '@supabase/supabase-js'
        ],
        // Excluir bibliotecas grandes que devem ser code-split
        exclude: [
          'xlsx',
          'jszip'
        ]
      }
    };
});