import React, { useState, useEffect } from 'react';
import { Search, Plus, UserCheck, ShieldAlert, Key, Edit3, Trash2, Loader, User, Camera, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { Usuario, PerfilAcesso } from '../types';

const UserAvatar: React.FC<{ foto?: string; nome: string }> = ({ foto, nome }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [foto]);

  if (foto && foto.trim() !== '' && !hasError) {
    return (
      <img
        src={foto}
        alt={nome}
        onError={() => setHasError(true)}
        className="w-8 h-8 rounded-full object-cover border border-indigo-500/40 shadow-sm shrink-0"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
      {nome ? nome[0].toUpperCase() : 'U'}
    </div>
  );
};

export const Usuarios: React.FC = () => {
  const { profissionais, refreshAll } = useApp();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal States
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form States
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [tel, setTel] = useState('');
  const [nasc, setNasc] = useState('');
  const [perfil, setPerfil] = useState('admin');
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [foto, setFoto] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaConf, setSenhaConf] = useState('');
  const [profId, setProfId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load users
      const { data: usersData, error: usersErr } = await supabase
        .from('usuarios')
        .select('*')
        .order('nome');
      if (usersErr) throw usersErr;

      const mappedUsers = (usersData || []).map(mappers.dbToUsuario);
      setUsuarios(mappedUsers);
      localStorage.setItem('cf_usuarios', JSON.stringify(mappedUsers));

      // Load profiles
      const { data: profilesData, error: profilesErr } = await supabase
        .from('perfis_acesso')
        .select('*');
      if (!profilesErr && profilesData) {
        const mappedProfiles = (profilesData || []).map(mappers.dbToPerfil);
        setPerfis(mappedProfiles);
        localStorage.setItem('cf_perfis_acesso', JSON.stringify(mappedProfiles));
      }
    } catch (e) {
      console.error(e);
      // Fallback local storage
      const saved = localStorage.getItem('cf_usuarios');
      if (saved) setUsuarios(JSON.parse(saved));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditId(null);
    setNome('');
    setEmail('');
    setCpf('');
    setRg('');
    setTel('');
    setNasc('');
    setPerfil('admin');
    setPerfilId(null);
    setStatus('Ativo');
    setFoto('');
    setSenha('');
    setSenhaConf('');
    setProfId(null);
    setIsOpen(true);
  };

  const openEditModal = (u: Usuario) => {
    setEditId(u.id);
    setNome(u.nome);
    setEmail(u.email);
    setCpf(u.cpf);
    setRg(u.rg);
    setTel(u.tel);
    setNasc(u.nasc);
    setPerfil(u.perfil);
    setPerfilId(u.perfilId || null);
    setStatus(u.status);
    setFoto(u.foto);
    setSenha('');
    setSenhaConf('');
    setProfId(u.profId || null);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (usuarios.length <= 1) {
      alert('Deve existir ao menos um usuário no sistema.');
      return;
    }
    const u = usuarios.find(x => x.id === id);
    if (!u) return;

    if (!confirm(`Deseja realmente excluir o usuário "${u.nome}"? Esta ação não pode ser desfeita.`)) return;

    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id);
      if (error) throw error;
      alert('Usuário excluído com sucesso.');
      loadData();
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao excluir usuário: ${e.message}`);
    }
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    if (!editId && !senha) {
      alert('Defina uma senha para o novo usuário.');
      return;
    }

    if (senha && senha !== senhaConf) {
      alert('As senhas não coincidem.');
      return;
    }

    if (senha && senha.length < 6) {
      alert('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    // Check duplicate email
    const duplicate = usuarios.some(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== editId);
    if (duplicate) {
      alert('Já existe um usuário com este e-mail cadastrado.');
      return;
    }

    setSubmitting(true);
    
    const uid = editId || `usr_${Date.now()}`;
    const payload: Partial<Usuario> = {
      id: uid,
      nome,
      email,
      cpf,
      rg,
      tel,
      nasc,
      perfil,
      perfilId: perfilId || null,
      status,
      foto,
      profId: perfil === 'prof' ? profId : null,
      criadoEm: editId ? undefined : new Date().toISOString()
    };

    if (senha) {
      payload.senha = senha;
    }

    try {
      const { error } = await supabase
        .from('usuarios')
        .upsert(mappers.usuarioToDb(payload), { onConflict: 'id' });
      
      if (error) throw error;

      alert(editId ? 'Usuário atualizado com sucesso!' : 'Usuário cadastrado com sucesso!');
      setIsOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar usuário: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = usuarios.filter(u =>
    u.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.cpf.includes(searchQuery)
  );

  const getPerfilLabel = (perfilVal: string, perfIdVal?: string | null) => {
    if (perfilVal === 'admin') return '👑 Admin';
    if (perfilVal === 'recepcao') return '📋 Recepção';
    if (perfilVal === 'prof') return '🩺 Profissional';
    
    const custom = perfis.find(p => p.id === perfIdVal);
    return custom ? `🛡️ ${custom.nome}` : `Perfil (${perfilVal})`;
  };

  const getPerfilColorClass = (perfilVal: string) => {
    if (perfilVal === 'admin') return 'text-indigo-400';
    if (perfilVal === 'recepcao') return 'text-emerald-400';
    if (perfilVal === 'prof') return 'text-amber-400';
    return 'text-indigo-300';
  };

  // Counts
  const countAdmin = usuarios.filter(u => u.perfil === 'admin').length;
  const countRecepcao = usuarios.filter(u => u.perfil === 'recepcao').length;
  const countProf = usuarios.filter(u => u.perfil === 'prof').length;

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* STICKY HEADER AND CONTROLS */}
      <div className="sticky top-0 bg-[#07090e]/95 backdrop-blur-md z-20 pb-4 pt-1 -mx-8 px-8 border-b border-white/[0.04] space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-semibold">Configurações Gerais</span>
            <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans">Usuários & Acesso</h2>
            <p className="text-xs text-slate-400 mt-1">Gerencie os logins, credenciais de acesso e atribuição de perfis dos usuários do sistema.</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-xs"
          >
            <Plus size={14} />
            Novo Usuário
          </button>
        </div>

        {/* KPI Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex justify-between items-center shadow-md">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Administradores</span>
              <p className="text-xl font-black text-white mt-1.5 font-mono">{countAdmin}</p>
            </div>
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-xl">
              <Shield size={16} />
            </div>
          </div>

          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex justify-between items-center shadow-md">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recepção</span>
              <p className="text-xl font-black text-white mt-1.5 font-mono">{countRecepcao}</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-xl">
              <UserCheck size={16} />
            </div>
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex justify-between items-center shadow-md">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profissionais</span>
              <p className="text-xl font-black text-white mt-1.5 font-mono">{countProf}</p>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-xl">
              <ShieldAlert size={16} />
            </div>
          </div>
        </div>

        {/* Search Filter Bar */}
        <div className="p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl flex items-center gap-3 shadow-lg">
          <Search size={16} className="text-slate-400 ml-1" />
          <input
            type="text"
            placeholder="Buscar usuário por nome, email, CPF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-0 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 text-xs"
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-360px)] scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-[#131622]">
                <th className="p-4 w-12 text-center">Foto</th>
                <th className="p-4">Nome</th>
                <th className="p-4">E-mail</th>
                <th className="p-4">CPF</th>
                <th className="p-4">Telefone</th>
                <th className="p-4">Perfil</th>
                <th className="p-4">Vínculo Prof.</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader size={16} className="animate-spin text-indigo-500 inline-block mr-2" />
                    Carregando usuários...
                  </td>
                </tr>
              ) : filteredUsers.map((u) => {
                const associatedProf = u.profId ? profissionais.find(p => p.id === u.profId) : null;
                const userFoto = u.foto || (associatedProf ? associatedProf.foto : '') || '';

                return (
                  <tr key={u.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="p-4">
                      <UserAvatar foto={userFoto} nome={u.nome} />
                    </td>
                    <td className="p-4 font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{u.nome}</td>
                    <td className="p-4 text-slate-400">{u.email}</td>
                    <td className="p-4 text-slate-400 font-mono">{u.cpf || '—'}</td>
                    <td className="p-4 text-slate-300 font-mono">{u.tel || '—'}</td>
                    <td className="p-4 font-semibold">
                      <span className={getPerfilColorClass(u.perfil)}>{getPerfilLabel(u.perfil, u.perfilId)}</span>
                    </td>
                    <td className="p-4">
                      {associatedProf ? (
                        <span className="text-amber-400 font-medium">🩺 {associatedProf.nome}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        u.status === 'Ativo'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                          : 'bg-slate-500/10 text-slate-400 border-white/10'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-lg text-slate-300 transition-all"
                          title="Editar"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1.5 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 rounded-lg text-rose-400 transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-medium">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in text-xs">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {editId ? 'Editar Usuário' : 'Novo Usuário'}
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">Cadastre o login e perfil do profissional ou atendente</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Photo Upload Row */}
              <div className="flex items-center gap-4 bg-[#161a26]/50 p-3 rounded-xl border border-white/[0.06]">
                <div className="relative group w-14 h-14 rounded-full border-2 border-indigo-500/40 bg-slate-800/50 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                  {foto ? (
                    <img src={foto} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} className="text-slate-500" />
                  )}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <Camera size={14} className="text-white" />
                    <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
                  </label>
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-200 text-xs block">Avatar / Foto de Perfil</span>
                    {foto && (
                      <button
                        type="button"
                        onClick={() => setFoto('')}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold underline cursor-pointer"
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="URL da foto ou escolha um arquivo..."
                    value={foto}
                    onChange={(e) => setFoto(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all">
                    <Camera size={12} />
                    <span>Escolher Foto do Computador</span>
                    <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">E-mail (Login) *</label>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">CPF</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">RG</label>
                  <input
                    type="text"
                    value={rg}
                    onChange={(e) => setRg(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Telefone</label>
                  <input
                    type="text"
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nascimento</label>
                  <input
                    type="date"
                    value={nasc}
                    onChange={(e) => setNasc(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Perfil *</label>
                  <select
                    value={perfil}
                    onChange={(e) => {
                      setPerfil(e.target.value);
                      if (e.target.value !== 'admin' && e.target.value !== 'recepcao' && e.target.value !== 'prof') {
                        setPerfilId(e.target.value);
                      } else {
                        setPerfilId(null);
                      }
                    }}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                  >
                    <option value="admin">Administrador (Base)</option>
                    <option value="recepcao">Recepção (Base)</option>
                    <option value="prof">Profissional (Base)</option>
                    {perfis.map(p => (
                      <option key={p.id} value={p.id}>🛡️ {p.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              {perfil === 'prof' && (
                <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2">
                  <label className="block text-amber-400 font-bold">Vincular Profissional de Saúde</label>
                  <select
                    value={profId || ''}
                    onChange={(e) => setProfId(Number(e.target.value) || null)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                  >
                    <option value="">— Sem Vínculo (Autônomo) —</option>
                    {profissionais.filter(p => p.status === 'Ativo').map(p => (
                      <option key={p.id} value={p.id}>🩺 {p.nome} ({p.esp || 'Sem esp.'})</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block mt-1">Isso restringe este usuário a visualizar apenas sua própria agenda e seus prontuários correspondentes.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Senha {editId && '(Deixe em branco p/ manter)'}</label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Confirmar Senha</label>
                  <input
                    type="password"
                    value={senhaConf}
                    onChange={(e) => setSenhaConf(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  {submitting && <Loader size={12} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
