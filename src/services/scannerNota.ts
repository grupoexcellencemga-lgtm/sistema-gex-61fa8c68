export interface DadosNota {
  fornecedor: string;
  cnpj: string;
  data: string;
  valor: string;
  forma_pagamento: string;
  categoria: string;
  descricao: string;
  itens: string;
  tipo: string;
}

export async function escanearNota(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<DadosNota> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyBbUX8nPwUBnKShovncfsOdEdV6zUGdr-Q';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64
              }
            },
            {
              text: `Analise esta imagem de nota fiscal, cupom fiscal, boleto ou recibo brasileiro.
Extraia as informações e responda SOMENTE com um JSON válido, sem markdown, sem explicações, no formato:
{
  "fornecedor": "nome do estabelecimento ou emissor",
  "cnpj": "CNPJ se visível, senão string vazia",
  "data": "data no formato DD/MM/AAAA",
  "valor": "valor total como número decimal sem R$, ex: 97.96",
  "forma_pagamento": "forma de pagamento se visível, senão string vazia",
  "tipo": "nota_fiscal | cupom_fiscal | boleto | recibo | outro",
  "descricao": "resumo breve do que foi comprado ou pago",
  "itens": "lista resumida dos principais itens separados por vírgula, senão string vazia",
  "categoria": "uma dessas categorias: Alimentação | Transporte | Saúde | Material de Escritório | Tecnologia | Comunicação | Utilidades | Marketing | Outros"
}
Se algum campo não for visível, coloque string vazia. Responda APENAS o JSON.`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao chamar API do Gemini');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return parsed;
}

export async function uploadImagemNota(file: File, despesaId: string): Promise<string | null> {
  const { supabase } = await import('@/integrations/supabase/client');
  const path = `notas-fiscais/${despesaId}/${file.name}`;
  const { error } = await supabase.storage
    .from('documentos')
    .upload(path, file);
  if (error) return null;
  const { data } = supabase.storage.from('documentos').getPublicUrl(path);
  return data.publicUrl;
}
