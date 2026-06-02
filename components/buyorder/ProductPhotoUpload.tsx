import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
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

const ProductPhotoUpload: React.FC<ProductPhotoUploadProps> = ({
  supabase, marca, referencia, cor1, tipo, modelo, existingImageUrl, onPhotoUploaded
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(existingImageUrl || null);

  React.useEffect(() => {
    setPreview(existingImageUrl || null);
  }, [existingImageUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !referencia) return;
    setUploading(true);
    try {
      const resized = await resizeImage(file);
      const marcaSlug = marca.toLowerCase().replace(/\s+/g, '_');
      const corSlug = (cor1 || 'sem_cor').toLowerCase().replace(/\s+/g, '_');
      const path = `catalogo/${marcaSlug}/${referencia}_${corSlug}.webp`;

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
        <img src={preview} alt="Produto" onClick={() => inputRef.current?.click()}
          style={{ width: 40, height: 40, objectFit: 'contain', background: '#f9fafb', borderRadius: 4,
            border: '1px solid #e5e7eb', cursor: 'pointer' }}
          title="Clique para trocar a foto" />
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={uploading || !referencia}
          title={!referencia ? 'Preencha a referência primeiro' : 'Adicionar foto do produto'}
          style={{ width: 36, height: 36, borderRadius: 4, border: '1px dashed #9ca3af',
            background: uploading ? '#e5e7eb' : '#f9fafb', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {uploading ? '...' : <Camera size={16} color="#6b7280" />}
        </button>
      )}
    </div>
  );
};

export default ProductPhotoUpload;
