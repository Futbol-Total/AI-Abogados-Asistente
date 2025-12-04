import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import VoiceAssistant from './components/VoiceAssistant';
import { Message, Attachment, Tone } from './types';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [tone, setTone] = useState<Tone>(Tone.FORMAL);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const handleFileUpload = async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) return;
    
    setIsProcessingFiles(true);
    const filesArray = Array.from(fileList);
    // Process in batches to prevent UI freezing with 100+ files
    const batchSize = 20; 
    const newAttachments: Attachment[] = [];

    try {
      for (let i = 0; i < filesArray.length; i += batchSize) {
        const batch = filesArray.slice(i, i + batchSize);
        const batchPromises = batch.map(file => new Promise<Attachment>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve({
              name: file.name,
              mimeType: file.type,
              data: base64,
              size: file.size
            });
          };
          reader.readAsDataURL(file);
        }));

        const batchResults = await Promise.all(batchPromises);
        newAttachments.push(...batchResults);
        // Small yield to allow UI updates
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      setFiles(prev => [...prev, ...newAttachments]);
    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  const resetChat = () => {
    setMessages([]);
    setFiles([]);
    setTone(Tone.FORMAL);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-white font-sans">
      
      {/* Sidebar for Desktop */}
      <div className="hidden md:block h-full">
        <Sidebar 
          onFileUpload={handleFileUpload} 
          openVoice={() => setIsVoiceOpen(true)}
          resetChat={resetChat}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative">
        
        {/* Mobile Header */}
        <div className="md:hidden bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
           <h1 className="font-bold flex items-center gap-2">
             <span className="material-icons-outlined text-yellow-600">gavel</span>
             JurisAI
           </h1>
           <div className="flex gap-3">
             <button onClick={() => setIsVoiceOpen(true)}>
               <span className="material-icons-outlined text-green-400">mic</span>
             </button>
             <button onClick={() => document.getElementById('mobile-upload')?.click()}>
               <span className="material-icons-outlined text-blue-400">upload_file</span>
             </button>
             {/* Hidden input for mobile upload trigger */}
             <input 
               id="mobile-upload"
               type="file" 
               multiple 
               className="hidden" 
               accept="application/pdf,image/*,text/plain"
               onChange={(e) => e.target.files && handleFileUpload(e.target.files)} 
              />
           </div>
        </div>

        <ChatInterface 
          files={files}
          clearFiles={() => setFiles([])}
          tone={tone}
          setTone={setTone}
          isSearchEnabled={isSearchEnabled}
          toggleSearch={() => setIsSearchEnabled(!isSearchEnabled)}
          isThinkingEnabled={isThinkingEnabled}
          toggleThinking={() => setIsThinkingEnabled(!isThinkingEnabled)}
          messages={messages}
          addMessage={addMessage}
          isProcessingFiles={isProcessingFiles}
        />

        {isVoiceOpen && (
          <VoiceAssistant onClose={() => setIsVoiceOpen(false)} />
        )}
      </div>
    </div>
  );
};

export default App;