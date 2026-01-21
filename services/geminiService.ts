
// Fix: Use correct import for GoogleGenAI and include GenerateContentResponse for typing.
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { MonthlyPerformance, Store } from "../types";

export const analyzePerformance = async (
  performanceData: MonthlyPerformance[],
  stores: Store[],
  userRole: string,
  targetStoreId?: string
): Promise<string> => {
  // Fix: Direct initialization strictly following the rule: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepare context based on role
  let dataContext = "";
  if (userRole === 'MANAGER' && targetStoreId) {
    const myData = performanceData.find(p => p.storeId === targetStoreId);
    const myStore = stores.find(s => s.id === targetStoreId);
    dataContext = `Você está analisando os dados da loja: ${myStore?.name}. Dados: ${JSON.stringify(myData)}. 
    O usuário é o GERENTE desta loja. Foque em dicas práticas para atingir a meta, melhorar P.A. e Ticket Médio.`;
  } else {
    // Admin context - aggregate data
    const enrichedData = performanceData.map(p => {
      const store = stores.find(s => s.id === p.storeId);
      return {
        store: store?.name,
        ...p
      };
    });
    dataContext = `Você está analisando os dados GERAIS de todas as lojas para um ADMINISTRADOR. 
    Dados: ${JSON.stringify(enrichedData)}. Identifique lojas com baixo desempenho (Meta < 90%) e sugira ações corporativas.`;
  }

  const prompt = `
    Atue como um consultor sênior de varejo.
    Analise os seguintes dados de metas e performance.
    
    ${dataContext}
    
    Forneça uma análise concisa (máximo 3 parágrafos). Use formatação Markdown.
    Destaque pontos críticos (positivos e negativos).
    Dê 2 sugestões táticas imediatas.
  `;

  try {
    // Fix: Explicitly typing the response from models.generateContent.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Fix: Using the .text property directly
    return response.text || "Não foi possível gerar análise.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com a inteligência artificial. Tente novamente mais tarde.";
  }
};

// Interface para retorno da extração de PDF
export interface ExtractedPDFData {
  storeNumber: string;
  pa: number;
  pu: number;
  ticket: number;
  percentMeta: number;
  month: string;
}

export const extractDataFromDocument = async (base64Data: string, mimeType: string): Promise<ExtractedPDFData[]> => {
    // Fix: Direct initialization strictly following the rule: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
        Analise este documento (Relatório de Vendas). 
        Extraia os dados da tabela principal ignorando cabeçalhos e totais.
        
        Procure especificamente pelas colunas que correspondem a:
        - Loja (Número)
        - P.A. (Peças por Atendimento)
        - P.U. (Preço Unitário)
        - Ticket Médio
        - Percentual da Meta (Atingimento)
        
        Identifique o Mês de Referência no documento (geralmente no topo ou cabeçalho, ex: NOVEMBRO, DEZEMBRO). Converta para formato YYYY-MM (considere ano atual se não tiver ano).

        Retorne APENAS um JSON array válido (sem markdown, sem \`\`\`json).
        Cada objeto deve ter:
        {
            "storeNumber": "string (apenas números, sem zeros a esquerda)",
            "pa": number (float, converta virgula para ponto),
            "pu": number (float),
            "ticket": number (float),
            "percentMeta": number (float, ex: 90.5),
            "month": "string (YYYY-MM)"
        }
    `;

    try {
        // Fix: Explicitly typing the response from models.generateContent.
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64Data } },
                    { text: prompt }
                ]
            }
        });

        // Fix: Using the .text property directly
        const text = response.text || "[]";
        // Limpar markdown code blocks se a IA colocar
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("PDF Extraction Error:", error);
        throw new Error("Falha ao ler dados do PDF via IA.");
    }
};

export const generateMarketingImage = async (
    base64Input: string, 
    mimeType: string, 
    aspectRatio: '1:1' | '9:16', 
    style: 'promo' | 'lifestyle'
): Promise<string | undefined> => {
    // Fix: Direct initialization strictly following the rule: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // We use gemini-3-pro-image-preview for highest quality generation
    const modelName = 'gemini-3-pro-image-preview'; 

    let prompt = `
        Create a high-end, hyper-realistic commercial advertising photography based on the input shoe image.
        
        KEY INSTRUCTIONS:
        1. PRESERVE THE SHOE: The shoe in the input image MUST remain the exact same product. Do not change the shoe's design, color, or shape.
        2. BACKGROUND: Place the shoe in a professional studio setting or a luxury modern retail environment. 
           ${style === 'promo' ? 'Use bright, energetic lighting suitable for a sale or promotion. Vibrant atmosphere.' : 'Use elegant, dramatic lighting suitable for a high-fashion magazine.'}
        3. QUALITY: 4k resolution, photorealistic, cinematic lighting, sharp focus on the product.
        4. COMPOSITION: Center the product. Ensure there is negative space at the bottom for text/logos.
        
        Do NOT add any text, logos, or price tags in the generated image. The image should be clean.
    `;

    try {
        // Fix: Explicitly typing the response from models.generateContent.
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    { 
                        inlineData: { 
                            mimeType: mimeType, 
                            data: base64Input 
                        } 
                    },
                    { text: prompt }
                ]
            },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio === '1:1' ? '1:1' : '9:16',
                    imageSize: '2K' 
                }
            }
        });

        // Fix: Finding image part in content parts as per response extraction guidelines.
        // We iterate through all candidates and parts to find inlineData.
        for (const part of response.candidates?.[0]?.content?.parts || []) {
             if (part.inlineData) {
                 return part.inlineData.data;
             }
        }
        return undefined;

    } catch (error) {
        console.error("Image Gen Error:", error);
        // Throw specific error for component to handle API key reset if "Requested entity was not found" occurs.
        throw error;
    }
};
