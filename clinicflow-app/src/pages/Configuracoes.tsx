import React, { useState, useEffect } from 'react';
import { Database, Building2, Save, CheckCircle, AlertTriangle, MessageSquare, Bell, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';

export const Configuracoes: React.FC = () => {
  const { clinicaConfig, refreshAll } = useApp();
  
  // DB Config
  const [supaUrl, setSupaUrl] = useState('');
  const [supaKey, setSupaKey] = useState('');
  const [dbStatus, setDbStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');

  // Clinic metadata Form
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [codPrestador, setCodPrestador] = useState('');
  const [cnes, setCnes] = useState('');
  const [logo, setLogo] = useState('');

  // Notifications Form
  const [canalNotif, setCanalNotif] = useState<'whatsapp' | 'chat'>('whatsapp');
  const [waMethod, setWaMethod] = useState<'link' | 'api'>('link');

  // Evolution API
  const [evoUrl, setEvoUrl] = useState('');
  const [evoKey, setEvoKey] = useState('');
  const [evoInstance, setEvoInstance] = useState('clinica');
  const [evoPhone, setEvoPhone] = useState('');

  // Templates
  const [templates, setTemplates] = useState<{ id: string; name: string; body: string }[]>([]);

  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setSupaUrl(localStorage.getItem('cf_supa_url') || '');
    setSupaKey(localStorage.getItem('cf_supa_key') || '');

    setNome(clinicaConfig.nome || '');
    setCnpj(clinicaConfig.cnpj || '');
    setEndereco(clinicaConfig.endereco || '');
    setTelefone(clinicaConfig.telefone || '');
    setEmail(clinicaConfig.email || '');
    setCodPrestador(clinicaConfig.codPrestador || '');
    setCnes(clinicaConfig.cnes || '');
    setLogo(clinicaConfig.logo || '');
    
    setCanalNotif(clinicaConfig.canalNotif || 'whatsapp');
    setWaMethod(clinicaConfig.waMethod || 'link');

    setEvoUrl(clinicaConfig.evoUrl || '');
    setEvoKey(clinicaConfig.evoKey || '');
    setEvoInstance(clinicaConfig.evoInstance || 'clinica');
    setEvoPhone(clinicaConfig.evoPhone || '');

    setTemplates(clinicaConfig.templates || [
      { id: '1', name: 'Confirmação de Agendamento', body: 'Olá {nome}, seu agendamento com {terapeuta} está marcado para {data} às {hora} na {clinica}.' }
    ]);
  }, [clinicaConfig]);

  const testConnection = async () => {
    setDbStatus('testing');
    try {
      const testClient = (await import('@supabase/supabase-js')).createClient(supaUrl, supaKey);
      const { error } = await testClient.from('config_clinica').select('id').limit(1);
      if (error) throw error;
      
      localStorage.setItem('cf_supa_url', supaUrl);
      localStorage.setItem('cf_supa_key', supaKey);
      setDbStatus('connected');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      console.error(e);
      setDbStatus('error');
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('O logotipo deve ter menos de 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setSaveSuccess(false);

    const payload = {
      nome,
      cnpj,
      endereco,
      telefone,
      email,
      codPrestador,
      cnes,
      logo,
      canalNotif,
      waMethod,
      evoUrl,
      evoKey,
      evoInstance,
      evoPhone,
      templates
    };

    try {
      const { data, error: selectError } = await supabase.from('config_clinica').select('*');
      if (selectError) throw selectError;

      if (data && data.length > 0) {
        const { error } = await supabase
          .from('config_clinica')
          .update({ dados: payload })
          .eq('id', data[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('config_clinica')
          .insert([{ dados: payload }]);
        if (error) throw error;
      }
      
      setSaveSuccess(true);
      await refreshAll();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações');
    } finally {
      setSavingConfig(false);
    }
  };

  const addTemplate = () => {
    setTemplates([
      ...templates,
      { id: Date.now().toString(), name: 'Novo Template', body: 'Olá {nome}, ...' }
    ]);
  };

  const updateTemplate = (id: string, field: 'name' | 'body', value: string) => {
    setTemplates(templates.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-8 animate-fade-in text-xs w-full max-w-full">
      {/* Title */}
      <div>
        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-sans">Ajustes Globais</span>
        <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Configurações</h2>
        <p className="text-xs text-slate-400 mt-1">Gerencie dados cadastrais, conexões e automações de notificações</p>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-8">
        
        {/* Row 1: Clinic details */}
        <div className="grid grid-cols-1 gap-8">
          
          {/* DADOS DA CLÍNICA */}
          <div className="p-6 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-xl">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="font-bold text-white uppercase tracking-wider text-xs">Identificação da Clínica</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Informações cadastrais e logotipo</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Logo Column */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-white/[0.08] bg-[#161a26] flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer">
                  {logo ? (
                    <img src={logo} alt="Logo Clinica" className="w-full h-full object-contain p-2" />
                  ) : (
                    <>
                      <ImageIcon size={24} className="text-slate-500" />
                      <span className="text-[9px] text-slate-500 mt-1">Carregar Logo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                {logo && (
                  <button
                    type="button"
                    onClick={() => setLogo('')}
                    className="text-[10px] text-rose-400 hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>

              {/* Form Column */}
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nome da Clínica</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">CNPJ</label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">CNES</label>
                    <input
                      type="text"
                      value={cnes}
                      onChange={(e) => setCnes(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Telefone</label>
                    <input
                      type="text"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">E-mail</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Código do Prestador (Padrão)</label>
                  <input
                    type="text"
                    value={codPrestador}
                    onChange={(e) => setCodPrestador(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Notifications channel & WhatsApp details */}
        <div className="p-6 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-xl">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white uppercase tracking-wider text-xs">Canal de Notificações ao Paciente</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Defina como enviar alertas e confirmações de consultas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => setCanalNotif('whatsapp')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01] ${
                canalNotif === 'whatsapp' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/[0.04] bg-[#161a26]/40'
              }`}
            >
              <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Notificar via WhatsApp
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Envia mensagens automáticas ou templates pré-formatados diretamente no contato do paciente.</p>
            </div>

            <div
              onClick={() => setCanalNotif('chat')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01] ${
                canalNotif === 'chat' ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/[0.04] bg-[#161a26]/40'
              }`}
            >
              <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                Chat Interno com Paciente
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Usa o painel de chat do portal interno para manter o histórico de mensagens e notificações.</p>
            </div>
          </div>

          {canalNotif === 'whatsapp' && (
            <div className="pt-6 border-t border-white/[0.04] space-y-6">
              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block">Método de Envio do WhatsApp</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setWaMethod('link')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01] ${
                    waMethod === 'link' ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/[0.04] bg-[#161a26]/40'
                  }`}
                >
                  <div className="font-bold text-slate-200 text-xs">📱 Link de redirecionamento wa.me</div>
                  <p className="text-[10px] text-slate-400 mt-2">Abre o WhatsApp com a mensagem pronta. Sem configurações adicionais e sem custos.</p>
                </div>

                <div
                  onClick={() => setWaMethod('api')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01] ${
                    waMethod === 'api' ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/[0.04] bg-[#161a26]/40'
                  }`}
                >
                  <div className="font-bold text-slate-200 text-xs">🤖 Disparo automático Evolution API</div>
                  <p className="text-[10px] text-slate-400 mt-2">Envia mensagens em segundo plano. Requer servidor ou VPS ativo com a Evolution API instalada.</p>
                </div>
              </div>

              {waMethod === 'api' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/[0.02]">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">URL da Evolution API</label>
                    <input
                      type="text"
                      value={evoUrl}
                      onChange={(e) => setEvoUrl(e.target.value)}
                      placeholder="http://localhost:8080 ou https://sua-api.com"
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">API Key</label>
                    <input
                      type="password"
                      value={evoKey}
                      onChange={(e) => setEvoKey(e.target.value)}
                      placeholder="sua-api-key"
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Nome da Instância</label>
                    <input
                      type="text"
                      value={evoInstance}
                      onChange={(e) => setEvoInstance(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Telefone WhatsApp Clínica</label>
                    <input
                      type="text"
                      value={evoPhone}
                      onChange={(e) => setEvoPhone(e.target.value)}
                      placeholder="5511999999999"
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Templates */}
        {canalNotif === 'whatsapp' && (
          <div className="p-6 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-xl">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white uppercase tracking-wider text-xs">Templates de Mensagens</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Modelos de textos para disparar lembretes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={addTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-xl font-bold text-indigo-400"
              >
                <Plus size={12} />
                Adicionar Template
              </button>
            </div>

            <div className="space-y-4">
              {templates.map(t => (
                <div key={t.id} className="p-4 bg-[#161a26]/40 rounded-xl border border-white/[0.04] space-y-3 relative group">
                  <button
                    type="button"
                    onClick={() => deleteTemplate(t.id)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="w-[80%]">
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">Nome do Template</label>
                    <input
                      type="text"
                      value={t.name}
                      onChange={(e) => updateTemplate(t.id, 'name', e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">Conteúdo da Mensagem</label>
                    <textarea
                      value={t.body}
                      onChange={(e) => updateTemplate(t.id, 'body', e.target.value)}
                      rows={3}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white resize-none"
                    />
                    <div className="text-[9px] text-slate-500 mt-1">
                      Variáveis aceitas: <code className="bg-white/5 px-1 py-0.5 rounded text-slate-400">{`{nome}`}</code>, <code className="bg-white/5 px-1 py-0.5 rounded text-slate-400">{`{data}`}</code>, <code className="bg-white/5 px-1 py-0.5 rounded text-slate-400">{`{hora}`}</code>, <code className="bg-white/5 px-1 py-0.5 rounded text-slate-400">{`{terapeuta}`}</code>, <code className="bg-white/5 px-1 py-0.5 rounded text-slate-400">{`{clinica}`}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Database Config */}
        <div className="p-6 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-xl">
                <Database size={18} />
              </div>
              <div>
                <h3 className="font-bold text-white uppercase tracking-wider text-xs">Conexão do Banco de Dados</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Credenciais locais do Supabase para acesso ao banco</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Supabase URL</label>
                <input
                  type="text"
                  value={supaUrl}
                  onChange={(e) => setSupaUrl(e.target.value)}
                  placeholder="https://xyz.supabase.co"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Anon Public Key</label>
                <input
                  type="password"
                  value={supaKey}
                  onChange={(e) => setSupaKey(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            {dbStatus === 'testing' && (
              <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-center gap-2 text-slate-400 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span>Testando conexão com o banco de dados...</span>
              </div>
            )}
            {dbStatus === 'connected' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 rounded-xl flex items-center gap-2 text-emerald-400">
                <CheckCircle size={14} />
                <span>Conectado com sucesso! Atualizando aplicação...</span>
              </div>
            )}
            {dbStatus === 'error' && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/15 rounded-xl flex items-center gap-2 text-rose-400 animate-shake">
                <AlertTriangle size={14} />
                <span>Falha na conexão. Verifique a URL e a Chave.</span>
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-white/[0.04] flex gap-4">
            <button
              type="button"
              onClick={testConnection}
              disabled={dbStatus === 'testing'}
              className="flex-1 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl font-bold transition-all disabled:opacity-50"
            >
              Testar Conexão
            </button>
          </div>
        </div>

        {/* Global Save Actions */}
        {saveSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/15 rounded-2xl flex items-center gap-2.5 text-emerald-400">
            <CheckCircle size={18} />
            <span className="font-semibold text-xs">Configurações salvas e persistidas no banco de dados com sucesso!</span>
          </div>
        )}

        <div className="pt-4 border-t border-white/[0.04] flex justify-end">
          <button
            type="submit"
            disabled={savingConfig}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>

      </form>
    </div>
  );
};
