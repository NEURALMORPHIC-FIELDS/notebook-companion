export interface GeneratedProgramFile {
  id: string;
  fileName: string;
  content: string;
  language: string;
  phase: string;
  sourceAgent: string;
  createdAt: string;
}

interface SaveGeneratedProgramFileInput {
  fileName: string;
  content: string;
  language: string;
  phase: string;
  sourceAgent: string;
}

const STORAGE_KEY = 'nexus-generated-program-files';

export function loadGeneratedProgramFiles(): GeneratedProgramFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGeneratedProgramFile(input: SaveGeneratedProgramFileInput): GeneratedProgramFile {
  const files = loadGeneratedProgramFiles();
  const next: GeneratedProgramFile = {
    id: `generated-file-${Date.now()}`,
    fileName: input.fileName,
    content: input.content,
    language: input.language,
    phase: input.phase,
    sourceAgent: input.sourceAgent,
    createdAt: new Date().toISOString(),
  };

  const deduped = files.filter((item) => item.fileName !== input.fileName);
  const updated = [next, ...deduped];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return next;
}

export function downloadProgramFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
