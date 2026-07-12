import React, { useState, useEffect } from 'react';
import { Plus, Shield, Lock, Trash2, Edit3, Loader, Check, CircleHelp } from 'lucide-react';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { PerfilAcesso } from '../types';

interface ModuloItem {
  id: string;
  label: string;
  desc: string;
}

interface ModuloSecao {
  secao: string;
  itens: ModuloItem[];
}

export const Perfis: React.FC = () => {
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  
  // Modal States
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form States
  const [nome, setNome] = useState('');
  const [desc, setDesc] = useState('');
  const [cor, setCor] = useState('#6366f1');
  const [selectedModulos, setSelectedModulos] = useState<string[]>([]);
  const [selectedSubPerms, setSelectedSubPerms] = useState<{ [modulo: string]: string[] }>({});

  const MODULOS_SISTEMA: ModuloSecao[] = [
    {
      secao: 'Principal',
      itens: [
        { id: 'dashboard', label: 'Dashboard', desc: 'Visão geral e indicadores' },
        { id: 'agenda', label: 'Agenda', desc: 'Calendário de agendamentos' },
        { id: 'chat', label: 'Chat com Pacientes', desc: 'Mensagens e comunicação' }
      ]
    },
    {
      secao: 'Cadastros',
      itens: [
        { id: 'pacientes', label: 'Pacientes', desc: 'Cadastro de pacientes' },
        { id: 'profissionais', label: 'Profissionais', desc: 'Cadastro de profissionais de saúde' },
        { id: 'planos', label: 'Planos de Saúde', desc: 'Operadoras de saúde e convênios' },
        { id: 'procedimentos', label: 'Tabela de Preços', desc: 'Procedimentos e tabela de preços' },
        { id: 'espera', label: 'Lista de Espera', desc: 'Fila de espera de atendimentos' },
        { id: 'historico', label: 'Histórico Paciente', desc: 'Prontuários e evolução clínica' }
      ]
    },
    {
      secao: 'Faturamento',
      itens: [
        { id: 'guias', label: 'Guias SADT', desc: 'Emissão e gestão de guias SADT' },
        { id: 'senhas', label: 'Senhas / Autorizações', desc: 'Controle de senhas de planos' },
        { id: 'lotes', label: 'Lotes TISS', desc: 'Geração e exportação de XML TISS' }
      ]
    },
    {
      secao: 'Sistema',
      itens: [
        { id: 'importar', label: 'Importar Agenda', desc: 'Importação de agendas externas' },
        { id: 'relatorios', label: 'Relatórios', desc: 'Dashboards e relatórios' },
        { id: 'fechamento', label: 'Fechamento Mensal', desc: 'Fechamento de terapeutas' },
        { id: 'financeiro', label: 'Financeiro', desc: 'Repasses e recibos' },
        { id: 'ctrlMeses', label: 'Controle de Meses', desc: 'Abrir/fechar competências' },
        { id: 'feriados', label: 'Feriados', desc: 'Cadastro de feriados' },
        { id: 'config', label: 'Configurações', desc: 'Configurações gerais do sistema' },
        { id: 'usuarios', label: 'Usuários & Acesso', desc: 'Gestão de usuários e logins' },
        { id: 'perfis', label: 'Perfis de Acesso', desc: 'Perfis de acesso e permissões' }
      ]
    }
  ];

  const SUB_PERMS: { [modulo: string]: { id: string; label: string }[] } = {
    pacientes: [
      { id: 'criar', label: 'Criar / Editar pacientes' },
      { id: 'excluir', label: 'Excluir pacientes' },
      { id: 'prontuario', label: 'Ver prontuário completo' }
    ],
    agenda: [
      { id: 'criar', label: 'Criar agendamentos' },
      { id: 'editar', label: 'Editar agendamentos' },
      { id: 'excluir', label: 'Excluir agendamentos' },
      { id: 'bloquear', label: 'Bloquear agenda' }
    ],
    profissionais: [
      { id: 'criar', label: 'Criar / Editar profissionais' },
      { id: 'excluir', label: 'Excluir profissionais' }
    ],
    guias: [
      { id: 'criar', label: 'Criar guias SADT' },
      { id: 'assinar', label: 'Assinar / Autorizar guias' },
      { id: 'excluir', label: 'Excluir guias' }
    ],
    relatorios: [
      { id: 'financeiro', label: 'Ver relatórios financeiros' },
      { id: 'exportar', label: 'Exportar relatórios (CSV)' }
    ],
    usuarios: [
      { id: 'criar', label: 'Criar usuários' },
      { id: 'editar', label: 'Editar usuários' },
      { id: 'excluir', label: 'Excluir usuários' }
    ]
  };

  const baseProfiles = [
    {
      id: '__admin__',
      nome: 'Administrador (padrão)',
      cor: '#6366f1',
      bloqueado: true,
      desc: 'Acesso total ao sistema — não pode ser alterado',
      modulos: MODULOS_SISTEMA.flatMap(s => s.itens.map(i => i.id)),
      subPerms: Object.fromEntries(Object.entries(SUB_PERMS).map(([k, v]) => [k, v.map(p => p.id)]))
    },
    {
      id: '__recepcao__',
      nome: 'Recepção (padrão)',
      cor: '#10b981',
      bloqueado: true,
      desc: 'Acesso a agenda, pacientes e faturamento básico',
      modulos: ['dashboard', 'agenda', 'pacientes', 'planos', 'espera', 'senhas'],
      subPerms: { pacientes: ['criar'], agenda: ['criar', 'editar'] }
    },
    {
      id: '__prof__',
      nome: 'Profissional (padrão)',
      cor: '#f59e0b',
      bloqueado: true,
      desc: 'Acesso a sua própria agenda, prontuários e guias',
      modulos: ['dashboard', 'agenda', 'historico', 'guias'],
      subPerms: { agenda: ['criar'], guias: ['criar'], pacientes: ['prontuario'] }
    }
  ];

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('perfis_acesso')
        .select('*')
        .order('nome');
      if (error) throw error;

      const customProfiles = (data || []).map(mappers.dbToPerfil);
      const allProfiles = [...baseProfiles];
      
      customProfiles.forEach(custom => {
        const idx = allProfiles.findIndex(p => p.id === custom.id);
        if (idx === -1) {
          allProfiles.push(custom);
        } else {
          allProfiles[idx] = { ...allProfiles[idx], ...custom };
        }
      });

      setPerfis(allProfiles);
      localStorage.setItem('cf_perfis_acesso', JSON.stringify(allProfiles));
      setSyncStatus(`Sincronizado • ${allProfiles.length} perfil(s)`);
    } catch (e: any) {
      console.error(e);
      setSyncStatus(`Erro ao carregar: ${e.message}`);
      // Fallback local storage
      const saved = localStorage.getItem('cf_perfis_acesso');
      if (saved) {
        setPerfis(JSON.parse(saved));
      } else {
        setPerfis(baseProfiles);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const openAddModal = () => {
    setEditId(null);
    setNome('');
    setDesc('');
    setCor('#6366f1');
    setSelectedModulos([]);
    setSelectedSubPerms({});
    setIsOpen(true);
  };

  const openEditModal = (item: PerfilAcesso) => {
    if (item.bloqueado) {
      alert('Este é um perfil base do sistema e não pode ser editado.');
      return;
    }
    setEditId(item.id);
    setNome(item.nome);
    setDesc(item.desc);
    setCor(item.cor);
    setSelectedModulos(item.modulos);
    setSelectedSubPerms(item.subPerms || {});
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    const item = perfis.find(p => p.id === id);
    if (!item) return;
    if (item.bloqueado) {
      alert('Este é um perfil base e não pode ser removido.');
      return;
    }

    if (!confirm(`Deseja realmente remover o perfil de acesso "${item.nome}"?`)) return;

    try {
      const { error } = await supabase
        .from('perfis_acesso')
        .delete()
        .eq('id', id);
      if (error) throw error;
      alert('Perfil removido com sucesso.');
      loadProfiles();
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao excluir perfil: ${e.message}`);
    }
  };

  const toggleModulo = (modId: string) => {
    if (selectedModulos.includes(modId)) {
      setSelectedModulos(selectedModulos.filter(id => id !== modId));
      // Clear sub-perms for this module
      const copy = { ...selectedSubPerms };
      delete copy[modId];
      setSelectedSubPerms(copy);
    } else {
      setSelectedModulos([...selectedModulos, modId]);
    }
  };

  const toggleSubPerm = (modId: string, permId: string) => {
    const copy = { ...selectedSubPerms };
    const current = copy[modId] || [];
    if (current.includes(permId)) {
      copy[modId] = current.filter(id => id !== permId);
    } else {
      copy[modId] = [...current, permId];
    }
    setSelectedSubPerms(copy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('Informe o nome do perfil.');
      return;
    }

    setSubmitting(true);
    const pid = editId || `perfil_${Date.now()}`;
    const payload: Partial<PerfilAcesso> = {
      id: pid,
      nome: nome.trim(),
      desc: desc.trim(),
      cor,
      modulos: selectedModulos,
      subPerms: selectedSubPerms
    };

    try {
      const { error } = await supabase
        .from('perfis_acesso')
        .upsert(mappers.perfilToDb(payload), { onConflict: 'id' });
      if (error) throw error;

      alert(editId ? 'Perfil atualizado com sucesso!' : 'Perfil criado com sucesso!');
      setIsOpen(false);
      loadProfiles();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar perfil: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-semibold">Segurança & Permissões</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans">Perfis de Acesso</h2>
          <p className="text-xs text-slate-400 mt-1">Defina papéis e restrinja quais módulos e ações específicas cada grupo de usuários pode realizar.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-xs"
        >
          <Plus size={14} />
          Novo Perfil
        </button>
      </div>

      {/* Info Card */}
      <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-3 shadow-lg">
        <CircleHelp size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
        <p className="text-slate-300 leading-relaxed">
          <strong className="text-white">Gerenciamento de Perfis:</strong> O sistema possui 3 perfis nativos padrão (Administrador, Recepção e Profissional). Perfis padrão são bloqueados para edição para manter a estabilidade do sistema. Crie perfis personalizados para controle fino de menus e ações internas.
        </p>
      </div>

      {/* Grid of Profiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {perfis.map((p) => (
          <div key={p.id} className="p-5 bg-[#131622]/50 border border-white/[0.04] rounded-2xl shadow-xl flex flex-col justify-between space-y-4 hover:border-white/10 transition-all">
            <div>
              <div className="flex justify-between items-center pb-2.5 border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.cor }} />
                  <span className="font-bold text-slate-200 text-sm">{p.nome}</span>
                </div>
                {p.bloqueado && (
                  <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 font-semibold">
                    <Lock size={8} /> Base
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-3 leading-relaxed min-h-[30px]">{p.desc || 'Sem descrição cadastrada.'}</p>

              <div className="mt-4 space-y-2">
                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block">Módulos Permitidos ({p.modulos.length})</span>
                <div className="flex flex-wrap gap-1">
                  {p.modulos.slice(0, 6).map(mId => (
                    <span key={mId} className="text-[9px] bg-slate-800 text-slate-300 border border-white/5 rounded px-2 py-0.5 font-mono">{mId}</span>
                  ))}
                  {p.modulos.length > 6 && (
                    <span className="text-[9px] bg-slate-800 text-slate-400 border border-white/5 rounded px-2 py-0.5">+{p.modulos.length - 6} mais</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.04] flex justify-end gap-1.5">
              {!p.bloqueado ? (
                <>
                  <button
                    onClick={() => openEditModal(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-xl text-slate-300 font-bold transition-all text-[10px]"
                  >
                    <Edit3 size={10} />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 rounded-xl text-rose-400 font-bold transition-all text-[10px]"
                  >
                    <Trash2 size={10} />
                    Remover
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-slate-500 italic py-1 px-2">Protegido</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in text-xs flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40 flex-shrink-0">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {editId ? 'Editar Perfil de Acesso' : 'Novo Perfil de Acesso'}
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">Configure as permissões de acesso aos menus e operações</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Nome do Perfil *</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Supervisor de Faturamento"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Cor do Indicador</label>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="color"
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      className="flex-1 bg-[#161a26] border border-white/[0.06] rounded-lg px-2 py-1.5 text-white text-[11px] font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Descrição</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Ex: Tem acesso somente ao cadastro de pacientes e ao faturamento..."
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-slate-300 font-bold uppercase tracking-wider text-[10px]">Permissões por Módulos & Sub-permissões</label>
                
                <div className="space-y-4 border border-white/[0.04] bg-white/[0.01] p-4 rounded-xl">
                  {MODULOS_SISTEMA.map((secao) => (
                    <div key={secao.secao} className="space-y-2.5">
                      <h4 className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{secao.secao}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3 border-b border-white/[0.03] last:border-b-0">
                        {secao.itens.map((item) => {
                          const isAllowed = selectedModulos.includes(item.id);
                          const subPermList = SUB_PERMS[item.id] || [];
                          return (
                            <div key={item.id} className="p-3 bg-[#131622]/40 border border-white/[0.04] rounded-xl space-y-2">
                              <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isAllowed}
                                  onChange={() => toggleModulo(item.id)}
                                  className="mt-0.5 rounded text-indigo-500 bg-[#161a26] border-white/[0.06] focus:ring-indigo-500 focus:ring-offset-[#0f111a]"
                                />
                                <div>
                                  <span className="font-bold text-slate-200 block">{item.label}</span>
                                  <span className="text-[9px] text-slate-500">{item.desc}</span>
                                </div>
                              </label>

                              {isAllowed && subPermList.length > 0 && (
                                <div className="mt-2.5 pl-6 border-l border-white/[0.06] space-y-1.5">
                                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Ações específicas:</span>
                                  {subPermList.map((sp) => {
                                    const hasSp = (selectedSubPerms[item.id] || []).includes(sp.id);
                                    return (
                                      <label key={sp.id} className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-400 hover:text-slate-200">
                                        <input
                                          type="checkbox"
                                          checked={hasSp}
                                          onChange={() => toggleSubPerm(item.id, sp.id)}
                                          className="rounded text-indigo-500 bg-[#161a26] border-white/[0.06] focus:ring-indigo-500 size-3"
                                        />
                                        <span>{sp.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-2 flex-shrink-0">
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
