/**
 * Comprime una foto en el navegador antes de subirla (WebP, lado mayor `max` px).
 * Así el menú carga rápido en 4G y no pagamos transformaciones de imágenes.
 */
export async function compressImage(
	file: File,
	{ max = 1000, type = 'image/webp', quality = 0.8 } = {}
): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
	const w = Math.round(bitmap.width * scale);
	const h = Math.round(bitmap.height * scale);
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();
	const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
	if (!blob) throw new Error('No se pudo procesar la imagen');
	return blob;
}

export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
		r.onerror = reject;
		r.readAsDataURL(blob);
	});
}
