import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import VoiceAssistant from './components/VoiceAssistant';
import Login from './components/Login';
import { Message, Attachment, Tone, User, SavedCase } from './types';
import { saveCaseToDB, getCasesFromDB, saveUserToDB, getUserFromDB } from './services/storage';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Simple Error Boundary to catch crashes (Blue Screen fix)
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Application Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-6 text-center">
          <div className="bg-slate-800 p-8 rounded-2xl border border-red-500/30 max-w-md shadow-2xl">
            <span className="material-icons-outlined text-6xl text-red-500 mb-4">error_outline</span>
            <h1 className="text-2xl font-bold mb-2">Se produjo un error</h1>
            <p className="text-slate-400 mb-6 text-sm">
              Es posible que la memoria del navegador se haya agotado debido a la gran cantidad de archivos procesados.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-white font-medium transition-colors w-full flex items-center justify-center gap-2"
            >
              <span className="material-icons-outlined">refresh</span>
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [tone, setTone] = useState<Tone>(Tone.FORMAL);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  
  const [savedCases, setSavedCases] = useState<SavedCase[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState<string>(Date.now().toString());

  // Init: Load User
  useEffect(() => {
    const init = async () => {
      try {
        const storedUser = await getUserFromDB();
        if (storedUser) {
          setUser(storedUser);
          // Load cases for this user
          const cases = await getCasesFromDB(storedUser.username);
          setSavedCases(cases);
        }
      } catch (e) {
        console.error("Error creating/opening DB", e);
      }
    };
    init();
  }, []);

  const handleLogin = async (username: string) => {
    const newUser: User = { username, lastLogin: new Date() };
    setUser(newUser);
    await saveUserToDB(newUser);
    const cases = await getCasesFromDB(username);
    setSavedCases(cases);
  };

  const handleLogout = () => {
    setUser(null);
    setMessages([]);
    setFiles([]);
    setSavedCases([]);
  };

  // Helper to save current state to DB
  const saveCurrentCase = async (msgs: Message[]) => {
    if (!user) return;
    
    // Determine title if it's new
    let title = `Consulta ${new Date().toLocaleTimeString()}`;
    const existingCase = savedCases.find(c => c.id === currentCaseId);
    if (existingCase) {
      title = existingCase.title;
    } else if (msgs.length > 0) {
      // Use first user message as title preview if available
      const firstUserMsg = msgs.find(m => m.role === 'user');
      if (firstUserMsg) {
        title = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
        if (!title.trim()) title = "Análisis de Documentos";
      }
    }

    const previewText = msgs.length > 0 ? (msgs[msgs.length - 1].text.slice(0, 50) + '...') : 'Nuevo caso';

    const caseData: SavedCase = {
      id: currentCaseId,
      title,
      date: new Date().toISOString(),
      preview: previewText,
      messages: msgs,
      username: user.username
    };

    // Save to DB
    await saveCaseToDB(caseData);

    // Update local state list
    setSavedCases(prev => {
      const idx = prev.findIndex(c => c.id === currentCaseId);
      if (idx >= 0) {
        const newArr = [...prev];
        newArr[idx] = caseData;
        return newArr;
      }
      return [caseData, ...prev];
    });
  };

  const addMessage = async (msg: Message) => {
    const newMessages = [...messages, msg];
    setMessages(newMessages);
    await saveCurrentCase(newMessages);
  };

  const loadCase = (c: SavedCase) => {
    setCurrentCaseId(c.id);
    setMessages(c.messages);
    setFiles([]); 
    if (window.innerWidth < 768) {
      // Logic to close mobile menu if implemented
    }
  };

  const handleFileUpload = async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) return;
    
    setIsProcessingFiles(true);
    const filesArray = Array.from(fileList);
    const batchSize = 10; 
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
        await new Promise(resolve => setTimeout(resolve, 10)); // Breathe
      }
      
      setFiles(prev => [...prev, ...newAttachments]);
    } catch (error) {
      console.error("Error processing files:", error);
      alert("Error al procesar archivos. Intenta subir menos archivos a la vez.");
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setFiles([]);
    setTone(Tone.FORMAL);
    setCurrentCaseId(Date.now().toString());
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-slate-900 text-white font-sans">
        
        <div className={`hidden md:block h-full transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
          <Sidebar 
            onFileUpload={handleFileUpload} 
            openVoice={() => setIsVoiceOpen(true)}
            resetChat={resetChat}
            user={user}
            onLogout={handleLogout}
            savedCases={savedCases}
            loadCase={loadCase}
            isCollapsed={isSidebarCollapsed}
            toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        <div className="flex-1 flex flex-col h-full relative min-w-0">
          <div className="md:hidden bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
             <h1 className="font-bold flex items-center gap-2">
               <span className="material-icons-outlined text-yellow-600">gavel</span>
               JurisAI
             </h1>
             <div className="flex gap-3">
               <button onClick={() => setIsVoiceOpen(true)} className="p-2">
                 <span className="material-icons-outlined text-green-400">mic</span>
               </button>
               <button onClick={() => document.getElementById('mobile-upload')?.click()} className="p-2">
                 <span className="material-icons-outlined text-blue-400">upload_file</span>
               </button>
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
    </ErrorBoundary>
  );
};

export default App;