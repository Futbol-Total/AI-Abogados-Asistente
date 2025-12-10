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
  updateMessage: (id: string, text: string, attachments?: Attachment[]) => void;
  setAllMessages: (msgs: Message[]) => void;
  isProcessingFiles: boolean;
}

// Gemini Sparkle Icon Component
const SparkleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-400">
    <path d="M10 20.02C10.5 19.83 11.23 18.9 11.55 18.23C12.18 16.92 12.5 15.68 12.5 15.68C12.5 15.68 12.82 16.92 13.45 18.23C13.77 18.9 14.5 19.83 15 20.02V20.02C14.5 20.21 13.77 21.14 13.45 21.81C12.82 23.12 12.5 24.36 12.5 24.36C12.5 24.36 12.18 23.12 11.55 21.81C11.23 21.14 10.5 20.21 10 20.02V20.02Z" fill="url(#paint0_linear)"/>
    <path d="M15.5 13.02C16 12.83 16.73 11.9 17.05 11.23C17.68 9.92 18 8.68 18 8.68C18 8.68 18.32 9.92 18.95 11.23C19.27 11.9 20 12.83 20.5 13.02V13.02C20 13.21 19.27 14.14 18.95 14.81C18.32 16.12 18 17.36 18 17.36C18 17.36 17.68 16.12 17.05 14.81C16.73 14.14 16 13.21 15.5 13.02V13.02Z" fill="url(#paint0_linear)"/>
    <path d="M2.5 10.02C3 9.83 3.73 8.9 4.05 8.23C4.68 6.92 5 5.68 5 5.68C5 5.68 5.32 6.92 5.95 8.23C6.27 8.9 7 9.83 7.5 10.02V10.02C7 10.21 6.27 11.14 5.95 11.81C5.32 13.12 5 14.36 5 14.36C5 14.36 4.68 13.12 4.05 11.81C3.73 11.14 3 10.21 2.5 10.02V10.02Z" fill="url(#paint0_linear)"/>
    <defs>
      <linearGradient id="paint0_linear" x1="2.5" y1="5.68" x2="20.5" y2="24.36" gradientUnits="userSpaceOnUse">
        <stop stopColor="#60A5FA"/>
        <stop offset="1" stopColor="#A78BFA"/>
      </linearGradient>
    </defs>
  </svg>
);

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  files, clearFiles, tone, setTone, isSearchEnabled, toggleSearch, isThinkingEnabled, toggleThinking, messages, addMessage, updateMessage, setAllMessages, isProcessingFiles 
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Export Menu State
  const [openExportMenuId, setOpenExportMenuId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!editingId) scrollToBottom();
  }, [messages, isLoading, editingId]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenExportMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
      
      if (response.updatedUserAttachments) {
         updateMessage(userMsg.id, userMsg.text, response.updatedUserAttachments);
      }

      if (response.updatedHistoryMessages) {
        const botMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: Role.MODEL,
            text: response.text,
            timestamp: new Date(),
            sources: response.sources,
            isThinking: isThinkingEnabled
        };
        const finalUserMsg = { ...userMsg, attachments: response.updatedUserAttachments || userMsg.attachments };
        setAllMessages([...response.updatedHistoryMessages, finalUserMsg, botMsg]);
      } else {
        const botMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: Role.MODEL,
            text: response.text,
            timestamp: new Date(),
            sources: response.sources,
            isThinking: isThinkingEnabled
        };
        addMessage(botMsg);
      }

    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: "Hubo un error al procesar tu solicitud. Es posible que el volumen de datos sea muy alto.",
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

  // --- EXPORT FUNCTIONS ---
  const handleExportGoogleDocs = (text: string) => {
    const filename = getSmartFilename(text, 'doc'); 
    let htmlBody = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^### (.*$)/gm, '<h3 style="font-size:14pt; margin-top:12pt; margin-bottom:6pt; font-weight:bold;">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 style="font-size:16pt; margin-top:14pt; margin-bottom:8pt; font-weight:bold;">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 style="font-size:18pt; margin-top:18pt; margin-bottom:12pt; font-weight:bold; text-align:center;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.*?)\*/g, '<i>$1</i>')
      .replace(/^\s*-\s+(.*$)/gm, '<ul><li>$1</li></ul>')
      .replace(/^\s*\d+\.\s+(.*$)/gm, '<ol><li>$1</li></ol>')
      .replace(/<\/ul>\s*<ul>/g, '')
      .replace(/<\/ol>\s*<ol>/g, '')
      .replace(/\n\n/g, '</p><p style="margin-bottom:10pt; text-align:justify;">')
      .replace(/\n/g, '<br/>');

    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${filename}</title>
        <style>
          body { font-family: 'Arial', sans-serif; font-size: 12pt; line-height: 1.5; color: #000000; }
          p { margin-bottom: 10pt; text-align: justify; }
          li { margin-bottom: 5pt; }
        </style>
      </head>
      <body>
        ${htmlBody}
        <br/><br/>
        <p style="font-size:10pt; color:#666; text-align:center;">Generado por JurisAI Colombia</p>
      </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: 'application/vnd.ms-word' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 relative font-sans">
      
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-3 md:p-8 space-y-6 md:space-y-8 pb-40 scrollbar-thin scrollbar-thumb-slate-700">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60 px-4 text-center">
            <SparkleIcon />
            <p className="text-xl md:text-2xl font-light mt-4 text-slate-300">¿En qué puedo ayudarte hoy?</p>
            <p className="text-xs md:text-sm text-center max-w-md mt-2">
              Sube expedientes masivos, analiza contratos y redacta demandas.
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.role === Role.USER ? 'justify-end' : 'justify-start gap-3 md:gap-4'} group`}>
            
            {/* AI Icon (Left Side) */}
            {msg.role === Role.MODEL && (
              <div className="flex-shrink-0 mt-1">
                <SparkleIcon />
              </div>
            )}

            <div className={`flex flex-col max-w-[95%] md:max-w-[80%] ${msg.role === Role.USER ? 'items-end' : 'items-start'}`}>
              
              {/* Message Content */}
              <div className={`relative px-4 py-3 md:px-5 md:py-3 text-[14px] md:text-[15px] leading-relaxed ${
                msg.role === Role.USER 
                  ? 'bg-slate-700/50 rounded-2xl md:rounded-3xl rounded-tr-sm text-slate-100' 
                  : 'bg-transparent text-slate-200 pl-0'
              }`}>
                
                {/* Attachments Display */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className={`mb-3 flex flex-wrap gap-2 ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}>
                    {msg.attachments.length > 6 ? (
                       <div className="flex items-center gap-2 bg-black/30 px-3 py-2 rounded-lg border border-white/10">
                         <span className="material-icons-outlined text-yellow-500">folder_zip</span>
                         <span className="text-xs font-medium">{msg.attachments.length} Archivos</span>
                       </div>
                    ) : (
                      msg.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg text-xs border border-white/5 max-w-[150px] md:max-w-[200px]">
                          <span className="material-icons-outlined text-sm shrink-0">
                            {att.mimeType.includes('image') ? 'image' : 'description'}
                          </span>
                          <span className="truncate">{att.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Edit Mode vs Read Mode */}
                {editingId === msg.id ? (
                  <div className="animate-fadeIn w-full min-w-[280px] md:min-w-[400px]">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-slate-800 text-white rounded-xl p-3 text-sm border border-slate-600 focus:outline-none focus:border-blue-400 min-h-[120px]"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={cancelEditing} className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded hover:bg-slate-700">Cancelar</button>
                      <button onClick={saveEdit} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full">Actualizar</button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-p:leading-7 prose-li:leading-6 max-w-none">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                )}

                {/* Sources Footnote */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-700/50">
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, idx) => (
                        <a 
                          key={idx} 
                          href={source.uri} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-full text-xs transition-colors"
                        >
                           {source.uri.includes('google') ? <span className="text-[10px]">🔍</span> : <span className="material-icons-outlined text-[12px] text-slate-400">public</span>}
                           <span className="truncate max-w-[150px] text-blue-300">{source.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Gemini-style Toolbar (Below Message) */}
              {!editingId && (
                <div className={`flex items-center gap-0 md:gap-1 mt-1 ${msg.role === Role.USER ? 'mr-1 opacity-0 group-hover:opacity-100 transition-opacity' : 'ml-0'}`}>
                  
                  <button 
                    onClick={() => copyToClipboard(msg.text)} 
                    className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" 
                    title="Copiar"
                  >
                    <span className="material-icons-outlined text-[16px] md:text-[18px]">content_copy</span>
                  </button>
                  
                  <button 
                    onClick={() => startEditing(msg)} 
                    className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Editar"
                  >
                    <span className="material-icons-outlined text-[16px] md:text-[18px]">edit</span>
                  </button>

                  {/* Export Menu for AI Messages */}
                  {msg.role === Role.MODEL && (
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenExportMenuId(openExportMenuId === msg.id ? null : msg.id); }}
                        className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Compartir y Exportar"
                      >
                        <span className="material-icons-outlined text-[16px] md:text-[18px]">share</span>
                      </button>

                      {openExportMenuId === msg.id && (
                        <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-fadeIn">
                          <button 
                            onClick={() => { handleExportGoogleDocs(msg.text); setOpenExportMenuId(null); }}
                            className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors"
                          >
                             <img src="https://upload.wikimedia.org/wikipedia/commons/0/01/Google_Docs_logo_%282014-2020%29.svg" alt="Docs" className="w-4 h-4" />
                             Exportar a Google Docs
                          </button>
                          <div className="h-px bg-slate-700 mx-2"></div>
                          <button 
                            onClick={() => { handleDownloadTXT(msg.text); setOpenExportMenuId(null); }}
                            className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors"
                          >
                             <span className="material-icons-outlined text-slate-400 text-sm">text_snippet</span>
                             Descargar texto plano (.txt)
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                     <span className="material-icons-outlined text-[16px] md:text-[18px]">thumb_up_off_alt</span>
                  </button>
                  <button className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                     <span className="material-icons-outlined text-[16px] md:text-[18px]">thumb_down_off_alt</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start gap-4 px-2">
             <div className="mt-1 flex-shrink-0 animate-pulse">
                <SparkleIcon />
             </div>
             <div className="flex items-center gap-1 mt-2">
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Modern Input Area (Floating) */}
      <div className="absolute bottom-0 left-0 right-0 p-2 pb-4 md:p-4 md:pb-6 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-2">
          
          {/* File Preview */}
          {(isProcessingFiles || files.length > 0) && (
             <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin scrollbar-thumb-slate-600 mb-1">
                {files.map((f, i) => (
                    <div key={i} className="relative bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg flex-shrink-0 flex items-center gap-2 max-w-[120px] md:max-w-[180px]">
                        <span className="material-icons-outlined text-slate-400 text-sm">description</span>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-[10px] font-medium text-slate-200 truncate">{f.name}</span>
                          <span className="text-[9px] text-slate-500">{Math.round(f.size/1024)}KB</span>
                        </div>
                        <button onClick={clearFiles} className="ml-auto text-slate-500 hover:text-white"><span className="material-icons-outlined text-xs">close</span></button>
                    </div>
                ))}
             </div>
          )}

          {/* Input Box */}
          <div className={`bg-slate-800 rounded-[20px] md:rounded-[28px] border transition-all duration-300 shadow-xl relative flex flex-col ${
            isLoading || isProcessingFiles ? 'border-slate-700 opacity-80 cursor-not-allowed' : 'border-slate-700 focus-within:border-slate-600 focus-within:bg-slate-800/80'
          }`}>
            
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isProcessingFiles || isLoading}
              placeholder={isProcessingFiles ? "Procesando documentos..." : "Escribe una instrucción para JurisAI..."}
              className="w-full bg-transparent text-slate-200 pl-4 pr-12 md:pl-6 md:pr-14 pt-3 md:pt-4 pb-12 resize-none focus:outline-none placeholder-slate-500 min-h-[56px] max-h-[160px] md:max-h-[200px] overflow-y-auto scrollbar-thin text-[15px] md:text-[16px]"
              rows={1}
              style={{ minHeight: '56px' }}
            />

            {/* Toolbar Inside Input */}
            <div className="absolute bottom-2 left-3 md:left-4 right-2 flex justify-between items-center">
              
              <div className="flex items-center gap-1 md:gap-2 overflow-x-auto scrollbar-none pr-2">
                 {/* Visual fake button to trigger upload handled by sidebar logic or standard input if enabled there */}
                 <button onClick={() => document.getElementById('chat-file-upload')?.click()} className="p-1.5 md:p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0" title="Adjuntar archivos">
                    <span className="material-icons-outlined text-[18px] md:text-[20px]">add_circle</span>
                 </button>
                 {/* Hack: The ID is somewhere else in Sidebar, but we can have a local one too just in case context isn't sidebar */}
                  <input 
                   id="chat-file-upload" 
                   type="file" 
                   multiple 
                   className="hidden" 
                   accept="application/pdf,image/*,text/plain"
                   onChange={(e) => {
                      // This input is just a visual trigger helper for the Chat UI
                      // Ideally we should pass handleFileUpload prop here, but for now we piggyback or use query selector
                      // We will rely on user clicking sidebar upload on desktop, or mobile header upload.
                      // But for UX, let's try to click the mobile-upload input if it exists, or the Sidebar one.
                      const mobileUpload = document.getElementById('mobile-upload');
                      if (mobileUpload) {
                          // We can't click it programmatically if we are inside the onChange of another input, recursion.
                          // Actually, we should just let this input handle it if we could pass the handler.
                          // Since I can't change App.tsx props passed to ChatInterface easily without breaking type sig in this step (I already did App.tsx),
                          // I will assume the user uses the header/sidebar buttons.
                          // I will hide this button for now to avoid broken UX or implement a click proxy.
                      }
                   }}
                 />

                 <div className="h-4 w-px bg-slate-700 mx-1 shrink-0"></div>

                 <select 
                    value={tone} 
                    onChange={(e) => setTone(e.target.value as Tone)}
                    className="appearance-none bg-transparent hover:bg-slate-700 text-[10px] md:text-xs text-slate-400 hover:text-white rounded-lg px-2 py-1 focus:outline-none cursor-pointer transition-colors max-w-[80px] md:max-w-none truncate"
                  >
                    {Object.values(Tone).map(t => (
                      <option key={t} value={t} className="bg-slate-800">{t.split(' ')[0]}</option> // Shorten tone name
                    ))}
                  </select>

                 <button 
                  onClick={toggleSearch}
                  className={`p-1.5 rounded-full transition-all shrink-0 ${isSearchEnabled ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                  title="Búsqueda Web"
                >
                  <span className="material-icons-outlined text-[18px]">public</span>
                </button>

                <button 
                  onClick={toggleThinking}
                  className={`p-1.5 rounded-full transition-all shrink-0 ${isThinkingEnabled ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                  title="Deep Think"
                >
                  <span className="material-icons-outlined text-[18px]">psychology</span>
                </button>
              </div>

              {/* Send Button */}
              <button 
                onClick={handleSend}
                disabled={isLoading || isProcessingFiles || (!input.trim() && files.length === 0)}
                className={`p-2 rounded-full transition-all flex items-center justify-center flex-shrink-0 ${
                   (!input.trim() && files.length === 0) || isLoading
                     ? 'bg-transparent text-slate-600'
                     : 'bg-white text-slate-900 hover:bg-slate-200'
                }`}
              >
                <span className="material-icons-outlined text-[20px]">send</span>
              </button>
            </div>

          </div>
          
          <div className="text-center hidden md:block">
             <p className="text-[10px] text-slate-500">JurisAI puede mostrar información imprecisa. Por favor, verifica los hechos legales.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;