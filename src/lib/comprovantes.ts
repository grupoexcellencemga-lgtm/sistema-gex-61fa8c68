import { supabase } from "@/integrations/supabase/client";

// Buckets privados: o acesso exige URL assinada gerada para o usuário logado.
const BUCKETS_PRIVADOS = [
  "comprovantes_matriculas",
  "comprovantes_eventos",
  "comprovantes_reembolsos",
];

// Extrai bucket e caminho de uma URL do Supabase Storage (pública ou assinada).
// O banco guarda URLs no formato público antigo; o caminho continua válido.
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const match = url.match(
    /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/
  );

  if (!match) return null;

  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

export async function resolverUrlComprovante(url: string): Promise<string> {
  const parsed = parseStorageUrl(url);

  if (!parsed || !BUCKETS_PRIVADOS.includes(parsed.bucket)) return url;

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, 3600);

  if (error || !data?.signedUrl) return url;

  return data.signedUrl;
}

// Abre a aba antes do await para não ser bloqueada pelo navegador.
export async function abrirComprovante(url: string | null | undefined) {
  if (!url) return;

  const aba = window.open("", "_blank");
  const destino = await resolverUrlComprovante(url);

  if (aba) {
    aba.location.href = destino;
  } else {
    window.open(destino, "_blank");
  }
}
