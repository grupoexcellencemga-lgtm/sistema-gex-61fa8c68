import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { escanearNota, DadosNota } from '@/services/scannerNota';
import { Camera, Upload, Loader2, CheckCircle } from 'lucide-react';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onDadosExtraidos: (dados: DadosNota) => void;
}

export function ModalScannerNota({ aberto, onFechar, onDadosExtraidos }: Props) {
  const [imagem, setImagem] = useState<string | null>(null);
  const [imagemBase64, setImagemBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processarArquivo = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setErro(null);
    const url = URL.createObjectURL(file);
    setImagem(url);
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      setImagemBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const analisar = async () => {
    if (!imagemBase64) return;
    setCarregando(true);
    setErro(null);
    try {
      const dados = await escanearNota(imagemBase64, mimeType);
      onDadosExtraidos(dados);
      onFechar();
      resetar();
    } catch {
      setErro('Não foi possível extrair os dados. Tente uma foto mais nítida.');
    } finally {
      setCarregando(false);
    }
  };

  const resetar = () => {
    setImagem(null);
    setImagemBase64(null);
    setErro(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processarArquivo(file);
  };

  return (
    <Dialog open={aberto} onOpenChange={(open) => { if (!open) { onFechar(); resetar(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-orange-500" />
            Escanear Nota / Cupom
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Área de upload */}
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-orange-500 transition-colors overflow-hidden"
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && processarArquivo(e.target.files[0])}
            />
            {imagem ? (
              <div className="relative">
                <img src={imagem} alt="Nota" className="w-full max-h-64 object-contain bg-black" />
                <div className="absolute top-2 right-2 bg-black/70 text-gray-400 text-xs px-2 py-1 rounded">
                  Clique para trocar
                </div>
              </div>
            ) : (
              <div className="p-10 text-center">
                <Upload className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                <p className="text-sm font-medium text-gray-300">Tire uma foto ou envie uma imagem</p>
                <p className="text-xs text-gray-500 mt-1">Nota fiscal · Cupom · Boleto · Recibo</p>
                <p className="text-xs text-gray-600 mt-1">Ou arraste e solte aqui</p>
              </div>
            )}
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              ⚠️ {erro}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { onFechar(); resetar(); }} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={analisar}
              disabled={!imagem || carregando}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {carregando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Extrair dados
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
