import React, { useState } from 'react';

interface LoginProps {
  onLogin: (username: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username.trim());
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
      <div className="w-full max-w-md p-8 bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <span className="material-icons-outlined text-6xl text-legal-gold mb-2 text-yellow-600">gavel</span>
          <h1 className="text-3xl font-bold tracking-tight">JurisAI Colombia</h1>
          <p className="text-slate-400 text-sm mt-2">Acceso Seguro para Abogados</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
              Identificación de Usuario / Firma
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 material-icons-outlined text-slate-500">person</span>
              <input
                type="text"
                id="username"
                className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder-slate-600"
                placeholder="Ej. Dr. Juan Perez"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-blue-900/30 flex items-center justify-center gap-2"
          >
            <span>Ingresar al Despacho</span>
            <span className="material-icons-outlined">arrow_forward</span>
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-500">
          © 2024 JurisAI. Sistema protegido y encriptado.
        </p>
      </div>
    </div>
  );
};

export default Login;