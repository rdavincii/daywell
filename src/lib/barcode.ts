/** Reads a barcode from a photo. Uses the browser's built-in detector when there is one (Chrome, Android), else zxing (loaded only then). */
export async function decodeBarcode(file: Blob): Promise<string | null> {
  const BD = (window as unknown as { BarcodeDetector?: new (o?: object) => { detect(i: ImageBitmap): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (BD) {
    try {
      const r = await new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] }).detect(await createImageBitmap(file));
      if (r[0]?.rawValue) return r[0].rawValue;
    } catch { /* fall through to zxing */ }
  }
  const { BrowserMultiFormatReader } = await import('@zxing/library');
  const url = URL.createObjectURL(file);
  try {
    return (await new BrowserMultiFormatReader().decodeFromImageUrl(url)).getText();
  } catch {
    return null; // NotFoundException: no barcode in the photo
  } finally {
    URL.revokeObjectURL(url);
  }
}
