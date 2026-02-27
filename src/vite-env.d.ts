/// <reference types="vite/client" />

interface NexusNotebookApi {
  submit: (entry: {
    sourceAgent: string;
    phase: string;
    code: string;
    language?: string;
    description?: string;
  }) => void;
}

interface Window {
  nexusNotebook?: NexusNotebookApi;
}
