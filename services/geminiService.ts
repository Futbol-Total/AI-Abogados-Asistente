import { GoogleGenAI, Type, LiveServerMessage, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION, TONE_PROMPTS } from "../constants";
import { Attachment, Tone, Message, Role } from "../types";

// Helper to get API Key safely
const getApiKey = () => {
  const key = process.env.API_KEY;
  if (!key) {
    console.error("API_KEY not found in environment variables.");
    return "";
  }
  return key;
};

// 1. Text & Document Analysis Generation
export const sendMessageToGemini = async (
  prompt: string,
  attachments: Attachment[],
  history: Message[],
  tone: Tone,
  useSearch: boolean,
  useThinking: boolean
): Promise<{ text: string; sources?: Array<{ title: string; uri: string }> }> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key faltante");

  const ai = new GoogleGenAI({ apiKey });
  
  // Model Selection Strategy for "Infinite Memory/Continuity"
  // Default to Flash for speed on simple first queries
  let modelName = 'gemini-2.5-flash';
  let tools: any[] = [];
  let thinkingConfig = undefined;

  // Check if there is extensive history or prior attachments
  const hasHistory = history.length > 0;
  const hasAttachments = attachments.length > 0 || history.some(m => m.attachments && m.attachments.length > 0);

  if (useThinking) {
    modelName = 'gemini-3-pro-preview';
    thinkingConfig = { thinkingBudget: 16000 };
  } else if (hasAttachments || hasHistory) {
    // ALWAYS use Pro for ongoing conversations or document analysis to ensure
    // the model "remembers" everything in its large context window (up to 2M tokens).
    modelName = 'gemini-3-pro-preview';
    
    // If search is also enabled, we can add it to Pro
    if (useSearch) {
      tools = [{ googleSearch: {} }];
    }
  } else if (useSearch) {
    modelName = 'gemini-2.5-flash';
    tools = [{ googleSearch: {} }];
  }

  const toneInstruction = TONE_PROMPTS[tone];
  const fullSystemInstruction = `${SYSTEM_INSTRUCTION}\n\nInstrucción de Tono actual: ${toneInstruction}`;

  // Build content history carefully to preserve all context
  const contents = history.map(msg => {
    const parts: any[] = [];
    
    // Add attachments from history
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach(att => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      });
    }
    
    // Add text from history
    parts.push({ text: msg.text });

    return {
      role: msg.role,
      parts: parts
    };
  });

  // Build current turn parts
  const currentParts: any[] = [];
  
  // Add current attachments
  attachments.forEach(att => {
    currentParts.push({
      inlineData: {
        mimeType: att.mimeType,
        data: att.data
      }
    });
  });

  // Add current prompt
  currentParts.push({ text: prompt });

  // Append current turn to contents
  contents.push({
    role: Role.USER,
    parts: currentParts
  });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: fullSystemInstruction,
        tools: tools.length > 0 ? tools : undefined,
        thinkingConfig
      }
    });

    const text = response.text || "No se pudo generar respuesta. Por favor intenta de nuevo.";
    
    // Extract grounding metadata if available
    let sources: Array<{ title: string; uri: string }> = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          sources.push({
            title: chunk.web.title || "Fuente Web",
            uri: chunk.web.uri
          });
        }
      });
    }

    return { text, sources };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// 2. Live API Connection (Voice Mode)
export const connectToLiveAPI = async (
  onAudioData: (base64Audio: string) => void,
  onTranscription: (userText: string, modelText: string) => void,
  onClose: () => void
): Promise<{ 
  sendAudio: (blob: Blob) => void; 
  disconnect: () => void;
}> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key faltante");

    const ai = new GoogleGenAI({ apiKey });
    let keepAlive = true;

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log("Live Session Connected");
        },
        onmessage: (message: LiveServerMessage) => {
           if (!keepAlive) return;

           // Handle Audio Output
           const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
           if (base64Audio) {
             onAudioData(base64Audio);
           }

           // Handle Transcription (if enabled/needed in future)
           if (message.serverContent?.turnComplete) {
              // Logic for transcription updates could go here
           }
        },
        onclose: () => {
          console.log("Live Session Closed");
          onClose();
        },
        onerror: (err) => {
          console.error("Live Session Error", err);
          onClose();
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: SYSTEM_INSTRUCTION + " Responde de manera concisa y profesional como abogado.",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
        }
      }
    });

    return {
      sendAudio: (blob: Blob) => {
        if (!keepAlive) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          sessionPromise.then(session => {
            session.sendRealtimeInput({
              media: {
                mimeType: blob.type,
                data: base64data
              }
            });
          });
        };
        reader.readAsDataURL(blob);
      },
      disconnect: () => {
        keepAlive = false;
        sessionPromise.then(session => session.close());
      }
    };
};

// Audio Utils for Live API
export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return new Blob([int16], { type: 'audio/pcm' });
}

export function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}