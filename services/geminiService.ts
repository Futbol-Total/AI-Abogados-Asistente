import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION, TONE_PROMPTS } from "../constants";
import { Attachment, Tone, Message, Role } from "../types";

// Helper to convert base64 to Blob
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  const sliceSize = 512;

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: mimeType });
};

// 1. Text & Document Analysis Generation
export const sendMessageToGemini = async (
  prompt: string,
  attachments: Attachment[],
  history: Message[],
  tone: Tone,
  useSearch: boolean,
  useThinking: boolean
): Promise<{ 
  text: string; 
  sources?: Array<{ title: string; uri: string }>;
  updatedUserAttachments?: Attachment[];
  updatedHistoryMessages?: Message[];
}> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Helper to upload a single attachment if needed
  const uploadAttachment = async (att: Attachment): Promise<Attachment> => {
    // If we already have a URI, assume it's valid (files expire in 48h, but for this session flow it works)
    if (att.fileUri) return att;

    try {
      // Convert base64 back to blob for upload
      const blob = base64ToBlob(att.data, att.mimeType);
      
      const uploadResult = await ai.files.upload({
        file: blob,
        config: { displayName: att.name || 'uploaded_file' }
      });

      return {
        ...att,
        fileUri: uploadResult.file.uri
      };
    } catch (error) {
      console.error("Error uploading file:", att.name, error);
      // Fallback: return original (will use base64 inlineData, which might fail if too big, but better than crashing here)
      return att;
    }
  };

  // 1. Process/Upload Current Attachments
  // Use Promise.all to upload in parallel
  const processedCurrentAttachments = await Promise.all(attachments.map(uploadAttachment));

  // 2. Process/Upload History Attachments
  // This is critical to fix the RPC error on long contexts with many files
  let historyWasUpdated = false;
  const processedHistory = await Promise.all(history.map(async (msg) => {
    if (!msg.attachments || msg.attachments.length === 0) return msg;

    const msgAttachments = await Promise.all(msg.attachments.map(async (att) => {
      if (!att.fileUri) {
        historyWasUpdated = true;
        return await uploadAttachment(att);
      }
      return att;
    }));

    return { ...msg, attachments: msgAttachments };
  }));

  // Model Selection Strategy
  let modelName = 'gemini-2.5-flash';
  let tools: any[] = [];
  let thinkingConfig = undefined;

  const hasHistory = processedHistory.length > 0;
  const hasAttachments = processedCurrentAttachments.length > 0 || processedHistory.some(m => m.attachments && m.attachments.length > 0);

  if (useThinking) {
    modelName = 'gemini-3-pro-preview';
    thinkingConfig = { thinkingBudget: 16000 };
  } else if (hasAttachments || hasHistory) {
    modelName = 'gemini-3-pro-preview';
    if (useSearch) tools = [{ googleSearch: {} }];
  } else if (useSearch) {
    modelName = 'gemini-2.5-flash';
    tools = [{ googleSearch: {} }];
  }

  const toneInstruction = TONE_PROMPTS[tone];
  const fullSystemInstruction = `${SYSTEM_INSTRUCTION}\n\nInstrucción de Tono actual: ${toneInstruction}`;

  // Build content payload using fileData (URIs) instead of inlineData (Base64) where possible
  const contents = processedHistory.map(msg => {
    const parts: any[] = [];
    
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach(att => {
        if (att.fileUri) {
          parts.push({
            fileData: {
              mimeType: att.mimeType,
              fileUri: att.fileUri
            }
          });
        } else {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data
            }
          });
        }
      });
    }
    
    parts.push({ text: msg.text });
    return { role: msg.role, parts: parts };
  });

  // Current turn
  const currentParts: any[] = [];
  processedCurrentAttachments.forEach(att => {
    if (att.fileUri) {
      currentParts.push({
        fileData: {
          mimeType: att.mimeType,
          fileUri: att.fileUri
        }
      });
    } else {
      currentParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data
        }
      });
    }
  });
  currentParts.push({ text: prompt });

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

    return { 
      text, 
      sources,
      updatedUserAttachments: processedCurrentAttachments,
      updatedHistoryMessages: historyWasUpdated ? processedHistory : undefined
    };

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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let keepAlive = true;

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log("Live Session Connected");
        },
        onmessage: (message: LiveServerMessage) => {
           if (!keepAlive) return;

           const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
           if (base64Audio) {
             onAudioData(base64Audio);
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