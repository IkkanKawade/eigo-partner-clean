
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

export type SpeechRecognitionStatus = "idle" | "listening" | "processing" | "error";