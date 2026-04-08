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

function redimensionarImagem(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const MAX_WIDTH = 800;
    const QUALITY = 0.7;
    const outputMime = 'image/jpeg';

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas nao suportado'));
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL(outputMime, QUALITY);
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType: outputMime });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erro ao carregar imagem'));
    };

    img.src = url;
  });
}

export async function escanearNota(file: File): Promise<DadosNota> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyBRI3KmTr-TxLQ-CDrPWuycmtkM_su_BMg';

  const { base64, mimeType } = await redimensionarImagem(file);

  const prompt = [
    'Analise esta imagem de nota fiscal, cupom fiscal, boleto ou recibo brasileiro.',
    'Extraia as informacoes e responda SOMENTE com um JSON valido, sem markdown, sem explicacoes, no formato:',
    '{',
    '  "fornecedor": "nome do estabelecimento ou emissor",',
    '  "cnpj": "CNPJ se visivel, senao string vazia",',
    '  "data": "data no formato DD/MM/AAAA",',
    '  "valor": "valor total como numero decimal sem R$, ex: 97.96",',
    '  "forma_pagamento": "forma de pagamento se visivel, senao string vazia",',
    '  "tipo": "nota_fiscal | cupom_fiscal | boleto | recibo | outro",',
    '  "descricao": "resumo breve do que foi comprado ou pago",',
    '  "itens": "lista resumida dos principais itens separados por virgula, senao string vazia",',
    '  "categoria": "uma dessas categorias: Alimentacao | Transporte | Saude | Material de Escritorio | Tecnologia | Comunicacao | Utilidades | Marketing | Outros"',
    '}',
    'Se algum campo nao for visivel, coloque string vazia. Responda APENAS o JSON.',
  ].join('\n');

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
                data: base64,
              },
            },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Erro ${response.status}: ${errBody}`);
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
