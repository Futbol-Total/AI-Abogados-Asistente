import React, { useRef } from 'react';
import { Attachment } from '../types';

interface SidebarProps {
  onFileUpload: (files: FileList) => void;
  openVoice: () => void;
  resetChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onFileUpload, openVoice, resetChat }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
    }
    // Reset value so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full flex-shrink-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="material-icons-outlined text-yellow-600">gavel</span>
          JurisAI
        </h1>
        <p className="text-slate-500 text-xs mt-1 tracking-wide">ASISTENTE LEGAL COLOMBIA</p>
      </div>

      <div className="px-4 space-y-3">
        <button 
          onClick={resetChat}
          className="w-full bg-blue-700 hover:bg-blue-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-all font-medium text-sm shadow-lg shadow-blue-900/20"
        >
          <span className="material-icons-outlined">add</span>
          Nueva Consulta
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-lg flex items-center justify-center gap-2 transition-all border border-slate-700 text-sm"
        >
          <span className="material-icons-outlined">upload_file</span>
          Carga Masiva (Ilimitada)
        </button>
        <p className="text-[10px] text-center text-slate-500">
           Carga 100+ Documentos a la vez
        </p>
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          className="hidden" 
          accept="application/pdf,image/*,text/plain"
          onChange={handleFileChange} 
        />
      </div>

      <div className="mt-8 px-4">
        <h3 className="text-slate-500 text-xs font-bold uppercase mb-4 tracking-wider">Herramientas</h3>
        <nav className="space-y-1">
          <button onClick={openVoice} className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-md transition-colors text-sm">
            <span className="material-icons-outlined text-green-400">mic</span>
            Modo Voz (En vivo)
          </button>
          <div className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-md transition-colors text-sm cursor-not-allowed opacity-50" title="Próximamente">
            <span className="material-icons-outlined text-purple-400">video_library</span>
            Análisis de Video
          </div>
          <div className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-md transition-colors text-sm cursor-not-allowed opacity-50" title="Próximamente">
            <span className="material-icons-outlined text-orange-400">folder_shared</span>
            Casos Guardados
          </div>
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-slate-800">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-600 to-yellow-400 flex items-center justify-center text-slate-900 font-bold text-xs">AB</div>
            <div className="flex flex-col">
               <span className="text-sm text-white font-medium">Abogado Pro</span>
               <span className="text-xs text-slate-500">Plan Premium</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Sidebar;