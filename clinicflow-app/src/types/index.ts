export interface Paciente {
  id: number;
  nome: string;
  nasc: string;
  cpf: string;
  tel: string;
  email: string;
  end: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  ufEnd?: string;
  planoId: number;
  plano: string;
  carteirinha: string;
  sexo: string;
  status: string;
  obs: string;
  ultima: string;
  estCivil: string;
  profissao: string;
  titular: string;
  foto?: string;
  senhaChat?: string;
}

export interface Profissional {
  id: number;
  nome: string;
  nomeAgenda: string;
  esp: string;
  conselho: string;
  num: string;
  uf: string;
  cbo: string;
  cor: string;
  status: string;
  tel: string;
  email: string;
  foto?: string;
  instagram?: string;
  linkedin?: string;
  googleCalendarId?: string;
  valor30?: number;
  valor60?: number;
  valorAval?: number;
  valorParticular?: number;
  valorDesmarqueApos18?: number;
  contaTipo?: 'PF' | 'PJ';
  pagarComo?: 'pix' | 'ted';
  razaoSocial?: string;
  pix?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
}

export interface PlanoSaude {
  id: number;
  nome: string;
  nomeGuia: string;
  cnpj: string;
  ans: string;
  tabela: string;
  codPrestador: string;
  nomeContratado: string;
  cnes: string;
  numGuiaInicial: number;
  usaTiss: boolean;
  aplicaTodos: boolean;
  tipoId: string;
  versaoTiss: string;
  tel: string;
  email: string;
  obs: string;
  status: string;
  pacientes: number;
  juntarGuia: boolean;
  nomePlanoGuia?: string;
  logo?: string;
  foto?: string;
}

export interface Procedimento {
  id: number;
  codigo: string;
  desc: string;
  descCurta: string;
  tipo: string;
  valPart: number;
  valPlano: number;
  tabela: string;
  planoId: number;
  codigoServicoAbrasf?: string;
  status: string;
  obs: string;
}

export interface Agendamento {
  id: number;
  profId: number;
  pacId?: number | null;
  paciente: string;
  plano: string;
  planoId: number;
  hora: string;
  horaFim: string;
  durMin: number;
  dataISO: string;
  status: string;
  obs: string;
  modalidade: 'presencial' | 'online';
  meetLink?: string;
  waSent: boolean;
  carteirinha?: string;
  guia?: {
    autorizacao: string;
    total: number;
  } | null;
  elegivel?: boolean;
  statusElegibilidade?: 'ELEGIVEL' | 'INELEGIVEL' | 'PENDENTE';
  tipo?: string;
}

export interface ProcedimentoGuia {
  codigo: string;
  desc: string;
  qtd: number;
  valor: number;
  total: number;
}

export interface GuiaSadt {
  id: number;
  num: string;
  pac: string;
  pacId?: number | null;
  agendamentoId?: number | null;
  codigoProcedimento?: string | null;
  planoId: number;
  plano: string;
  profId: number;
  valor: number;
  status: 'Pendente' | 'Enviado' | 'Pago' | 'Glosado';
  data: string;
  loteId?: number | null;
  loteNum?: string | null;
  dados: {
    procs?: ProcedimentoGuia[];
    [key: string]: any;
  };
  carteirinha?: string;
  numOp?: string;
  cid?: string;
}

export interface LoteTiss {
  id: number;
  num: string;
  competencia: string;
  planoId: number;
  plano: string;
  qtd: number;
  valor: number;
  status: 'Pendente' | 'Gerado' | 'Enviado' | 'Faturado' | 'Glosado';
  dataCriacao: string;
  dataEnvio?: string;
  obs: string;
  guiaIds: number[];
  xml?: string;
}

export interface ProcedimentoSenha {
  codigo: string;
  desc: string;
}

export interface SenhaPlano {
  id: number;
  planoId: number;
  paciente: string;
  carteirinha: string;
  numGuiaOp: string;
  numSenha: string;
  dataAut: string;
  validade: string;
  qtdAutorizada: number;
  qtdUsada: number;
  cid: string;
  obs: string;
  status: 'Ativa' | 'Vencida' | 'Usada' | 'Cancelada';
  procs: ProcedimentoSenha[];
  ativa: boolean;
  procedimento?: string | null;   // codigo direto do procedimento
  agendamentoId?: number | null;  // id do agendamento vinculado
}

export interface ListaEspera {
  id: number;
  nome: string;
  tel: string;
  email: string;
  nasc: string;
  end: string;
  plano: string;
  carteirinha: string;
  especialidade?: string;
  idade?: string;
  periodo?: string;
  obs: string;
  dias: string[];
  periodos: string[];
  procedimentos: string[];
  status: 'Aguardando' | 'Convertido' | 'Cancelado';
  dataEntrada: string;
  dataCadastro?: string;
}

export interface Historico {
  id: number;
  pacId: number;
  tipo: 'evolucao' | 'anamnese' | 'agendamento';
  titulo: string;
  conteudo: {
    texto?: string;
    obs?: string;
    status?: string;
    hora?: string;
    profId?: number;
    [key: string]: any;
  };
  profId?: number | null;
  data: string;
  status: string;
  fonte: string;
}

export interface ClinicaConfig {
  nome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
  codPrestador: string;
  cnes: string;
  logo?: string;
  theme?: string;
  canalNotif?: 'whatsapp' | 'chat';
  waMethod?: 'link' | 'api';
  evoUrl?: string;
  evoKey?: string;
  evoInstance?: string;
  evoPhone?: string;
  templates?: { id: string; name: string; body: string }[];
  [key: string]: any;
}

export interface FechamentoMensal {
  id?: number;
  competencia: string;
  totalSessoes: number;
  totalValor: number;
  totalProfissionais: number;
  detalhes: any;
  confirmadoPor: string;
  confirmadoEm: string;
}

export interface PagamentoTerapeuta {
  id: string;
  profissionalId: number | null;
  profissional: string;
  competencia: string;
  tipo: 'sessao' | 'devolutiva' | 'avaliacao' | 'particular' | 'desconto_mes_anterior' | 'adicional_mes_anterior' | 'ajuste';
  qtdPacientes: number;
  valor: number;
  status: 'pendente' | 'pago';
  valorPago: number;
  dataPagamento: string;
  nfUrl: string;
  nfNome: string;
  obs: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface ControleMeses {
  id: string;
  anoMes: string;
  status: 'aberto' | 'fechado';
  obs: string;
  alteradoPor: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Feriado {
  data: string;
  desc: string;
}

export interface PerfilAcesso {
  id: string;
  nome: string;
  desc: string;
  cor: string;
  bloqueado: boolean;
  modulos: string[];
  subPerms: { [modulo: string]: string[] };
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  rg: string;
  tel: string;
  nasc: string;
  perfil: string;
  perfilId?: string | null;
  status: 'Ativo' | 'Inativo';
  foto: string;
  senha?: string;
  profId?: number | null;
  criadoEm?: string;
}

export interface StatusAgendamento {
  id?: number;
  nome: string;
  cor: string;
  statusAgendamento: 'agendado' | 'confirmado' | 'atendido' | 'desmarcado' | 'cancelado';
  statusHistorico?: string;
  createdAt?: string;
}

export interface NotaFiscalJundiai {
  id: string;
  numeroRps: string;
  numeroLote?: number;
  numeroNota?: string;
  codigoVerificacao?: string;
  dataEmissao: string;
  pacienteId?: number | null;
  tomadorNome: string;
  tomadorCpfCnpj: string;
  tomadorEmail: string;
  tomadorEndereco: string;
  servicoCodigo: string;
  descricaoServico: string;
  valorServico: number;
  aliquotaIss: number;
  valorIss: number;
  // Reforma Tributária (IBS / CBS)
  cstIbsCbs?: string;
  cClassTribIbsCbs?: string;
  aliquotaIbs?: number;
  valorIbs?: number;
  aliquotaCbs?: number;
  valorCbs?: number;
  reducaoBaseIbsCbs?: number;
  status: 'Rascunho' | 'Processando' | 'Aprovada' | 'Cancelada' | 'Rejeitada';
  motivoRejeicao?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  xmlEnvio?: string;
  xmlResposta?: string;
  ambiente: 'Homologação' | 'Produção';
  created_at?: string;
}

export interface ConfiguracaoFiscalJundiai {
  cnpjEmissor: string;
  inscricaoMunicipal: string;
  razaoSocial: string;
  ambiente: 'Homologação' | 'Produção';
  codigoServicoPadrao: string;
  aliquotaIssPadrao: number;
  optanteSimplesNacional: boolean;
  serieRps?: string;
  proximoNumeroRps?: number;
  proximoNumeroLote?: number;
  regimeTributario?: '1' | '2' | '3' | '5' | '6';
  certificadoNomeArquivo?: string;
  certificadoBase64?: string;
  certificadoSenha?: string;
  destacarIbsCbs?: boolean;
  aliquotaIbsPadrao?: number;
  aliquotaCbsPadrao?: number;
  reducaoSaudeIbsCbs?: number;
  tokenApi?: string;
  certificadoValidade?: string;
}

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: 'Receita' | 'Despesa';
  cor: string;
  icone?: string;
}

export interface ContaReceber {
  id: string;
  pacienteId?: number | null;
  pacienteNome: string;
  descricao: string;
  valor: number;
  valorRecebido?: number;
  dataVencimento: string;
  dataRecebimento?: string;
  status: 'Pendente' | 'Recebido' | 'Atrasado' | 'Cancelado';
  formaPagamento: 'PIX' | 'Cartao_Credito' | 'Cartao_Debito' | 'Boleto' | 'Dinheiro' | 'Convenio';
  categoriaId?: string;
  categoriaNome?: string;
  observacoes?: string;
  notaFiscalId?: string;
  created_at?: string;
}

export interface ContaPagar {
  id: string;
  fornecedorNome: string;
  profId?: number | null;
  descricao: string;
  valor: number;
  valorPago?: number;
  dataVencimento: string;
  dataPagamento?: string;
  status: 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado';
  formaPagamento: 'PIX' | 'Transferencia' | 'Boleto' | 'Cartao' | 'Dinheiro';
  categoriaId?: string;
  categoriaNome?: string;
  comprovanteUrl?: string;
  observacoes?: string;
  created_at?: string;
}

export interface ResumoFluxoCaixa {
  saldoAtual: number;
  totalReceberMes: number;
  totalPagarMes: number;
  resultadoLiquido: number;
  taxaInadimplencia: number;
  entradasRecebidas: number;
  saidasPagas: number;
}


