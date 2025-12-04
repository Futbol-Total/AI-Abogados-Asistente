import React, { useEffect, useRef, useState } from 'react';
import { connectToLiveAPI, createPcmBlob, base64ToUint8Array } from '../services/geminiService';

interface VoiceAssistantProps {
  onClose: () => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'active' | 'error' | 'closed'>('connecting');
  const [volume, setVolume] = useState(0);
  
  // Audio Context Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const connectionRef = useRef<{ sendAudio: (b: Blob) => void; disconnect: () => void } | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // Setup Output Audio
        outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        // Setup Input Audio
        inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Visualizer simple volume meter
        const audioContext = inputContextRef.current;
        const source = audioContext.createMediaStreamSource(stream);
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        
        const updateVolume = () => {
          if (!mounted) return;
          analyzer.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVolume(avg);
          requestAnimationFrame(updateVolume);
        };
        updateVolume();

        // Connect to Gemini
        const connection = await connectToLiveAPI(
          (base64Audio) => playAudio(base64Audio),
          (userTxt, modelTxt) => console.log("Transcript", userTxt, modelTxt),
          () => setStatus('closed')
        );
        connectionRef.current = connection;
        setStatus('active');

        // Setup input processing (send mic to Gemini)
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        processor.onaudioprocess = (e) => {
          if (!connectionRef.current) return;
          const inputData = e.inputBuffer.getChannelData(0);
          // Create the specific PCM format blob
          const pcmBlob = createPcmBlob(inputData);
          
          // Send raw PCM blob to service wrapper which handles encoding
          // Actually, our createPcmBlob returns a Blob.
          // We need to encode it to base64 string inside the service usually?
          // Re-reading service: service.sendAudio takes a Blob.
          // Inside service, it reads blob as dataURL to get base64. Correct.
          connectionRef.current.sendAudio(pcmBlob);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

      } catch (e) {
        console.error("Voice Init Error", e);
        setStatus('error');
      }
    };

    init();

    return () => {
      mounted = false;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    connectionRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current?.disconnect();
    inputContextRef.current?.close();
    outputContextRef.current?.close();
    sourceNodesRef.current.forEach(n => n.stop());
  };

  const playAudio = async (base64: string) => {
    if (!outputContextRef.current) return;
    const ctx = outputContextRef.current;
    
    try {
      const audioData = base64ToUint8Array(base64);
      // PCM decoding manually because it's raw PCM 24kHz mono usually from Gemini
      const float32Data = new Float32Array(audioData.length / 2);
      const dataView = new DataView(audioData.buffer);
      
      for (let i = 0; i < audioData.length / 2; i++) {
        float32Data[i] = dataView.getInt16(i * 2, true) / 32768.0;
      }

      const buffer = ctx.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      const currentTime = ctx.currentTime;
      const startTime = Math.max(currentTime, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + buffer.duration;
      
      sourceNodesRef.current.add(source);
      source.onended = () => {
        sourceNodesRef.current.delete(source);
      };

    } catch (e) {
      console.error("Audio Playback Error", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-3xl w-full max-w-md flex flex-col items-center shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <span className="material-icons-outlined">close</span>
        </button>

        <h2 className="text-2xl font-semibold mb-8 text-white">Asistente de Voz</h2>

        {/* Visualizer Circle */}
        <div className="relative w-40 h-40 flex items-center justify-center mb-8">
           <div 
             className="absolute inset-0 bg-blue-500 rounded-full opacity-20 transition-all duration-75"
             style={{ transform: `scale(${1 + volume / 50})` }}
           ></div>
           <div 
             className="absolute inset-0 bg-blue-400 rounded-full opacity-30 blur-xl transition-all duration-75"
             style={{ transform: `scale(${1 + volume / 100})` }}
           ></div>
           <div className="z-10 bg-slate-800 p-6 rounded-full border-2 border-blue-500/50">
             <span className="material-icons-outlined text-6xl text-blue-400">mic</span>
           </div>
        </div>

        <div className="text-center h-8">
          {status === 'connecting' && <span className="text-slate-400 animate-pulse">Conectando...</span>}
          {status === 'active' && <span className="text-green-400 font-medium">Escuchando... (Live API)</span>}
          {status === 'error' && <span className="text-red-400">Error de conexión</span>}
          {status === 'closed' && <span className="text-slate-500">Sesión finalizada</span>}
        </div>

        <p className="mt-6 text-slate-500 text-sm text-center">
          Habla naturalmente. JurisAI te responderá en tiempo real.
        </p>
      </div>
    </div>
  );
};

export default VoiceAssistant;
