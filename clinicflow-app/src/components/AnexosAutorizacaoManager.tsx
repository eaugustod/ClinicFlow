import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Eye,
  Trash2,
  Download,
  X,
  FileCheck,
  Clock,
  ShieldCheck,
  AlertCircle,
  Plus,
  Loader2,
  Stethoscope,
  UserCheck,
  Pencil,
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { anexosAutorizacaoService } from '../services/anexosAutorizacaoService';
import type { AnexoAutorizacao, TipoDocumentoAutorizacao, StatusEnvioDocumento } from '../types';

interface AnexosAutorizacaoManagerProps {
  pacId: number;
  pacienteNome?: string;
  planoNome?: string;
  planoId?: number;
  agendamentoId?: number;
  onDocumentoAdicionado?: (doc: AnexoAutorizacao) => void;
}

export const AnexosAutorizacaoManager: React.FC<AnexosAutorizacaoManagerProps> = ({
  pacId,
  pacienteNome,
  planoNome,
  planoId,
  agendamentoId,
  onDocumentoAdicionado,
}) => {
  const [documentos, setDocumentos] = useState<AnexoAutorizacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State (Novo Upload)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [tipo, setTipo] = useState<TipoDocumentoAutorizacao>('pedido_medico');
  const [file, setFile] = useState<File | null>(null);
  const [medicoSolicitanteNome, setMedicoSolicitanteNome] = useState('');
  const [medicoSolicitanteCrm, setMedicoSolicitanteCrm] = useState('');
  const [medicoSolicitanteUf, setMedicoSolicitanteUf] = useState('SP');
  const [medicoSolicitanteCbo, setMedicoSolicitanteCbo] = useState('');
  const [dataEmissao, setDataEmissao] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dataValidade, setDataValidade] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Form State (Edição de Registro Existente)
  const [editingDoc, setEditingDoc] = useState<AnexoAutorizacao | null>(null);
  const [editTipo, setEditTipo] = useState<TipoDocumentoAutorizacao>('pedido_medico');
  const [editMedicoNome, setEditMedicoNome] = useState('');
  const [editMedicoCrm, setEditMedicoCrm] = useState('');
  const [editMedicoUf, setEditMedicoUf] = useState('SP');
  const [editMedicoCbo, setEditMedicoCbo] = useState('');
  const [editDataEmissao, setEditDataEmissao] = useState('');
  const [editDataValidade, setEditDataValidade] = useState('');
  const [editObservacoes, setEditObservacoes] = useState('');
  const [editStatusEnvio, setEditStatusEnvio] = useState<StatusEnvioDocumento>('PENDENTE_ENVIO');
  const [editProtocoloEnvio, setEditProtocoloEnvio] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Profissionais da clínica para seleção rápida opcional
  const [profissionaisSugeridos, setProfissionaisSugeridos] = useState<
    Array<{ id: number; nome: string; num?: string; cbo?: string; conselho?: string; uf?: string }>
  >([]);

  // Preview State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<AnexoAutorizacao | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Buscar profissionais cadastrados para preenchimento assistido
  useEffect(() => {
    const buscarProfissionais = async () => {
      try {
        const { data, error } = await supabase
          .from('profissionais')
          .select('id, nome, conselho, num, cbo, uf')
          .eq('status', 'Ativo')
          .order('nome');
        if (!error && data) {
          setProfissionaisSugeridos(data);
        }
      } catch (err) {
        console.warn('Erro ao carregar profissionais sugeridos:', err);
      }
    };
    buscarProfissionais();
  }, []);

  // Recalcular validade sugerida ao trocar tipo ou emissão
  useEffect(() => {
    const sugerida = anexosAutorizacaoService.calcularValidadeSugerida(tipo, dataEmissao);
    setDataValidade(sugerida);
  }, [tipo, dataEmissao]);

  const carregarDocumentos = async () => {
    if (!pacId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const docs = await anexosAutorizacaoService.listarPorPaciente(pacId);
      setDocumentos(docs);
    } catch (err: any) {
      console.error('Erro ao carregar anexos:', err);
      setErrorMsg('Não foi possível carregar os anexos (verifique se a tabela de documentos já foi criada).');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDocumentos();
  }, [pacId]);

  const handleFileSelect = (selectedFile: File) => {
    setErrorMsg(null);
    const validExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    const ext = selectedFile.name.split('.').pop()?.toLowerCase() || '';

    if (!validExtensions.includes(ext)) {
      setErrorMsg('Formato inválido. Apenas arquivos PDF, JPG e PNG são permitidos.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMsg('Tamanho máximo permitido é 5 MB.');
      return;
    }

    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const abrirModalUpload = () => {
    setShowUploadModal(true);
    setFile(null);
    setMedicoSolicitanteNome('');
    setMedicoSolicitanteCrm('');
    setMedicoSolicitanteUf('SP');
    setMedicoSolicitanteCbo('');
    setObservacoes('');
    setErrorMsg(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!file) {
      setErrorMsg('Selecione um arquivo para upload.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const novoDoc = await anexosAutorizacaoService.uploadAnexo(pacId, tipo, file, {
        dataEmissao,
        dataValidade: dataValidade || null,
        observacoes: observacoes.trim() || null,
        planoId: planoId || null,
        agendamentoId: agendamentoId || null,
        medicoSolicitanteNome: medicoSolicitanteNome.trim() || null,
        medicoSolicitanteCrm: medicoSolicitanteCrm.trim() || null,
        medicoSolicitanteUf: medicoSolicitanteUf.trim().toUpperCase() || null,
        medicoSolicitanteCbo: medicoSolicitanteCbo.trim() || null,
      });

      setSuccessMsg('Documento anexado com sucesso!');
      setFile(null);
      setMedicoSolicitanteNome('');
      setMedicoSolicitanteCrm('');
      setMedicoSolicitanteUf('SP');
      setMedicoSolicitanteCbo('');
      setObservacoes('');
      setShowUploadModal(false);
      await carregarDocumentos();

      if (onDocumentoAdicionado) {
        onDocumentoAdicionado(novoDoc);
      }
    } catch (err: any) {
      console.error('Erro ao enviar documento:', err);
      setErrorMsg(err.message || 'Erro ao realizar upload do documento.');
    } finally {
      setUploading(false);
    }
  };

  const handleAbrirEdicao = (doc: AnexoAutorizacao) => {
    setEditingDoc(doc);
    setEditTipo(doc.tipoDocumento);
    setEditMedicoNome(doc.medicoSolicitanteNome || '');
    setEditMedicoCrm(doc.medicoSolicitanteCrm || '');
    setEditMedicoUf(doc.medicoSolicitanteUf || doc.uf || 'SP');
    setEditMedicoCbo(doc.medicoSolicitanteCbo || '');
    setEditDataEmissao(doc.dataEmissao);
    setEditDataValidade(doc.dataValidade || '');
    setEditObservacoes(doc.observacoes || '');
    setEditStatusEnvio(doc.statusEnvio);
    setEditProtocoloEnvio(doc.protocoloEnvio || '');
    setErrorMsg(null);
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingDoc) return;

    setSavingEdit(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await anexosAutorizacaoService.atualizarAnexo(editingDoc.id, {
        tipoDocumento: editTipo,
        medicoSolicitanteNome: editMedicoNome,
        medicoSolicitanteCrm: editMedicoCrm,
        medicoSolicitanteUf: editMedicoUf,
        medicoSolicitanteCbo: editMedicoCbo,
        dataEmissao: editDataEmissao,
        dataValidade: editDataValidade || null,
        observacoes: editObservacoes,
        statusEnvio: editStatusEnvio,
        protocoloEnvio: editProtocoloEnvio,
      });

      setSuccessMsg('Registro de autorização atualizado com sucesso!');
      setEditingDoc(null);
      await carregarDocumentos();
    } catch (err: any) {
      console.error('Erro ao atualizar documento:', err);
      setErrorMsg(err.message || 'Erro ao atualizar documento.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleVisualizar = async (doc: AnexoAutorizacao) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const url = await anexosAutorizacaoService.obterUrlVisualizacao(doc.storagePath);
      setPreviewUrl(url);
    } catch (err: any) {
      alert(`Falha ao carregar visualização: ${err.message}`);
      setPreviewDoc(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExcluir = async (doc: AnexoAutorizacao) => {
    if (!window.confirm(`Tem certeza que deseja excluir o documento "${doc.nomeOriginal}"?`)) {
      return;
    }

    try {
      await anexosAutorizacaoService.excluirAnexo(doc.id, doc.storagePath);
      setDocumentos(prev => prev.filter(d => d.id !== doc.id));
      if (previewDoc?.id === doc.id) {
        setPreviewDoc(null);
        setPreviewUrl(null);
      }
    } catch (err: any) {
      alert(`Erro ao excluir documento: ${err.message}`);
    }
  };

  const hoje = new Date().toISOString().split('T')[0];
  const daqui15Dias = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

  return (
    <div className="space-y-4 text-xs">
      {/* Header com Ações e Diagnóstico */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#131622]/60 p-3.5 rounded-xl border border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck size={16} className="text-indigo-400" />
              Documentos de Autorização & Guias
            </h4>
            {planoNome && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {planoNome}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Pedidos médicos, laudos e relatórios clínicos necessários para emissão autônoma de senhas pelo robô.
          </p>
        </div>

        <button
          type="button"
          onClick={abrirModalUpload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
        >
          <Plus size={14} />
          <span>Anexar Novo Documento</span>
        </button>
      </div>

      {/* Alertas contextuais */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs">
          <CheckCircle size={15} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Lista de Documentos */}
      {loading ? (
        <div className="flex items-center justify-center p-8 bg-[#161a26]/40 rounded-xl border border-white/[0.04]">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
          <span className="ml-2 text-slate-400">Carregando anexos...</span>
        </div>
      ) : documentos.length === 0 ? (
        <div className="p-8 text-center bg-[#161a26]/30 rounded-xl border border-dashed border-white/10 space-y-2">
          <FileText size={32} className="mx-auto text-slate-600" />
          <p className="text-slate-300 font-semibold text-xs">Nenhum documento anexado ainda</p>
          <p className="text-slate-500 text-[11px] max-w-sm mx-auto">
            Anexe o pedido médico ou laudo deste paciente para garantir a emissão automática de autorizações junto aos convênios.
          </p>
          <button
            type="button"
            onClick={abrirModalUpload}
            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-medium transition-all"
          >
            <Upload size={13} />
            <span>Fazer upload agora</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documentos.map((doc) => {
            const isVencido = doc.dataValidade && doc.dataValidade < hoje;
            const isVencendo = doc.dataValidade && !isVencido && doc.dataValidade <= daqui15Dias;

            return (
              <div
                key={doc.id}
                className="bg-[#161a26]/70 border border-white/[0.06] hover:border-white/[0.12] rounded-xl p-3.5 space-y-3 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <FileText size={16} />
                      </div>
                      <div>
                        <span className="font-semibold text-white block truncate max-w-[200px]" title={doc.nomeOriginal}>
                          {doc.nomeOriginal}
                        </span>
                        <span className="text-[10px] text-indigo-300 block">
                          {anexosAutorizacaoService.obterRotuloTipo(doc.tipoDocumento)}
                        </span>
                      </div>
                    </div>

                    {/* Status de Envio RPA */}
                    {doc.statusEnvio === 'ENVIADO_PLANO' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle size={10} />
                        <span>Enviado</span>
                      </span>
                    )}
                    {doc.statusEnvio === 'PENDENTE_ENVIO' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock size={10} />
                        <span>Pendente RPA</span>
                      </span>
                    )}
                    {doc.statusEnvio === 'REJEITADO_PLANO' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertTriangle size={10} />
                        <span>Rejeitado</span>
                      </span>
                    )}
                  </div>

                  {/* Informações de Vigência e Datas */}
                  <div className="mt-3 pt-2 border-t border-white/[0.04] grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Emissão:</span>
                      <span className="text-slate-300 font-medium">
                        {new Date(doc.dataEmissao + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">Validade:</span>
                      {doc.dataValidade ? (
                        <span
                          className={`font-semibold ${
                            isVencido
                              ? 'text-rose-400'
                              : isVencendo
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {new Date(doc.dataValidade + 'T12:00:00').toLocaleDateString('pt-BR')}
                          {isVencido ? ' (Vencido)' : isVencendo ? ' (Vencendo)' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">Indeterminada</span>
                      )}
                    </div>
                  </div>

                  {/* Dados do Médico Solicitante */}
                  {(doc.medicoSolicitanteNome || doc.medicoSolicitanteCrm || doc.medicoSolicitanteUf || doc.uf || doc.medicoSolicitanteCbo) && (
                    <div className="mt-2.5 p-2 rounded-lg bg-indigo-500/[0.07] border border-indigo-500/15 text-[11px] text-slate-300">
                      <div className="flex items-center gap-1.5 font-semibold text-indigo-300 mb-0.5">
                        <Stethoscope size={13} className="text-indigo-400 shrink-0" />
                        <span className="truncate">{doc.medicoSolicitanteNome || 'Médico Solicitante'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400 pl-4 font-mono">
                        {doc.medicoSolicitanteCrm && (
                          <span>
                            CRM: <strong className="text-slate-200">
                              {doc.medicoSolicitanteCrm}
                              {doc.medicoSolicitanteUf || doc.uf ? `/${doc.medicoSolicitanteUf || doc.uf}` : ''}
                            </strong>
                          </span>
                        )}
                        {(doc.medicoSolicitanteUf || doc.uf) && !doc.medicoSolicitanteCrm && (
                          <span>
                            UF: <strong className="text-slate-200">{doc.medicoSolicitanteUf || doc.uf}</strong>
                          </span>
                        )}
                        {doc.medicoSolicitanteCbo && (
                          <span>
                            CBO: <strong className="text-slate-200">{doc.medicoSolicitanteCbo}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {doc.observacoes && (
                    <p className="mt-2 text-[10px] text-slate-400 bg-black/20 p-1.5 rounded border border-white/[0.02]">
                      {doc.observacoes}
                    </p>
                  )}

                  {doc.protocoloEnvio && (
                    <div className="mt-2 text-[10px] text-cyan-400">
                      Protocolo: <span className="font-mono">{doc.protocoloEnvio}</span>
                    </div>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                  <span className="text-[10px] text-slate-500">
                    {(doc.tamanhoBytes / 1024).toFixed(0)} KB • {doc.mimeType.split('/').pop()?.toUpperCase()}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleVisualizar(doc)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-[11px]"
                      title="Visualizar documento"
                    >
                      <Eye size={13} />
                      <span>Ver</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAbrirEdicao(doc)}
                      className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white transition-all flex items-center gap-1 text-[11px]"
                      title="Editar registro do documento"
                    >
                      <Pencil size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluir(doc)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                      title="Excluir documento"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Upload */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/60">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload size={16} className="text-indigo-400" />
                Anexar Documento de Autorização
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleUploadSubmit(e);
              }}
              className="p-5 space-y-4 overflow-y-auto flex-1"
            >
              {/* Seletor do Tipo de Documento */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold text-xs">
                  Tipo de Documento <span className="text-rose-400">*</span>
                </label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoDocumentoAutorizacao)}
                  className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="pedido_medico">Pedido Médico / Encaminhamento (Guia de Solicitação)</option>
                  <option value="relatorio_medico">Relatório Médico Assistente (com Diagnóstico / CID)</option>
                  <option value="laudo_patologia">Laudo / Avaliação de Patologia (Neuropsicologia / TEA / etc)</option>
                  <option value="exame_complementar">Exame Complementar (Audiometria, Laboratorial, etc)</option>
                  <option value="justificativa_clinica">Justificativa Clínica para Extensão de Sessões</option>
                </select>
              </div>

              {/* Área Drag & Drop */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold text-xs">
                  Arquivo do Documento (PDF, JPG, PNG até 5 MB) <span className="text-rose-400">*</span>
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-5 rounded-xl border-2 border-dashed cursor-pointer text-center transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : file
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-white/10 bg-[#161a26]/40 hover:bg-[#161a26]/70'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  {file ? (
                    <div className="space-y-1">
                      <FileCheck size={28} className="mx-auto text-emerald-400" />
                      <p className="text-emerald-300 font-semibold text-xs truncate max-w-xs mx-auto">
                        {file.name}
                      </p>
                      <p className="text-slate-400 text-[10px]">
                        {(file.size / 1024).toFixed(0)} KB • Clique para trocar de arquivo
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload size={26} className="mx-auto text-slate-500" />
                      <p className="text-slate-300 font-medium text-xs">
                        Arraste o arquivo ou <span className="text-indigo-400 font-semibold">clique aqui</span>
                      </p>
                      <p className="text-slate-500 text-[10px]">
                        Suporta PDF legível ou fotos digitalizadas
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Dados do Médico Solicitante */}
              <div className="p-3.5 bg-[#131622] border border-white/[0.06] rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="text-[11px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Stethoscope size={13} />
                    Médico Solicitante
                  </label>
                  {profissionaisSugeridos.length > 0 && (
                    <select
                      onChange={(e) => {
                        const pId = Number(e.target.value);
                        if (!pId) return;
                        const pr = profissionaisSugeridos.find((x) => x.id === pId);
                        if (pr) {
                          setMedicoSolicitanteNome(pr.nome);
                          setMedicoSolicitanteCrm(pr.num || '');
                          setMedicoSolicitanteUf(pr.uf || 'SP');
                          setMedicoSolicitanteCbo(pr.cbo || '225125');
                        }
                      }}
                      className="bg-[#161a26] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[210px] truncate"
                    >
                      <option value="">Preencher de médico da clínica...</option>
                      {profissionaisSugeridos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} {p.num ? `(${p.conselho || 'CRM'} ${p.num})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1">
                    Nome Completo do Médico
                  </label>
                  <input
                    type="text"
                    value={medicoSolicitanteNome}
                    onChange={(e) => setMedicoSolicitanteNome(e.target.value)}
                    placeholder="Ex: Dr. Roberto Alencar Silva"
                    className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold text-xs mb-1">
                      CRM
                    </label>
                    <input
                      type="text"
                      value={medicoSolicitanteCrm}
                      onChange={(e) => setMedicoSolicitanteCrm(e.target.value)}
                      placeholder="Ex: 123456"
                      className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold text-xs mb-1">
                      UF
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={medicoSolicitanteUf}
                      onChange={(e) => setMedicoSolicitanteUf(e.target.value.toUpperCase())}
                      placeholder="SP"
                      className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 uppercase text-center font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold text-xs mb-1">
                      Código CBO
                    </label>
                    <input
                      type="text"
                      value={medicoSolicitanteCbo}
                      onChange={(e) => setMedicoSolicitanteCbo(e.target.value)}
                      placeholder="Ex: 225125"
                      className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Datas de Emissão e Validade */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold text-xs">
                    Data de Emissão <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={dataEmissao}
                    onChange={(e) => setDataEmissao(e.target.value)}
                    required
                    className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-300 font-semibold text-xs">
                      Validade Estimada
                    </label>
                    <span className="text-[10px] text-indigo-400 font-medium">Sugerida</span>
                  </div>
                  <input
                    type="date"
                    value={dataValidade}
                    onChange={(e) => setDataValidade(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold text-xs">
                  Observações (Opcional)
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Assinado pelo Dr. Marcelo, CRM 12345. Indicação de 20 sessões."
                  rows={2}
                  className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="px-3 py-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Enviando arquivo...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={13} />
                      <span>Salvar Anexo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Registro de Autorização */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Pencil size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Editar Documento de Autorização</h3>
                  <span className="text-[10px] text-slate-400 block truncate max-w-xs" title={editingDoc.nomeOriginal}>
                    {editingDoc.nomeOriginal}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicao} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Seletor do Tipo de Documento */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold text-xs">
                  Tipo de Documento <span className="text-rose-400">*</span>
                </label>
                <select
                  value={editTipo}
                  onChange={(e) => setEditTipo(e.target.value as TipoDocumentoAutorizacao)}
                  className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="pedido_medico">Pedido Médico / Encaminhamento (Guia de Solicitação)</option>
                  <option value="relatorio_medico">Relatório Médico Assistente (com Diagnóstico / CID)</option>
                  <option value="laudo_patologia">Laudo / Avaliação de Patologia (Neuropsicologia / TEA / etc)</option>
                  <option value="exame_complementar">Exame Complementar (Audiometria, Laboratorial, etc)</option>
                  <option value="justificativa_clinica">Justificativa Clínica para Extensão de Sessões</option>
                </select>
              </div>

              {/* Dados do Médico Solicitante */}
              <div className="p-3.5 bg-[#131622] border border-white/[0.06] rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="text-[11px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Stethoscope size={13} />
                    Médico Solicitante
                  </label>
                  {profissionaisSugeridos.length > 0 && (
                    <select
                      onChange={(e) => {
                        const pId = Number(e.target.value);
                        if (!pId) return;
                        const pr = profissionaisSugeridos.find((x) => x.id === pId);
                        if (pr) {
                          setEditMedicoNome(pr.nome);
                          setEditMedicoCrm(pr.num || '');
                          setEditMedicoUf(pr.uf || 'SP');
                          setEditMedicoCbo(pr.cbo || '225125');
                        }
                      }}
                      className="bg-[#161a26] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[210px] truncate"
                    >
                      <option value="">Preencher de médico da clínica...</option>
                      {profissionaisSugeridos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} {p.num ? `(${p.conselho || 'CRM'} ${p.num})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold text-xs mb-1">
                    Nome Completo do Médico
                  </label>
                  <input
                    type="text"
                    value={editMedicoNome}
                    onChange={(e) => setEditMedicoNome(e.target.value)}
                    placeholder="Ex: Dr. Roberto Alencar Silva"
                    className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold text-xs mb-1">
                      CRM
                    </label>
                    <input
                      type="text"
                      value={editMedicoCrm}
                      onChange={(e) => setEditMedicoCrm(e.target.value)}
                      placeholder="Ex: 123456"
                      className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold text-xs mb-1">
                      UF
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={editMedicoUf}
                      onChange={(e) => setEditMedicoUf(e.target.value.toUpperCase())}
                      placeholder="SP"
                      className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 uppercase text-center font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold text-xs mb-1">
                      Código CBO
                    </label>
                    <input
                      type="text"
                      value={editMedicoCbo}
                      onChange={(e) => setEditMedicoCbo(e.target.value)}
                      placeholder="Ex: 225125"
                      className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Datas de Emissão e Validade */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold text-xs">
                    Data de Emissão <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={editDataEmissao}
                    onChange={(e) => setEditDataEmissao(e.target.value)}
                    required
                    className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-300 font-semibold text-xs">
                      Validade Estimada
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditDataValidade(anexosAutorizacaoService.calcularValidadeSugerida(editTipo, editDataEmissao))}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Recalcular
                    </button>
                  </div>
                  <input
                    type="date"
                    value={editDataValidade}
                    onChange={(e) => setEditDataValidade(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Status de Envio e Protocolo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold text-xs">
                    Status de Envio (Robô)
                  </label>
                  <select
                    value={editStatusEnvio}
                    onChange={(e) => setEditStatusEnvio(e.target.value as StatusEnvioDocumento)}
                    className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PENDENTE_ENVIO">PENDENTE_ENVIO (Aguardando robô)</option>
                    <option value="ENVIADO_PLANO">ENVIADO_PLANO (Enviado com sucesso)</option>
                    <option value="REJEITADO_PLANO">REJEITADO_PLANO (Recusado pelo convênio)</option>
                    <option value="DISPENSADO">DISPENSADO (Não exigido)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold text-xs">
                    Protocolo de Envio
                  </label>
                  <input
                    type="text"
                    value={editProtocoloEnvio}
                    onChange={(e) => setEditProtocoloEnvio(e.target.value)}
                    placeholder="Ex: AMIL-20261013-001"
                    className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold text-xs">
                  Observações (Opcional)
                </label>
                <textarea
                  value={editObservacoes}
                  onChange={(e) => setEditObservacoes(e.target.value)}
                  placeholder="Ex: Correção de CRM e CBO do médico assistente."
                  rows={2}
                  className="w-full bg-[#161a26] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  disabled={savingEdit}
                  className="px-3 py-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={13} />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Preview Seguro */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText size={16} className="text-indigo-400" />
                  {previewDoc.nomeOriginal}
                </h3>
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400 mt-0.5">
                  <span>
                    {anexosAutorizacaoService.obterRotuloTipo(previewDoc.tipoDocumento)} • Emitido em{' '}
                    {new Date(previewDoc.dataEmissao + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                  {previewDoc.medicoSolicitanteNome && (
                    <span className="text-indigo-300 font-medium">
                      • Médico: {previewDoc.medicoSolicitanteNome}
                      {previewDoc.medicoSolicitanteCrm ? ` (CRM: ${previewDoc.medicoSolicitanteCrm}${previewDoc.medicoSolicitanteUf || previewDoc.uf ? `/${previewDoc.medicoSolicitanteUf || previewDoc.uf}` : ''})` : ''}
                      {previewDoc.medicoSolicitanteCbo ? ` (CBO: ${previewDoc.medicoSolicitanteCbo})` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={previewDoc.nomeOriginal}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white flex items-center gap-1 text-xs"
                    title="Baixar em nova aba"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPreviewDoc(null);
                    setPreviewUrl(null);
                  }}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#090b10] flex items-center justify-center p-2 overflow-hidden relative">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Loader2 size={30} className="animate-spin text-indigo-400" />
                  <span>Gerando link seguro de visualização...</span>
                </div>
              ) : previewUrl ? (
                previewDoc.mimeType.includes('pdf') ? (
                  <iframe
                    src={previewUrl}
                    title={previewDoc.nomeOriginal}
                    className="w-full h-full border-0 rounded-lg"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={previewDoc.nomeOriginal}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                )
              ) : (
                <div className="text-slate-500 text-xs">Visualização indisponível.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
