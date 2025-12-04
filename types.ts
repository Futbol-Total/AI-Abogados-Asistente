export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export enum Tone {
  FORMAL = 'Formal y Jurídico',
  PERSUASIVE = 'Persuasivo y Argumentativo',
  CONCILIATORY = 'Conciliador',
  AGGRESSIVE = 'Enérgico y Directo',
  EDUCATIONAL = 'Explicativo para Clientes'
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64
  size: number;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  attachments?: Attachment[];
  timestamp: Date;
  isThinking?: boolean;
  sources?: Array<{
    title: string;
    uri: string;
  }>;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  streamingText: string;
}
