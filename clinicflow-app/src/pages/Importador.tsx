import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { Upload, ChevronRight, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, ClipboardList } from 'lucide-react';

interface ImportadorProps {
  tipo: 'agenda' | 'pacientes' | 'profissionais' | 'planos' | 'procedimentos' | 'guias_sadt' | 'senhas' | 'anamnese' | 'evolucoes' | 'espera';
}

interface FieldDefinition {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
}

interface ImportSchema {
  label: string;
  table: string;
  conflito?: string;
  mapper: (row: any) => any;
  toDbMapper: (item: any) => any;
  fields: FieldDefinition[];
  demo: string;
}

export const Importador: React.FC<ImportadorProps> = ({ tipo }) => {
  const [step, setStep] = useState(1);
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<{ [key: string]: number }>({});
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [result, setResult] = useState<{ sucesso: number; erros: number; avisos: number } | null>(null);
  const [pacientesList, setPacientesList] = useState<{ id: number; nome: string }[]>([]);
  const [profissionaisList, setProfissionaisList] = useState<{ id: number; nome: string; nome_agenda?: string }[]>([]);

  // Normalizes strings for matching
  const norm = (s: any) => (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const parseDate = (val: any) => {
    if (!val) return '';
    const s = val.toString().trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
      const [d, m, a] = s.split('/');
      const ano = a.length === 2 ? '20' + a : a;
      return `${ano}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
      const [d, m, a] = s.split('-');
      return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  };

  const parseTime = (val: any) => {
    if (!val) return '08:00';
    const s = val.toString().trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
      const [h, m] = s.split(':');
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }
    return s || '08:00';
  };

  const cleanDoc = (val: any) => (val || '').toString().replace(/\D/g, '');
  const cleanFone = (val: any) => (val || '').toString().replace(/\D/g, '');
  const parseMoney = (val: any) => {
    if (!val && val !== 0) return 0;
    const s = val.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };

  const getCell = (row: any, fieldKey: string) => {
    const idx = mapping[fieldKey];
    return (idx === undefined || idx < 0) ? '' : (row[idx] || '').trim();
  };

  // Define schemas matching mappers.ts rules
  const schemas: { [key: string]: ImportSchema } = {
    pacientes: {
      label: 'Pacientes',
      table: 'pacientes',
      toDbMapper: mappers.pacToDb,
      fields: [
        { key: 'nome', label: 'Nome Completo', required: true, aliases: ['nome', 'paciente', 'nome_completo', 'name'] },
        { key: 'nasc', label: 'Data de Nascimento', required: false, aliases: ['nascimento', 'data_nasc', 'dt_nasc', 'birthday', 'born'] },
        { key: 'cpf', label: 'CPF', required: false, aliases: ['cpf', 'documento', 'doc'] },
        { key: 'sexo', label: 'Sexo', required: false, aliases: ['sexo', 'genero', 'gender', 'sex'] },
        { key: 'status', label: 'Status (Ativo/Inativo)', required: false, aliases: ['status', 'ativo', 'active'] },
        { key: 'tel', label: 'Telefone', required: false, aliases: ['telefone', 'fone', 'phone', 'celular', 'whatsapp', 'tel'] },
        { key: 'email', label: 'E-mail', required: false, aliases: ['email', 'e_mail', 'email_address'] },
        { key: 'end', label: 'Endereço', required: false, aliases: ['endereco', 'endereço', 'address', 'logradouro'] },
        { key: 'plano', label: 'Plano de Saúde', required: false, aliases: ['plano', 'convenio', 'health_plan', 'plan'] },
        { key: 'carteirinha', label: 'Nº Carteirinha', required: false, aliases: ['carteirinha', 'carteira', 'card', 'matricula'] },
        { key: 'estCivil', label: 'Estado Civil', required: false, aliases: ['estado_civil', 'estadocivil', 'civil'] },
        { key: 'profissao', label: 'Profissão', required: false, aliases: ['profissao', 'profissão', 'ocupacao', 'job'] },
        { key: 'titular', label: 'Titular do Plano', required: false, aliases: ['titular', 'titular_plano', 'holder'] },
        { key: 'obs', label: 'Observações', required: false, aliases: ['observacoes', 'observações', 'obs', 'notes'] }
      ],
      mapper: (row) => {
        const sexoRaw = norm(getCell(row, 'sexo'));
        const sexo = sexoRaw.includes('f') ? 'Feminino' : sexoRaw.includes('m') ? 'Masculino' : sexoRaw ? 'Outro' : 'Outro';
        const stRaw = norm(getCell(row, 'status'));
        const status = (stRaw === 'inativo' || stRaw === '0') ? 'Inativo' : 'Ativo';
        return {
          nome: getCell(row, 'nome'),
          nasc: parseDate(getCell(row, 'nasc')),
          cpf: cleanDoc(getCell(row, 'cpf')),
          sexo,
          status,
          tel: cleanFone(getCell(row, 'tel')),
          email: getCell(row, 'email'),
          end: getCell(row, 'end'),
          plano: getCell(row, 'plano') || 'Particular',
          planoId: 5, // Default Particular
          carteirinha: getCell(row, 'carteirinha'),
          estCivil: getCell(row, 'estCivil'),
          profissao: getCell(row, 'profissao'),
          titular: getCell(row, 'titular'),
          obs: getCell(row, 'obs')
        };
      },
      demo: "Nome,Nascimento,CPF,Telefone,Plano,Carteirinha\nCarlos Eduardo Silva,12/08/1990,123.456.789-00,(11) 98765-4321,SulAmérica,9876543210123\nMariana Souza,05/11/1985,222.333.444-55,(11) 97777-8888,Particular,"
    },
    profissionais: {
      label: 'Profissionais',
      table: 'profissionais',
      toDbMapper: mappers.profToDb,
      fields: [
        { key: 'nome', label: 'Nome Completo', required: true, aliases: ['nome', 'profissional', 'name', 'terapeuta'] },
        { key: 'nomeAgenda', label: 'Nome na Agenda', required: false, aliases: ['nome_agenda', 'nome_na_agenda', 'agenda_name'] },
        { key: 'esp', label: 'Especialidade', required: false, aliases: ['especialidade', 'specialty', 'area'] },
        { key: 'conselho', label: 'Conselho Prof.', required: false, aliases: ['tipo_conselho', 'conselho', 'council'] },
        { key: 'num', label: 'Nº Registro', required: false, aliases: ['num_conselho', 'numero_conselho', 'crm', 'crfa', 'crp', 'cro'] },
        { key: 'uf', label: 'UF Conselho', required: false, aliases: ['uf_conselho', 'uf', 'estado'] },
        { key: 'cbo', label: 'CBO', required: false, aliases: ['cbo', 'cod_cbo'] },
        { key: 'tel', label: 'Telefone', required: false, aliases: ['telefone', 'fone', 'phone', 'celular'] },
        { key: 'email', label: 'E-mail', required: false, aliases: ['email', 'e_mail'] },
        { key: 'cor', label: 'Cor (Hex)', required: false, aliases: ['cor_agenda', 'cor', 'color'] },
        { key: 'status', label: 'Status', required: false, aliases: ['status', 'ativo'] }
      ],
      mapper: (row) => {
        const nome = getCell(row, 'nome');
        const stRaw = norm(getCell(row, 'status'));
        const status = (stRaw === 'inativo' || stRaw === '0') ? 'Inativo' : 'Ativo';
        return {
          nome,
          nomeAgenda: getCell(row, 'nomeAgenda') || nome.split(' ')[0] || '',
          esp: getCell(row, 'esp'),
          conselho: getCell(row, 'conselho') || 'CRP',
          num: getCell(row, 'num'),
          uf: (getCell(row, 'uf') || 'SP').toUpperCase().slice(0, 2),
          cbo: getCell(row, 'cbo'),
          tel: cleanFone(getCell(row, 'tel')),
          email: getCell(row, 'email'),
          cor: getCell(row, 'cor') || '#4f8ef7',
          status
        };
      },
      demo: "Nome,Especialidade,Conselho,Numero,UF,Telefone\nDr. Roberto Gomes,Psiquiatria,CRM,12345,SP,(11) 98888-7777\nAmanda Lima,Psicologia,CRP,54321,SP,(11) 99999-1111"
    },
    agenda: {
      label: 'Agenda',
      table: 'agendamentos',
      toDbMapper: mappers.apptToDb,
      fields: [
        { key: 'dataISO', label: 'Data', required: true, aliases: ['data', 'date', 'dt', 'data_consulta'] },
        { key: 'paciente', label: 'Nome do Paciente', required: true, aliases: ['paciente', 'patient', 'nome_paciente', 'beneficiario'] },
        { key: 'profissional', label: 'Nome do Terapeuta', required: false, aliases: ['profissional', 'terapeuta', 'medico', 'doctor', 'professional'] },
        { key: 'hora', label: 'Horário Início', required: false, aliases: ['horario_inicio', 'hora_inicio', 'inicio', 'start', 'hora', 'horario'] },
        { key: 'horaFim', label: 'Horário Término', required: false, aliases: ['horario_fim', 'hora_fim', 'fim', 'end', 'hora_termino'] },
        { key: 'durMin', label: 'Duração (Min)', required: false, aliases: ['duracao', 'duracao_min', 'duration', 'mins'] },
        { key: 'plano', label: 'Plano de Saúde', required: false, aliases: ['plano', 'convenio', 'plan'] },
        { key: 'carteirinha', label: 'Carteirinha', required: false, aliases: ['carteirinha', 'carteira', 'card'] },
        { key: 'modalidade', label: 'Modalidade (Online/Presencial)', required: false, aliases: ['modalidade', 'modality', 'local'] },
        { key: 'status', label: 'Status', required: false, aliases: ['status', 'situacao'] },
        { key: 'obs', label: 'Observações', required: false, aliases: ['observacoes', 'obs', 'notes'] }
      ],
      mapper: (row) => {
        const durMin = parseInt(getCell(row, 'durMin')) || 60;
        const modRaw = norm(getCell(row, 'modalidade'));
        const modalidade = (modRaw.includes('online') || modRaw.includes('remot')) ? 'online' : 'presencial';
        const stRaw = norm(getCell(row, 'status'));
        let status = 'agendado';
        if (stRaw.includes('confirm')) status = 'confirmado';
        else if (stRaw.includes('atend') || stRaw.includes('realiz')) status = 'atendido';
        else if (stRaw.includes('cancel')) status = 'cancelado';
        else if (stRaw.includes('desmarc') || stRaw.includes('falt')) status = 'desmarcado';

        return {
          dataISO: parseDate(getCell(row, 'dataISO')),
          paciente: getCell(row, 'paciente'),
          profissional: getCell(row, 'profissional'),
          hora: parseTime(getCell(row, 'hora')),
          horaFim: getCell(row, 'horaFim') ? parseTime(getCell(row, 'horaFim')) : '',
          durMin,
          plano: getCell(row, 'plano') || 'Particular',
          planoId: 5,
          carteirinha: getCell(row, 'carteirinha'),
          modalidade,
          status,
          obs: getCell(row, 'obs'),
          waSent: false
        };
      },
      demo: "Data,Paciente,Terapeuta,Hora,Duracao,Plano\n2026-06-25,Carlos Eduardo Silva,Amanda Lima,09:00,60,Particular\n2026-06-25,Mariana Souza,Dr. Roberto Gomes,10:00,30,SulAmérica"
    },
    planos: {
      label: 'Planos de Saúde',
      table: 'planos_saude',
      toDbMapper: mappers.planoToDb,
      fields: [
        { key: 'nome', label: 'Nome da Operadora', required: true, aliases: ['nome', 'plano', 'operadora', 'name'] },
        { key: 'nomeGuia', label: 'Nome na Guia TISS', required: false, aliases: ['nome_guia_tiss', 'nome_guia', 'nome_tiss'] },
        { key: 'ans', label: 'Registro ANS', required: false, aliases: ['registro_ans', 'ans', 'reg_ans', 'codigo_ans'] },
        { key: 'cnpj', label: 'CNPJ', required: false, aliases: ['cnpj_operadora', 'cnpj', 'cnpj_plano'] },
        { key: 'versaoTiss', label: 'Versão TISS', required: false, aliases: ['versao_tiss', 'versao', 'version'] },
        { key: 'tel', label: 'Telefone', required: false, aliases: ['telefone', 'fone', 'phone'] },
        { key: 'email', label: 'E-mail', required: false, aliases: ['email', 'e_mail'] },
        { key: 'status', label: 'Status', required: false, aliases: ['status', 'ativo'] }
      ],
      mapper: (row) => {
        const stRaw = norm(getCell(row, 'status'));
        const status = (stRaw === 'inativo' || stRaw === '0') ? 'Inativo' : 'Ativo';
        const nome = getCell(row, 'nome');
        return {
          nome,
          nomeGuia: getCell(row, 'nomeGuia') || nome,
          ans: getCell(row, 'ans'),
          cnpj: cleanDoc(getCell(row, 'cnpj')),
          versaoTiss: getCell(row, 'versaoTiss') || '4.02.00',
          tel: cleanFone(getCell(row, 'tel')),
          email: getCell(row, 'email'),
          tabela: 'CBHPM',
          status,
          usaTiss: true,
          aplicaTodos: true,
          juntarGuia: true
        };
      },
      demo: "Nome,ANS,CNPJ,VersaoTISS\nBradesco Saúde,005711,00.571.123/0001-99,4.02.00\nAmil,326305,01.123.456/0001-00,4.02.00"
    },
    procedimentos: {
      label: 'Tabela de Preços',
      table: 'procedimentos',
      toDbMapper: mappers.procToDb,
      fields: [
        { key: 'codigo', label: 'Código TUSS', required: true, aliases: ['codigo_tuss', 'codigo', 'code', 'cod_tuss'] },
        { key: 'desc', label: 'Descrição', required: true, aliases: ['descricao', 'procedimento', 'desc'] },
        { key: 'descCurta', label: 'Desc. Curta', required: false, aliases: ['descricao_resumida', 'desc_curta'] },
        { key: 'tipo', label: 'Tipo (Sessão, Consulta)', required: false, aliases: ['tipo', 'type'] },
        { key: 'valPart', label: 'Valor Particular (R$)', required: false, aliases: ['valor_particular', 'valor_part', 'particular'] },
        { key: 'valPlano', label: 'Valor Plano (R$)', required: false, aliases: ['valor_plano_padrao', 'valor_plano', 'plano'] },
        { key: 'tabela', label: 'Tabela Referência', required: false, aliases: ['tabela_referencia', 'tabela', 'table'] },
        { key: 'status', label: 'Status', required: false, aliases: ['status', 'ativo'] }
      ],
      mapper: (row) => {
        const stRaw = norm(getCell(row, 'status'));
        const status = (stRaw === 'inativo' || stRaw === '0') ? 'Inativo' : 'Ativo';
        return {
          codigo: getCell(row, 'codigo'),
          desc: getCell(row, 'desc'),
          descCurta: getCell(row, 'descCurta') || getCell(row, 'desc').slice(0, 30),
          tipo: getCell(row, 'tipo') || 'Sessão',
          valPart: parseMoney(getCell(row, 'valPart')),
          valPlano: parseMoney(getCell(row, 'valPlano')),
          tabela: getCell(row, 'tabela') || 'TUSS',
          planoId: 0,
          status
        };
      },
      demo: "Codigo,Procedimento,ValorPart,ValorPlano\n50000470,Avaliação Fonoaudiológica,150.00,80.00\n50000488,Sessão de Fonoaudiologia,120.00,65.00"
    },
    guias_sadt: {
      label: 'Guias SADT',
      table: 'guias_sadt',
      toDbMapper: mappers.guiaToDb,
      fields: [
        { key: 'num', label: 'Nº Guia Operadora', required: true, aliases: ['num_guia_operadora', 'guia_operadora', 'num_guia', 'n_guia', 'guia'] },
        { key: 'pac', label: 'Nome do Paciente', required: true, aliases: ['paciente', 'beneficiario', 'patient', 'nome_paciente'] },
        { key: 'plano', label: 'Plano de Saúde', required: true, aliases: ['plano', 'convenio', 'operadora', 'plan'] },
        { key: 'carteirinha', label: 'Nº Carteirinha', required: false, aliases: ['carteirinha', 'carteira', 'card'] },
        { key: 'numOp', label: 'Nº Guia Prestador', required: false, aliases: ['num_guia_prestador', 'guia_prestador', 'num_op'] },
        { key: 'data', label: 'Data Atendimento', required: false, aliases: ['data_atendimento', 'data', 'dt_atend', 'date'] },
        { key: 'valor', label: 'Valor Total (R$)', required: false, aliases: ['valor_total', 'total', 'valor'] },
        { key: 'status', label: 'Status (Pendente/Enviado/Pago/Glosado)', required: false, aliases: ['status', 'situacao'] }
      ],
      mapper: (row) => {
        const stRaw = norm(getCell(row, 'status'));
        let status: any = 'Pendente';
        if (stRaw.includes('enviad') || stRaw.includes('sent')) status = 'Enviado';
        else if (stRaw.includes('pag') || stRaw.includes('paid')) status = 'Pago';
        else if (stRaw.includes('glos') || stRaw.includes('deni')) status = 'Glosado';
        return {
          num: getCell(row, 'num'),
          pac: getCell(row, 'pac'),
          plano: getCell(row, 'plano'),
          planoId: 5,
          carteirinha: getCell(row, 'carteirinha'),
          numOp: getCell(row, 'numOp'),
          data: parseDate(getCell(row, 'data')) || new Date().toISOString().split('T')[0],
          valor: parseMoney(getCell(row, 'valor')),
          status,
          dados: {},
          profId: 0
        };
      },
      demo: "Guia,Paciente,Plano,Carteirinha,Valor\n987654,Carlos Eduardo Silva,Bradesco Saúde,9876543210,120.00\n543210,Mariana Souza,Amil,11223344,80.00"
    },
    senhas: {
      label: 'Senhas / Autorizações',
      table: 'senhas_autorizacoes',
      toDbMapper: mappers.senhaToDb,
      fields: [
        { key: 'numSenha', label: 'Senha Autorização', required: true, aliases: ['numero_senha', 'num_senha', 'senha', 'auth_code', 'autorizacao'] },
        { key: 'paciente', label: 'Nome do Paciente', required: true, aliases: ['paciente', 'beneficiario', 'patient', 'nome_paciente'] },
        { key: 'carteirinha', label: 'Nº Carteirinha', required: false, aliases: ['carteirinha', 'carteira', 'card'] },
        { key: 'planoId', label: 'ID do Plano', required: false, aliases: ['plano_id', 'plano', 'convenio'] },
        { key: 'numGuiaOp', label: 'Nº Guia Operadora', required: false, aliases: ['num_guia_operadora', 'guia_operadora', 'num_guia'] },
        { key: 'dataAut', label: 'Data Autorização', required: false, aliases: ['data_autorizacao', 'dt_autorizacao', 'data_auth'] },
        { key: 'validade', label: 'Validade da Senha', required: false, aliases: ['validade_senha', 'validade', 'expiry', 'vencimento'] },
        { key: 'qtdAutorizada', label: 'Sessões Autorizadas', required: false, aliases: ['qtd_autorizada', 'qtd_aut', 'sessoes_autorizadas', 'qtd'] },
        { key: 'qtdUsada', label: 'Sessões Utilizadas', required: false, aliases: ['qtd_usada', 'sessoes_usadas', 'usadas'] },
        { key: 'status', label: 'Status (Ativa/Vencida/Usada/Cancelada)', required: false, aliases: ['status'] }
      ],
      mapper: (row) => {
        const stRaw = norm(getCell(row, 'status'));
        let status: any = 'Ativa';
        if (stRaw.includes('usad')) status = 'Usada';
        else if (stRaw.includes('venc') || stRaw.includes('expir')) status = 'Vencida';
        else if (stRaw.includes('cancel')) status = 'Cancelada';
        return {
          numSenha: getCell(row, 'numSenha'),
          paciente: getCell(row, 'paciente'),
          carteirinha: getCell(row, 'carteirinha'),
          planoId: 5, // Particular fallback
          numGuiaOp: getCell(row, 'numGuiaOp'),
          dataAut: parseDate(getCell(row, 'dataAut')) || new Date().toISOString().split('T')[0],
          validade: parseDate(getCell(row, 'validade')),
          qtdAutorizada: parseInt(getCell(row, 'qtdAutorizada')) || 10,
          qtdUsada: parseInt(getCell(row, 'qtdUsada')) || 0,
          status,
          procs: [],
          ativa: status === 'Ativa'
        };
      },
      demo: "Senha,Paciente,Carteirinha,QtdAutorizada,Validade\nSENHA123,Carlos Eduardo Silva,9876543210,12,2026-12-31\nAUT987,Mariana Souza,11223344,10,2026-10-31"
    },
    anamnese: {
      label: 'Anamneses',
      table: 'historico',
      toDbMapper: (item: any) => {
        return mappers.histToDb({
          pacId: item.pacId,
          tipo: item.tipo,
          titulo: item.titulo,
          conteudo: {
            texto: item.conteudo,
            profId: item.profId || null
          },
          profId: item.profId || null,
          data: item.data,
          status: item.status,
          fonte: item.fonte
        });
      },
      fields: [
        { key: 'pacienteNome', label: 'Nome do Paciente', required: true, aliases: ['paciente', 'nome_paciente', 'nome', 'patient'] },
        { key: 'profissionalNome', label: 'Nome do Terapeuta', required: false, aliases: ['profissional', 'terapeuta', 'medico', 'prof', 'professional'] },
        { key: 'data', label: 'Data', required: false, aliases: ['data', 'date', 'dt', 'data_anamnese'] },
        { key: 'titulo', label: 'Título', required: false, aliases: ['titulo', 'title', 'assunto'] },
        { key: 'conteudo', label: 'Conteúdo / Respostas', required: true, aliases: ['conteudo', 'texto', 'respostas', 'content', 'pergunta_resposta'] }
      ],
      mapper: (row) => {
        return {
          pacienteNome: getCell(row, 'pacienteNome'),
          profissionalNome: getCell(row, 'profissionalNome'),
          data: parseDate(getCell(row, 'data')) || new Date().toISOString().split('T')[0],
          titulo: getCell(row, 'titulo') || 'Anamnese Importada',
          conteudo: getCell(row, 'conteudo'),
          tipo: 'anamnese',
          status: 'finalizado',
          fonte: 'importacao'
        };
      },
      demo: "Paciente,Terapeuta,Data,Titulo,Conteudo\nCarlos Eduardo Silva,Amanda Lima,2026-06-25,Anamnese Inicial,Queixa principal: Dificuldade na fala. Histórico familiar: Sem antecedentes.\nMariana Souza,Dr. Roberto Gomes,2026-06-25,Ficha Clínica,Paciente relata ansiedade leve e insônia."
    },
    evolucoes: {
      label: 'Evoluções',
      table: 'historico',
      toDbMapper: (item: any) => {
        return mappers.histToDb({
          pacId: item.pacId,
          tipo: item.tipo,
          titulo: item.titulo,
          conteudo: {
            texto: item.conteudo,
            profId: item.profId || null
          },
          profId: item.profId || null,
          data: item.data,
          status: item.status,
          fonte: item.fonte
        });
      },
      fields: [
        { key: 'pacienteNome', label: 'Nome do Paciente', required: true, aliases: ['paciente', 'nome_paciente', 'nome', 'patient'] },
        { key: 'profissionalNome', label: 'Nome do Terapeuta', required: false, aliases: ['profissional', 'terapeuta', 'medico', 'prof', 'professional'] },
        { key: 'data', label: 'Data', required: false, aliases: ['data', 'date', 'dt', 'data_evolucao'] },
        { key: 'titulo', label: 'Título', required: false, aliases: ['titulo', 'title', 'sessao'] },
        { key: 'conteudo', label: 'Conteúdo', required: true, aliases: ['conteudo', 'texto', 'evolucao', 'content', 'detalhes'] }
      ],
      mapper: (row) => {
        return {
          pacienteNome: getCell(row, 'pacienteNome'),
          profissionalNome: getCell(row, 'profissionalNome'),
          data: parseDate(getCell(row, 'data')) || new Date().toISOString().split('T')[0],
          titulo: getCell(row, 'titulo') || 'Evolução de Sessão',
          conteudo: getCell(row, 'conteudo'),
          tipo: 'evolucao',
          status: 'finalizado',
          fonte: 'importacao'
        };
      },
      demo: "Paciente,Terapeuta,Data,Titulo,Conteudo\nCarlos Eduardo Silva,Amanda Lima,2026-06-25,Sessão 1,Realizado treino de fonemas linguodentais. Excelente evolução.\nMariana Souza,Dr. Roberto Gomes,2026-06-25,Sessão 2,Discutido manejo de estresse ocupacional. Paciente colaborativa."
    },
    espera: {
      label: 'Lista de Espera',
      table: 'lista_espera',
      toDbMapper: mappers.esperaToDb,
      fields: [
        { key: 'dataCadastro', label: 'Data do Cadastro', required: false, aliases: ['data_cadastro', 'datacadastro', 'data_entrada', 'data', 'dt_cadastro', 'cadastro'] },
        { key: 'nome', label: 'Nome Completo', required: true, aliases: ['nome', 'paciente', 'nome_completo', 'name'] },
        { key: 'tel', label: 'Telefone', required: false, aliases: ['telefone', 'fone', 'phone', 'celular', 'whatsapp', 'tel'] },
        { key: 'email', label: 'E-mail', required: false, aliases: ['email', 'e_mail', 'email_address'] },
        { key: 'especialidade', label: 'Especialidade', required: false, aliases: ['especialidade', 'area', 'terapia', 'especialidade_terapia', 'specialty'] },
        { key: 'idade', label: 'Idade', required: false, aliases: ['idade', 'age', 'idade_paciente', 'anos'] },
        { key: 'nasc', label: 'Data de Nascimento', required: false, aliases: ['nasc', 'nascimento', 'data_nasc', 'dt_nasc', 'birthday'] },
        { key: 'periodo', label: 'Período', required: false, aliases: ['periodo', 'período', 'turno', 'horario', 'period'] },
        { key: 'plano', label: 'Convênio / Plano', required: false, aliases: ['convenio', 'convênio', 'plano', 'plano_saude', 'health_plan'] },
        { key: 'obs', label: 'Observações', required: false, aliases: ['observacao', 'observações', 'obs', 'notes', 'comentarios'] }
      ],
      mapper: (row) => {
        const dtStr = parseDate(getCell(row, 'dataCadastro')) || new Date().toLocaleDateString('pt-BR');
        const valIdade = getCell(row, 'idade');
        const valNasc = getCell(row, 'nasc');
        const finalIdade = valIdade || (valNasc ? parseDate(valNasc) : '');

        return {
          dataCadastro: dtStr,
          dataEntrada: dtStr,
          nome: getCell(row, 'nome'),
          tel: cleanFone(getCell(row, 'tel')),
          email: getCell(row, 'email'),
          especialidade: getCell(row, 'especialidade'),
          idade: finalIdade,
          nasc: parseDate(valNasc),
          periodo: getCell(row, 'periodo') || 'Ambos',
          plano: getCell(row, 'plano') || 'Particular',
          obs: getCell(row, 'obs'),
          status: 'Aguardando'
        };
      },
      demo: "Data Cadastro,Nome,Telefone,Email,Especialidade,Idade,Periodo,Convenio,Observacao\n02/08/2026,Lucas Oliveira,(11) 99999-8888,lucas@email.com,Psicologia,8 anos,Tarde,Bradesco Saúde,Aguardando vaga no período da tarde\n02/08/2026,Sophia Santos,(11) 97777-6666,,Fonoterapia,5 anos,Manhã,Particular,Preferência para terças-feiras"
    }
  };

  const schema = schemas[tipo === 'guias_sadt' ? 'guias_sadt' : tipo];

  // Auto detect columns on load
  const autoDetectColumns = (headerList: string[]) => {
    const newMapping: { [key: string]: number } = {};
    schema.fields.forEach((field) => {
      // 1. Tentar correspondência exata primeiro
      let matchIdx = headerList.findIndex((h) => {
        const normH = norm(h);
        return field.aliases.some((alias) => norm(alias) === normH);
      });

      // 2. Se não encontrou exata, tentar contida com proteção estrita para 'idade'
      if (matchIdx < 0) {
        matchIdx = headerList.findIndex((h) => {
          const normH = norm(h);
          return field.aliases.some((alias) => {
            const normA = norm(alias);

            // Proteção estrita: 'idade' não pode casar com 'unidade', 'cidade', 'validade', 'quantidade', etc.
            if (field.key === 'idade' || normA === 'idade') {
              if (['unidade', 'cidade', 'validade', 'quantidade', 'qualidade', 'oportunidade'].some(w => normH.includes(w))) {
                return false;
              }
            }

            if (normA.length < 3) {
              return normH === normA;
            }

            return normH.includes(normA);
          });
        });
      }

      newMapping[field.key] = matchIdx >= 0 ? matchIdx : -1;
    });
    setMapping(newMapping);
  };

  // Reset page state on navigate
  useEffect(() => {
    setStep(1);
    setCsvText('');
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setPreviewRows([]);
    setResult(null);
  }, [tipo]);

  // Fetch patient and professional lists for lookups
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: pacs } = await supabase.from('pacientes').select('id, nome');
        const { data: profs } = await supabase.from('profissionais').select('id, nome, nome_agenda');
        if (pacs) setPacientesList(pacs);
        if (profs) setProfissionaisList(profs);
      } catch (err) {
        console.error('Erro ao buscar pacientes/profissionais:', err);
      }
    };
    fetchData();
  }, []);

  const matchPaciente = async (nomeRaw: string) => {
    const normRaw = norm(nomeRaw);
    let found = pacientesList.find(p => norm(p.nome) === normRaw || norm(p.nome).includes(normRaw) || normRaw.includes(norm(p.nome)));
    if (found) return found;

    try {
      // 1. Busca exatamente como está na planilha
      let { data } = await supabase
        .from('pacientes')
        .select('id, nome')
        .ilike('nome', `%${nomeRaw.trim()}%`);

      // 2. Se não encontrou, tenta buscar substituindo as vogais por wildcard (_) para contornar acentuação no Postgres
      if (!data || data.length === 0) {
        const wildcardName = nomeRaw.trim()
          .replace(/[aeiouáàâãäéèêëíìîïóòôõöúùûüç]/gi, '_');
        const res = await supabase
          .from('pacientes')
          .select('id, nome')
          .like('nome', `%${wildcardName}%`);
        data = res.data;
      }

      if (data && data.length > 0) {
        const best = data.find(p => norm(p.nome) === normRaw || norm(p.nome).includes(normRaw) || normRaw.includes(norm(p.nome))) || data[0];
        setPacientesList(prev => [...prev, best]);
        return best;
      }
    } catch (e) {
      console.error(e);
    }
    return undefined;
  };

  const matchProfissional = async (nomeRaw: string) => {
    const normRaw = norm(nomeRaw);
    let found = profissionaisList.find(p => 
      norm(p.nome) === normRaw || 
      norm(p.nome_agenda) === normRaw ||
      norm(p.nome).includes(normRaw) || 
      normRaw.includes(norm(p.nome))
    );
    if (found) return found;

    try {
      // 1. Busca exatamente como está na planilha
      let { data } = await supabase
        .from('profissionais')
        .select('id, nome, nome_agenda')
        .ilike('nome', `%${nomeRaw.trim()}%`);

      // 2. Se não encontrou, tenta com wildcard (_)
      if (!data || data.length === 0) {
        const wildcardName = nomeRaw.trim()
          .replace(/[aeiouáàâãäéèêëíìîïóòôõöúùûüç]/gi, '_');
        const res = await supabase
          .from('profissionais')
          .select('id, nome, nome_agenda')
          .like('nome', `%${wildcardName}%`);
        data = res.data;
      }

      if (data && data.length > 0) {
        const best = data.find(p => norm(p.nome) === normRaw || norm(p.nome_agenda) === normRaw || norm(p.nome).includes(normRaw) || normRaw.includes(norm(p.nome))) || data[0];
        setProfissionaisList(prev => [...prev, best]);
        return best;
      }
    } catch (e) {
      console.error(e);
    }
    return undefined;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  // Load demo CSV template
  const handleLoadDemo = () => {
    setCsvText(schema.demo);
  };

  // Parse CSV function
  const parseCSVLines = (text: string) => {
    const lines: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    let i = 0;
    const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    while (i < t.length) {
      const c = t[i];
      if (c === '"') {
        if (inQuotes && t[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
        i++;
        continue;
      }
      if ((c === ',' || c === ';') && !inQuotes) {
        row.push(field.trim());
        field = '';
        i++;
        continue;
      }
      if (c === '\n' && !inQuotes) {
        row.push(field.trim());
        if (row.some(f => f !== '')) lines.push(row);
        row = [];
        field = '';
        i++;
        continue;
      }
      field += c;
      i++;
    }
    if (field || row.length) {
      row.push(field.trim());
      if (row.some(f => f !== '')) lines.push(row);
    }
    return lines;
  };

  const handleNextStep1 = () => {
    const pasted = csvText.trim();
    if (!pasted) return alert('Por favor, cole o CSV ou carregue os dados.');

    const lines = parseCSVLines(pasted);
    if (lines.length < 2) return alert('O arquivo deve conter o cabeçalho e pelo menos uma linha de dados.');

    const headerCols = lines[0].map(h => h.trim());
    const dataRows = lines.slice(1).filter(r => r.some(col => col !== ''));

    setHeaders(headerCols);
    setRawRows(dataRows);
    autoDetectColumns(headerCols);
    setStep(2);
  };

  const handleNextStep2 = async () => {
    // Validate required fields mapping
    const missing = schema.fields.filter(f => f.required && (mapping[f.key] === undefined || mapping[f.key] < 0));
    if (missing.length > 0) {
      return alert(`Mapeie os campos obrigatórios: ${missing.map(f => f.label).join(', ')}`);
    }

    setLoading(true);
    const processed = [];

    for (let idx = 0; idx < rawRows.length; idx++) {
      const row = rawRows[idx];
      const payload = schema.mapper(row);
      const warnings: string[] = [];
      const errors: string[] = [];

      // Validate required values
      schema.fields.forEach(f => {
        if (f.required && !payload[f.key]) {
          errors.push(`Campo obrigatório ausente: ${f.label}`);
        }
      });

      // Special lookup logic for anamnese / evolucoes
      if (tipo === 'anamnese' || tipo === 'evolucoes') {
        const pac = await matchPaciente(payload.pacienteNome);
        if (!pac) {
          errors.push(`Paciente não encontrado: "${payload.pacienteNome}"`);
        } else {
          payload.pacId = pac.id;
        }

        if (payload.profissionalNome) {
          const prof = await matchProfissional(payload.profissionalNome);
          if (prof) {
            payload.profId = prof.id;
          } else {
            warnings.push(`Terapeuta "${payload.profissionalNome}" não encontrado.`);
          }
        }
      }

      processed.push({
        linha: idx + 2,
        status: errors.length > 0 ? 'erro' : warnings.length > 0 ? 'aviso' : 'ok',
        msg: errors.length > 0 ? errors.join('; ') : warnings.length > 0 ? warnings.join('; ') : 'OK',
        dados: payload
      });
    }

    setPreviewRows(processed);
    setLoading(false);
    setStep(3);
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    const validRows = previewRows.filter(p => p.status !== 'erro').map(p => schema.toDbMapper(p.dados));

    if (validRows.length === 0) {
      setLoading(false);
      return alert('Nenhum registro válido para importar.');
    }

    let successCount = 0;
    let errorCount = previewRows.filter(p => p.status === 'erro').length;

    try {
      const BATCH_SIZE = 50;
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        let query = supabase.from(schema.table);

        let error;
        if (schema.conflito) {
          const res = await query.upsert(batch, { onConflict: schema.conflito });
          error = res.error;
        } else {
          // If insert fails for batch, attempt row-by-row
          const res = await query.insert(batch);
          if (res.error) {
            for (const row of batch) {
              const singleRes = await supabase.from(schema.table).insert(row);
              if (singleRes.error) errorCount++;
              else successCount++;
            }
          } else {
            successCount += batch.length;
          }
        }

        if (error) {
          console.error('[Import BATCH Error]', error);
          errorCount += batch.length;
        } else if (!schema.conflito) {
          // Batch insertion succeeded, already counted above
        } else {
          successCount += batch.length;
        }
      }

      setResult({
        sucesso: successCount,
        erros: errorCount,
        avisos: previewRows.filter(p => p.status === 'aviso').length
      });
      setStep(4);
    } catch (err: any) {
      console.error(err);
      alert('Erro inesperado: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Page Header */}
      <div>
        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Ferramentas de Importação</span>
        <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans">
          Importar {schema.label}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Carregue e mapeie planilhas CSV para importar dados de {schema.label.toLowerCase()} diretamente no ClinicFlow.
        </p>
      </div>

      {/* Progress Wizard Steps */}
      <div className="flex items-center gap-2 bg-[#131622]/40 border border-white/[0.04] p-3 rounded-2xl">
        {[
          { num: 1, label: 'Carregar CSV' },
          { num: 2, label: 'Mapear Colunas' },
          { num: 3, label: 'Visualizar Preview' },
          { num: 4, label: 'Concluído' }
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
              step === s.num ? 'bg-indigo-500 text-white' : step > s.num ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-500'
            }`}>
              {s.num}
            </div>
            <span className={`font-semibold ${step === s.num ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
            {s.num < 4 && <ChevronRight size={12} className="text-slate-600" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload or Paste CSV */}
      {step === 1 && (
        <div className="bg-[#131622]/50 border border-white/[0.04] p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Carregar Arquivo de Importação</h3>
            <button
              onClick={handleLoadDemo}
              className="px-3 py-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg text-slate-300 font-bold"
            >
              Usar Exemplo de Teste
            </button>
          </div>

          {/* File Selector Dropzone */}
          <div className="border border-dashed border-white/[0.08] hover:border-indigo-500/50 bg-[#0f111a]/50 p-6 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all relative">
            <Upload size={20} className="text-slate-400" />
            <span className="font-bold text-slate-300">Escolha um arquivo CSV ou arraste e solte aqui</span>
            <span className="text-[10px] text-slate-500">Apenas arquivos .csv são suportados</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-4 my-2">
            <div className="h-[1px] bg-white/[0.04] flex-1"></div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">ou colar conteúdo manualmente</span>
            <div className="h-[1px] bg-white/[0.04] flex-1"></div>
          </div>

          <div>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Cole os dados separados por vírgula ou ponto-e-vírgula aqui..."
              className="w-full bg-[#0f111a] border border-white/[0.06] rounded-xl p-4 text-slate-200 font-mono text-[10px] focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-xl space-y-2">
            <span className="block text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Campos Esperados</span>
            <div className="flex flex-wrap gap-2">
              {schema.fields.map(f => (
                <span key={f.key} className="bg-white/5 border border-white/[0.05] px-2 py-0.5 rounded text-slate-300">
                  {f.required && <span className="text-rose-500 mr-0.5">*</span>}
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/[0.04]">
            <button
              onClick={handleNextStep1}
              className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold"
            >
              Avançar
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Mapping Columns */}
      {step === 2 && (
        <div className="bg-[#131622]/50 border border-white/[0.04] p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Mapeamento de Colunas</h3>
            <p className="text-[10px] text-slate-400 mt-1">Indique qual coluna da sua planilha corresponde a cada campo do ClinicFlow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schema.fields.map((field) => (
              <div key={field.key} className="bg-[#0f111a]/40 border border-white/[0.03] p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-300">
                    {field.required && <span className="text-rose-500 mr-0.5">*</span>}
                    {field.label}
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase font-mono">{field.key}</span>
                </div>
                <select
                  value={mapping[field.key] !== undefined ? mapping[field.key] : -1}
                  onChange={(e) => {
                    const selIdx = parseInt(e.target.value);
                    setMapping(prev => ({ ...prev, [field.key]: selIdx }));
                  }}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value={-1}>— Não importar este campo —</option>
                  {headers.map((h, idx) => (
                    <option key={idx} value={idx}>
                      Coluna {idx + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-white/[0.04]">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/5"
            >
              Voltar
            </button>
            <button
              onClick={handleNextStep2}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Avançar'}
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review Preview */}
      {step === 3 && (
        <div className="bg-[#131622]/50 border border-white/[0.04] p-6 rounded-2xl space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Preview de Importação</h3>
              <p className="text-[10px] text-slate-400 mt-1">Revise os registros antes de confirmar a gravação no banco de dados.</p>
            </div>
            <div className="flex gap-3 text-[10px] font-bold">
              <span className="text-emerald-400">✓ {previewRows.filter(p => p.status === 'ok').length} Válidos</span>
              <span className="text-rose-500">✗ {previewRows.filter(p => p.status === 'erro').length} Com Erro</span>
            </div>
          </div>

          {/* Table Preview */}
          <div className="overflow-x-auto border border-white/[0.04] rounded-xl bg-[#0f111a]/40 divide-y divide-white/[0.02]">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-white/[0.02] text-slate-400 font-bold">
                <tr>
                  <th className="p-3">Linha</th>
                  <th className="p-3">Identificação</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Mensagem / Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] font-mono">
                {(() => {
                  const rowsToShow = previewRows.filter(row => tipo !== 'evolucoes' || row.status === 'erro');
                  if (rowsToShow.length === 0) {
                    return (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-emerald-400 font-bold font-sans">
                          ✓ Nenhum erro encontrado! Todos os registros estão prontos para importação.
                        </td>
                      </tr>
                    );
                  }
                  return rowsToShow.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.005]">
                      <td className="p-3 text-slate-500 font-bold">{row.linha}</td>
                      <td className="p-3 text-slate-200 font-sans font-bold">
                        {row.dados?.nome || row.dados?.paciente || row.dados?.pacienteNome || row.dados?.num || '—'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase font-sans ${
                          row.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-sans">{row.msg}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-4 border-t border-white/[0.04]">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/5"
            >
              Voltar
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Confirmar Importação'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Finished */}
      {step === 4 && result && (
        <div className="bg-[#131622]/50 border border-white/[0.04] p-8 rounded-2xl text-center space-y-6 max-w-lg mx-auto shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 size={24} />
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-black text-white">Importação Concluída</h3>
            <p className="text-slate-400">Os dados válidos foram gravados com sucesso no banco de dados.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-[#0f111a]/60 border border-white/[0.04] p-4 rounded-xl max-w-sm mx-auto">
            <div>
              <span className="block text-2xl font-black text-emerald-400 font-mono">{result.sucesso}</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase">Sucesso</span>
            </div>
            <div>
              <span className="block text-2xl font-black text-rose-500 font-mono">{result.erros}</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase">Ignorados / Erros</span>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold shadow-lg"
            >
              Nova Importação
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
