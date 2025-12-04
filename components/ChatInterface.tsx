import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, Tone, Attachment } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  files: Attachment[];
  clearFiles: () => void;
  tone: Tone;
  setTone: (t: Tone) => void;
  isSearchEnabled: boolean;
  toggleSearch: () => void;
  isThinkingEnabled: boolean;
  toggleThinking: () => void;
  messages: Message[];
  addMessage: (msg: Message) => void;
  updateMessage: (id: string, text: string) => void;
  isProcessingFiles: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  files, clearFiles, tone, setTone, isSearchEnabled, toggleSearch, isThinkingEnabled, toggleThinking, messages, addMessage, updateMessage, isProcessingFiles 
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!editingId) scrollToBottom();
  }, [messages, isLoading, editingId]);

  const handleSend = async () => {
    if ((!input.trim() && files.length === 0) || isLoading || isProcessingFiles) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: input,
      attachments: [...files],
      timestamp: new Date()
    };

    addMessage(userMsg);
    setInput('');
    clearFiles();
    setIsLoading(true);

    try {
      const response = await sendMessageToGemini(
        userMsg.text, 
        userMsg.attachments || [], 
        messages, 
        tone, 
        isSearchEnabled, 
        isThinkingEnabled
      );
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: response.text,
        timestamp: new Date(),
        sources: response.sources,
        isThinking: isThinkingEnabled
      };
      
      addMessage(botMsg);
    } catch (err) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: "Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.",
        timestamp: new Date()
      };
      addMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = () => {
    if (editingId) {
      updateMessage(editingId, editText);
      setEditingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Helper for Smart Filename
  const getSmartFilename = (text: string, ext: string) => {
    let docType = "Documento_Legal";
    const lowerText = text.toLowerCase().slice(0, 1000);

    const keywords: {[key: string]: string} = {
        'tutela': 'Accion_de_Tutela',
        'demanda': 'Demanda_Judicial',
        'contestación': 'Contestacion_Demanda',
        'contestacion': 'Contestacion_Demanda',
        'petición': 'Derecho_de_Peticion',
        'peticion': 'Derecho_de_Peticion',
        'contrato': 'Contrato_Legal',
        'poder': 'Poder_Especial',
        'recurso': 'Recurso_Legal',
        'apelación': 'Recurso_Apelacion',
        'reposición': 'Recurso_Reposicion',
        'alegato': 'Alegatos_Conclusion',
        'sentencia': 'Analisis_Sentencia',
        'concepto': 'Concepto_Juridico'
    };

    for (const [key, val] of Object.entries(keywords)) {
        if (lowerText.includes(key)) {
            docType = val;
            break;
        }
    }
    
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    return `${docType}_${dateStr}.${ext}`;
  };

  // 1. Download as TXT (Failsafe)
  const handleDownloadTXT = (text: string) => {
    const filename = getSmartFilename(text, 'txt');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Download as RTF (Best for Word without corruption)
  const handleDownloadRTF = (text: string) => {
    const filename = getSmartFilename(text, 'rtf');
    
    // Basic conversion from Markdown-ish to RTF
    let rtfBody = text
      // Escape backslashes and braces
      .replace(/\\/g, '\\\\')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}')
      // Bold **text**
      .replace(/\*\*(.*?)\*\*/g, '\\b $1\\b0 ')
      // Italic *text*
      .replace(/\*(.*?)\*/g, '\\i $1\\i0 ')
      // Headers (Simple bold + font size increase)
      .replace(/^# (.*$)/gm, '\\par\\b\\fs32 $1\\fs24\\b0\\par ')
      .replace(/^## (.*$)/gm, '\\par\\b\\fs28 $1\\fs24\\b0\\par ')
      .replace(/^### (.*$)/gm, '\\par\\b\\fs26 $1\\fs24\\b0\\par ')
      // Newlines
      .replace(/\n/g, '\\par\n');
      
      // Standard RTF Header with Arial font
      const rtfContent = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\deflang1033{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}}{\\*\\generator JurisAI;}\\viewkind4\\uc1\\pard\\sa200\\sl276\\slmult1\\f0\\fs24 ${rtfBody}}`;

    const blob = new Blob([rtfContent], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
            <span className="material-icons-outlined text-6xl mb-4">gavel</span>
            <p className="text-xl font-light">Bienvenido a JurisAI Colombia</p>
            <p className="text-sm text-center max-w-md mt-2">
              Sube expedientes masivos (100+ archivos), analiza contratos y redacta demandas.
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 relative group ${
              msg.role === Role.USER 
                ? 'bg-blue-700 text-white rounded-tr-none' 
                : 'bg-slate-800 border border-slate-700 rounded-tl-none shadow-lg'
            }`}>
              
              {/* Message Controls (Copy/Edit) */}
              <div className={`absolute top-2 ${msg.role === Role.USER ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                <button 
                  onClick={() => copyToClipboard(msg.text)} 
                  className="p-1 rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white" 
                  title="Copiar texto"
                >
                  <span className="material-icons-outlined text-xs">content_copy</span>
                </button>
                <button 
                  onClick={() => startEditing(msg)} 
                  className="p-1 rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white"
                  title="Editar mensaje"
                >
                  <span className="material-icons-outlined text-xs">edit</span>
                </button>
              </div>

              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-2">
                    {msg.attachments.length > 6 ? (
                      <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded w-full border border-white/10">
                        <span className="material-icons-outlined text-yellow-500">folder_zip</span>
                        <span className="text-sm font-medium">{msg.attachments.length} Archivos analizados</span>
                      </div>
                    ) : (
                      msg.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded text-xs border border-white/5">
                          <span className="material-icons-outlined text-sm">
                            {att.mimeType.includes('image') ? 'image' : 'description'}
                          </span>
                          <span className="truncate max-w-[150px]">{att.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {editingId === msg.id ? (
                <div className="mt-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-black/30 text-white rounded p-2 text-sm border border-slate-500 focus:outline-none focus:border-blue-400 min-h-[100px]"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={cancelEditing} className="text-xs text-slate-300 hover:text-white px-2 py-1">Cancelar</button>
                    <button onClick={saveEdit} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded">Guardar</button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-600/50">
                  <p className="text-xs text-slate-400 font-semibold mb-2">Fuentes consultadas:</p>
                  <ul className="space-y-1">
                    {msg.sources.map((source, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs">
                         <span className="material-icons-outlined text-[14px] text-green-400">link</span>
                         <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">
                           {source.title}
                         </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {msg.role === Role.MODEL && !editingId && (
                <div className="mt-3 flex flex-wrap gap-2 justify-end pt-2 border-t border-slate-700/50">
                   <button 
                     onClick={() => handleDownloadRTF(msg.text)}
                     className="text-xs flex items-center gap-1 text-white bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded shadow-md transition-all active:scale-95 border border-blue-600"
                     title="Formato RTF: Compatible con Word, Google Docs y WordPad sin errores"
                   >
                     <span className="material-icons-outlined text-sm">description</span>
                     <span className="font-semibold">Word / RTF</span>
                   </button>
                   <button 
                     onClick={() => handleDownloadTXT(msg.text)}
                     className="text-xs flex items-center gap-1 text-slate-300 bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded shadow-md transition-all active:scale-95 border border-slate-600"
                     title="Texto Plano (Sin formato)"
                   >
                     <span className="material-icons-outlined text-sm">text_snippet</span>
                     <span className="font-semibold">TXT</span>
                   </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none flex items-center gap-3 shadow-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                <span className="text-sm text-slate-400 ml-2">Redactando documento legal...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-850 border-t border-slate-700">
        
        <div className="flex flex-wrap gap-3 mb-3 items-center">
          <select 
            value={tone} 
            onChange={(e) => setTone(e.target.value as Tone)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            {Object.values(Tone).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          
          <button 
            onClick={toggleSearch}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${
              isSearchEnabled ? 'bg-blue-900/50 border-blue-500 text-blue-300' : 'bg-transparent border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span className="material-icons-outlined text-sm">search</span>
            Google Search
          </button>

          <button 
            onClick={toggleThinking}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${
              isThinkingEnabled ? 'bg-purple-900/50 border-purple-500 text-purple-300' : 'bg-transparent border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span className="material-icons-outlined text-sm">psychology</span>
            Razonamiento Profundo
          </button>
        </div>

        {isProcessingFiles && (
          <div className="bg-slate-800/50 border border-blue-500/30 rounded-lg p-3 mb-2 flex items-center gap-3 animate-pulse">
            <span className="material-icons-outlined text-blue-400 animate-spin">sync</span>
            <span className="text-xs text-blue-200">Procesando carga masiva de documentos...</span>
          </div>
        )}

        {files.length > 0 && !isProcessingFiles && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-2 mb-2">
            <div className="flex justify-between items-center mb-2 px-1">
               <span className="text-xs text-blue-300 font-medium flex items-center gap-1">
                 <span className="material-icons-outlined text-sm">folder_copy</span>
                 {files.length} Archivos cargados
               </span>
               <button onClick={clearFiles} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                 <span className="material-icons-outlined text-sm">delete_sweep</span> Limpiar todo
               </button>
            </div>
            
            {files.length > 10 ? (
               <div className="max-h-32 overflow-y-auto scrollbar-thin pr-1">
                 <div className="flex flex-wrap gap-2">
                    {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-1 bg-slate-900 border border-slate-600 px-2 py-1 rounded text-[10px] text-slate-300 max-w-[140px]" title={f.name}>
                            <span className="material-icons-outlined text-[10px] text-slate-400">
                              {f.mimeType.includes('image') ? 'image' : 'description'}
                            </span>
                            <span className="truncate">{f.name}</span>
                        </div>
                    ))}
                 </div>
               </div>
            ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {files.map((f, i) => (
                    <div key={i} className="relative group bg-slate-800 border border-slate-600 p-2 rounded w-28 flex-shrink-0 flex flex-col items-center">
                        <span className="material-icons-outlined text-2xl text-slate-400">
                          {f.mimeType.includes('image') ? 'image' : 'description'}
                        </span>
                        <span className="text-[10px] truncate w-full text-center mt-1 text-slate-300" title={f.name}>{f.name}</span>
                    </div>
                  ))}
                </div>
            )}
          </div>
        )}

        <div className="flex gap-2 items-end">
           <div className="relative flex-1">
             <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isProcessingFiles}
                placeholder={isProcessingFiles ? "Cargando archivos..." : "Solicita una demanda, tutela o análisis..."}
                className="w-full bg-slate-800 text-slate-200 rounded-lg p-3 pr-10 resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[50px] max-h-[150px] disabled:opacity-50"
                rows={2}
             />
           </div>
           
           <button 
             onClick={handleSend}
             disabled={isLoading || isProcessingFiles || (!input.trim() && files.length === 0)}
             className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-3 rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center"
           >
             <span className="material-icons-outlined">send</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;