import React, { useRef } from 'react';
import { SavedCase, User } from '../types';

interface SidebarProps {
  onFileUpload: (files: FileList) => void;
  openVoice: () => void;
  resetChat: () => void;
  user: User | null;
  onLogout: () => void;
  savedCases: SavedCase[];
  loadCase: (c: SavedCase) => void;
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onFileUpload, openVoice, resetChat, user, onLogout, savedCases, loadCase, isCollapsed, toggleSidebar
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filter cases for current user
  const userCases = savedCases.filter(c => c.username === user?.username);

  return (
    <div className="bg-slate-950 border-r border-slate-800 flex flex-col h-full flex-shrink-0 transition-all duration-300">
      <div className={`p-4 border-b border-slate-800/50 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div className="overflow-hidden whitespace-nowrap">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="material-icons-outlined text-yellow-600">gavel</span>
              JurisAI
            </h1>
            <p className="text-slate-500 text-[10px] mt-1 tracking-wide">DESPACHO VIRTUAL</p>
          </div>
        )}
        <button 
          onClick={toggleSidebar}
          className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-800"
          title={isCollapsed ? "Expandir" : "Contraer"}
        >
          <span className="material-icons-outlined">{isCollapsed ? 'menu' : 'menu_open'}</span>
        </button>
      </div>

      <div className="px-3 py-4 space-y-3">
        <button 
          onClick={resetChat}
          className={`w-full bg-blue-700 hover:bg-blue-600 text-white rounded-lg flex items-center transition-all font-medium text-sm shadow-lg shadow-blue-900/20 ${isCollapsed ? 'justify-center py-3 px-0' : 'justify-center gap-2 py-3'}`}
          title="Nueva Consulta"
        >
          <span className="material-icons-outlined">add</span>
          {!isCollapsed && <span>Nueva Consulta</span>}
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()}
          className={`w-full bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center transition-all border border-slate-700 text-sm ${isCollapsed ? 'justify-center py-3 px-0' : 'justify-center gap-2 py-3'}`}
          title="Carga Masiva (100+)"
        >
          <span className="material-icons-outlined">upload_file</span>
          {!isCollapsed && <span>Carga Masiva</span>}
        </button>
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          className="hidden" 
          accept="application/pdf,image/*,text/plain"
          onChange={handleFileChange} 
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-none">
        {!isCollapsed && (
           <h3 className="text-slate-500 text-xs font-bold uppercase mb-3 tracking-wider sticky top-0 bg-slate-950 py-1 z-10">
             Historial
           </h3>
        )}
        
        {userCases.length === 0 ? (
          !isCollapsed && <p className="text-slate-600 text-xs italic text-center mt-4">Sin historial.</p>
        ) : (
          <div className="space-y-2">
            {userCases.slice().reverse().map((c) => (
              <button
                key={c.id}
                onClick={() => loadCase(c)}
                className={`w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg group transition-all ${isCollapsed ? 'p-2 flex justify-center' : 'p-3'}`}
                title={c.title}
              >
                {isCollapsed ? (
                  <span className="material-icons-outlined text-slate-500 group-hover:text-white">folder</span>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-blue-400 font-mono">{c.date.split('T')[0]}</span>
                      <span className="material-icons-outlined text-[14px] text-slate-600 group-hover:text-white">folder_open</span>
                    </div>
                    <h4 className="text-slate-300 text-sm font-medium truncate group-hover:text-white">{c.title}</h4>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`p-3 border-t border-slate-800 bg-slate-900/50 ${isCollapsed ? 'flex flex-col items-center gap-4' : ''}`}>
         <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'justify-between'}`}>
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-600 to-yellow-400 flex items-center justify-center text-slate-900 font-bold text-xs uppercase shrink-0">
                {user?.username.slice(0,2)}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                   <span className="text-sm text-white font-medium truncate max-w-[100px]">{user?.username}</span>
                   <span className="text-[10px] text-slate-500">En línea</span>
                </div>
              )}
           </div>
           {!isCollapsed && (
             <button 
               onClick={onLogout}
               className="text-slate-400 hover:text-red-400 transition-colors"
               title="Cerrar Sesión"
             >
               <span className="material-icons-outlined">logout</span>
             </button>
           )}
         </div>
         
         {isCollapsed && (
            <button 
               onClick={onLogout}
               className="text-slate-400 hover:text-red-400 transition-colors mt-2"
               title="Cerrar Sesión"
             >
               <span className="material-icons-outlined">logout</span>
             </button>
         )}

         {!isCollapsed ? (
           <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={openVoice} className="flex items-center justify-center gap-1 bg-slate-800 p-2 rounded text-xs text-slate-300 hover:text-white hover:bg-slate-700">
                 <span className="material-icons-outlined text-green-400 text-sm">mic</span>
                 Voz
              </button>
              <div className="flex items-center justify-center gap-1 bg-slate-800 p-2 rounded text-xs text-slate-500 cursor-not-allowed opacity-50">
                 <span className="material-icons-outlined text-sm">settings</span>
                 Ajustes
              </div>
           </div>
         ) : (
            <button onClick={openVoice} className="mt-2 bg-slate-800 p-2 rounded-full text-green-400 hover:bg-slate-700" title="Voz">
               <span className="material-icons-outlined text-sm">mic</span>
            </button>
         )}
      </div>
    </div>
  );
};

export default Sidebar;