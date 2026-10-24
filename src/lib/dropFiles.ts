/** Walks dropped folder entries so files inside directories are imported too.
 *  Falls back to dataTransfer.files when entry traversal isn't supported or
 *  yields nothing. Hidden dotfiles (e.g. .DS_Store) are skipped. */
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = [];

  const walk = async (entry: FileSystemEntry): Promise<void> => {
    try {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject),
        );
        if (!file.name.startsWith('.')) files.push(file);
        return;
      }
      if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        // readEntries returns batches — keep calling until it yields nothing.
        let batch: FileSystemEntry[];
        do {
          batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
          for (const child of batch) await walk(child);
        } while (batch.length > 0);
      }
    } catch {
      // Skip unreadable entries — one bad file shouldn't abort the batch.
    }
  };

  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  if (entries.length) {
    for (const entry of entries) await walk(entry);
  }
  if (!files.length) {
    return Array.from(dataTransfer.files).filter((file) => !file.name.startsWith('.'));
  }
  return files;
}
