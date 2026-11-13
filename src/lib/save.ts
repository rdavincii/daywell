/**
 * Saves text as a file on any device. Phones (and in-app browsers) ignore `download` on data: links, so use the
 * share sheet where files can be shared ("Save to Files"), and a normal blob download everywhere else.
 * Returns what happened so the UI can say so; never throws.
 */
export async function saveFile(name: string, text: string, mime: string): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  try {
    const file = new File([text], name, { type: mime });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: name });
        return 'shared';
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return 'cancelled'; // closed the share sheet
        // share refused (for example it must be tapped again): fall through to a normal download
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
