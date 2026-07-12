import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lock, Mail, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (!success) {
      setError('E-mail ou senha incorretos.');
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#07090e] text-[#f1f5f9] font-sans relative overflow-hidden">
      {/* Background glowing blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 bg-[#0c0e16]/80 backdrop-blur-xl border border-white/[0.04] rounded-2xl shadow-2xl flex flex-col items-center z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white text-2xl shadow-[0_0_30px_rgba(99,102,241,0.5)] mb-4">
          CF
        </div>
        <h2 className="text-xl font-bold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-300">
          ClinicFlow Admin
        </h2>
        <p className="text-[10px] text-indigo-400 font-semibold tracking-widest uppercase mt-1 mb-8">
          Acesso Restrito
        </p>

        {error && (
          <div className="w-full p-3 mb-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              E-mail
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <Mail size={16} />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-11 pr-4 py-3 bg-[#131622]/60 border border-white/[0.06] focus:border-indigo-500/60 rounded-xl text-sm outline-none text-white placeholder-slate-500 transition-all font-semibold"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <Lock size={16} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-[#131622]/60 border border-white/[0.06] focus:border-indigo-500/60 rounded-xl text-sm outline-none text-white placeholder-slate-500 transition-all font-semibold"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 mt-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:from-indigo-500/50 disabled:to-violet-600/50 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] text-xs cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <span>Entrar no Sistema</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
export default Login;
