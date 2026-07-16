import React, { useRef, useState } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';
import { SupabaseClient } from '@supabase/supabase-js';

interface ProductPhotoUploadProps {
  supabase: SupabaseClient;
  marca: string;
  referencia: string;
  cor1: string;
  tipo?: string;
  modelo?: string;
  existingImageUrl?: string | null;
  onPhotoUploaded: (imageUrl: string) => void;
}

const resizeImage = (file: File, maxSize = 400): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
      } else {
        if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          blob ? resolve(blob) : reject(new Error('Falha ao converter'));
        },
        'image/webp', 0.85
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

function sanitizePath(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-\.\/]/g, '_')
    .toLowerCase();
}

const ProductPhotoUpload: React.FC<ProductPhotoUploadProps> = ({
  supabase, marca, referencia, cor1, tipo, modelo, existingImageUrl, onPhotoUploaded
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(existingImageUrl || null);
  const [zoomOpen, setZoomOpen] = useState(false);

  React.useEffect(() => {
    setPreview(existingImageUrl || null);
  }, [existingImageUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !referencia) return;
    setUploading(true);
    try {
      const resized = await resizeImage(file);
      const path = sanitizePath(`catalogo/${marca}/${referencia}_${cor1 || 'sem_cor'}.webp`);

      const { error: uploadError } = await supabase.storage
        .from('Fotos').upload(path, resized, { contentType: 'image/webp', upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('Fotos').getPublicUrl(path);
      const cacheBustUrl = publicUrl + '?t=' + Date.now();

      await supabase.from('product_catalog').upsert({
        marca, referencia, cor1: cor1 || '', tipo, modelo, image_url: publicUrl
      }, { onConflict: 'marca,referencia,cor1' });

      setPreview(cacheBustUrl);
      onPhotoUploaded(cacheBustUrl);
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      alert('Erro ao salvar foto. Tente novamente.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={handleFileSelect} />
      {preview ? (
        <img src={preview} alt="Produto" onClick={() => setZoomOpen(true)}
          style={{ width: 40, height: 40, objectFit: 'contain', background: '#f9fafb', borderRadius: 4,
            border: '1px solid #e5e7eb', cursor: 'zoom-in' }}
          title="Clique para ampliar" />
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={uploading || !referencia}
          title={!referencia ? 'Preencha a referência primeiro' : 'Adicionar foto do produto'}
          style={{ width: 36, height: 36, borderRadius: 4, border: '1px dashed #9ca3af',
            background: uploading ? '#e5e7eb' : '#f9fafb', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {uploading ? '...' : <Camera size={16} color="#6b7280" />}
        </button>
      )}

      {/* Popup de visualização ampliada */}
      {zoomOpen && preview && (
        <div
          onClick={() => setZoomOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 16,
              maxWidth: 480,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              cursor: 'default',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                {referencia || 'Produto'}{cor1 ? ` · ${cor1}` : ''}
              </span>
              <button
                onClick={() => setZoomOpen(false)}
                style={{
                  border: 'none', background: '#f1f5f9', borderRadius: 6, width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <X size={16} color="#475569" />
              </button>
            </div>

            <img
              src={preview}
              alt="Produto ampliado"
              style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', background: '#f9fafb', borderRadius: 8 }}
            />

            <button
              onClick={() => { setZoomOpen(false); inputRef.current?.click(); }}
              disabled={uploading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} /> Trocar Foto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPhotoUpload;
