
import React, { useState } from 'react';
import { Button } from './ui/Button';
import { AuthService } from '../services/authService';
import { X, Mail, Lock, User, ArrowRight, AlertCircle, ArrowLeft, Send, Terminal, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

type AuthMode = 'login' | 'signup' | 'reset';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (authMode === 'reset') {
        if (!email) throw new Error("IDENTIFIER_MISSING");
        setResetSent(true);
      } else {
        let user;
        if (authMode === 'login') {
          user = await AuthService.login(email, password);
        } else {
          if (!name) throw new Error("NAME_IDENTIFIER_MISSING");
          user = await AuthService.register(email, password, name);
        }
        onSuccess(user);
      }
    } catch (err: any) {
      setError(err.message.toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch(authMode) {
      case 'login': return 'INIT_CORE_SESSION';
      case 'signup': return 'PRO_LICENSE_ENROLL';
      case 'reset': return 'CREDENTIAL_RECOVERY';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-base/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-line rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300 relative">
        
        {/* Tactical Glow Elements */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-signal/10 blur-[60px] rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-signal/50 to-transparent"></div>

        <div className="p-8 relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-signal mb-1">
                <Terminal size={14} />
                <span className="text-[8px] font-mono tracking-[0.4em] font-bold uppercase">SYSTEM_ACCESS_v2</span>
              </div>
              <h2 className="text-xl font-bold text-white font-mono tracking-tighter uppercase">{getTitle()}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-sm text-zinc-600 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-950/20 border-l-2 border-red-500 flex items-center gap-3 text-red-400 font-mono text-[10px] animate-in slide-in-from-left-2">
              <AlertCircle size={14} />
              <span>ERROR_CODE: {error}</span>
            </div>
          )}

          {authMode === 'reset' && resetSent ? (
            <div className="text-center py-10 space-y-6">
              <div className="w-16 h-16 border border-emerald-500/30 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                <div className="absolute inset-0 border border-emerald-500 rounded-full animate-ping opacity-20"></div>
                <Send className="text-emerald-400" size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white font-mono uppercase">Check_Transmission</h3>
                <p className="text-zinc-500 text-xs font-mono">Link transmitted to:<br/><span className="text-signal">{email}</span></p>
              </div>
              <Button variant="secondary" className="w-full" onClick={() => { setAuthMode('login'); setResetSent(false); }}>
                RETURN_TO_LOGIN
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {authMode === 'signup' && (
                <div className="space-y-1.5 group animate-in fade-in duration-300">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Legal_Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-signal transition-colors" size={14} />
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-base/50 border border-line rounded-sm py-3 pl-10 pr-4 text-white text-xs font-mono focus:border-signal focus:outline-none focus:bg-base/80 transition-all placeholder:text-zinc-800"
                      placeholder="ENTER_IDENTITY..."
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5 group">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Network_Endpoint (Email)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-signal transition-colors" size={14} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-base/50 border border-line rounded-sm py-3 pl-10 pr-4 text-white text-xs font-mono focus:border-signal focus:outline-none focus:bg-base/80 transition-all placeholder:text-zinc-800"
                    placeholder="USER@DOMAIN.TLD"
                  />
                </div>
              </div>

              {authMode !== 'reset' && (
                <div className="space-y-1.5 group animate-in fade-in duration-300">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Security_Token (Pass)</label>
                    {authMode === 'login' && (
                      <button 
                        type="button"
                        onClick={() => setAuthMode('reset')}
                        className="text-[9px] text-signal/70 hover:text-signal uppercase font-bold"
                      >
                        RECOVER?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-signal transition-colors" size={14} />
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-base/50 border border-line rounded-sm py-3 pl-10 pr-4 text-white text-xs font-mono focus:border-signal focus:outline-none focus:bg-base/80 transition-all placeholder:text-zinc-800"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                variant="primary" 
                className="w-full py-5 text-xs tracking-[0.2em] mt-4 shadow-lg shadow-signal/10 relative overflow-hidden group" 
                isLoading={loading}
              >
                {!loading && (
                  <>
                    <span className="relative z-10">{authMode === 'login' ? 'ESTABLISH_SESSION' : authMode === 'signup' ? 'REGISTER_USER' : 'INIT_RECOVERY'}</span>
                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform relative z-10" size={14} />
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </>
                )}
              </Button>
            </form>
          )}

          {!resetSent && (
            <div className="mt-8 text-center pt-6 border-t border-line/50">
              {authMode === 'reset' ? (
                <button 
                  onClick={() => setAuthMode('login')} 
                  className="text-[10px] text-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto uppercase font-mono tracking-widest"
                >
                  <ArrowLeft size={12} /> BACK_TO_AUTH
                </button>
              ) : (
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} 
                  className="text-[10px] text-zinc-500 hover:text-signal transition-colors uppercase font-mono tracking-widest"
                >
                  {authMode === 'login' ? "// NO_ACCOUNT? CREATE_ENTRY" : "// EXISTING_USER? RE_AUTH"}
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Visual Footer Security Badge */}
        <div className="bg-zinc-950/50 p-3 flex items-center justify-center gap-2 border-t border-line">
           <ShieldCheck size={10} className="text-signal" />
           <span className="text-[7px] font-mono text-zinc-600 uppercase tracking-[0.4em]">ENCRYPTED_NEURAL_LINK_STABLE</span>
        </div>
      </div>
    </div>
  );
};
