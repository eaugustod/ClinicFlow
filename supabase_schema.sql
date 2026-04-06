-- ============================================================
-- ClinicFlow — Schema Supabase
-- Execute este SQL no editor do seu projeto Supabase
-- Dashboard → SQL Editor → New Query → colar e executar
-- ============================================================

-- Profissionais
create table if not exists profissionais (
  id bigserial primary key,
  nome text not null,
  nome_agenda text,
  esp text,
  conselho text,
  num text,
  uf text default 'SP',
  cbo text,
  cor text default '#4f8ef7',
  status text default 'Ativo',
  tel text,
  email text,
  instagram text,
  linkedin text,
  google_cal_id text,
  created_at timestamptz default now()
);

-- Pacientes
create table if not exists pacientes (
  id bigserial primary key,
  nome text not null,
  nasc text,
  cpf text,
  tel text,
  email text,
  "end" text,
  plano_id bigint default 5,
  plano text default 'Particular',
  carteirinha text,
  sexo text,
  status text default 'Ativo',
  obs text,
  ultima text,
  est_civil text,
  profissao text,
  titular text,
  created_at timestamptz default now()
);

-- Planos de Saúde
create table if not exists planos_saude (
  id bigserial primary key,
  nome text not null,
  nome_guia text,
  cnpj text,
  ans text,
  tabela text default 'CBHPM',
  cod_prestador text,
  nome_contratado text,
  cnes text,
  num_guia_inicial int default 1,
  usa_tiss boolean default true,
  aplica_todos boolean default true,
  tipo_id text default 'Código',
  versao_tiss text default '4.02.00',
  tel text,
  email text,
  obs text,
  status text default 'Ativo',
  pacientes int default 0,
  juntar_guia boolean default true,
  nome_plano_guia text,
  created_at timestamptz default now()
);

-- Procedimentos / Tabela de Preços
create table if not exists procedimentos (
  id bigserial primary key,
  codigo text,
  desc text not null,
  desc_curta text,
  tipo text default 'Sessão',
  val_part numeric(10,2) default 0,
  val_plano numeric(10,2) default 0,
  tabela text default 'TUSS',
  plano_id bigint default 0,
  status text default 'Ativo',
  obs text,
  created_at timestamptz default now()
);

-- Agendamentos
create table if not exists agendamentos (
  id bigserial primary key,
  prof_id bigint,
  paciente text not null,
  plano text default 'Particular',
  plano_id bigint default 5,
  hora text,
  hora_fim text,
  dur_min int default 30,
  data_iso text,
  status text default 'agendado',
  obs text,
  modalidade text default 'presencial',
  meet_link text,
  wa_sent boolean default false,
  carteirinha text,
  guia jsonb,
  created_at timestamptz default now()
);

-- Guias SADT
create table if not exists guias_sadt (
  id bigserial primary key,
  num text,
  pac text not null,
  plano_id bigint,
  plano text,
  prof_id bigint,
  valor numeric(10,2) default 0,
  status text default 'Pendente',
  data text,
  lote_id bigint,
  lote_num text,
  dados jsonb,
  carteirinha text,
  num_op text,
  cid text,
  created_at timestamptz default now()
);

-- Lotes TISS
create table if not exists lotes_tiss (
  id bigserial primary key,
  num text,
  competencia text,
  plano_id bigint,
  plano text,
  qtd int default 0,
  valor numeric(10,2) default 0,
  status text default 'Pendente',
  data_criacao text,
  data_envio text,
  obs text,
  guia_ids bigint[] default '{}',
  created_at timestamptz default now()
);

-- Senhas / Autorizações
create table if not exists senhas_plano (
  id bigserial primary key,
  plano_id bigint,
  paciente text not null,
  carteirinha text,
  num_guia_op text,
  num_senha text not null,
  data_aut text,
  validade text,
  qtd_autorizada int default 10,
  qtd_usada int default 0,
  cid text,
  obs text,
  status text default 'Ativa',
  procs jsonb,
  ativa boolean default true,
  created_at timestamptz default now()
);

-- Lista de Espera
create table if not exists lista_espera (
  id bigserial primary key,
  nome text not null,
  tel text,
  email text,
  nasc text,
  "end" text,
  plano text,
  carteirinha text,
  obs text,
  dias text[] default '{}',
  periodos text[] default '{}',
  procedimentos text[] default '{}',
  status text default 'Aguardando',
  data_entrada text,
  created_at timestamptz default now()
);

-- Histórico / Prontuário (evoluções, anamneses)
create table if not exists historico (
  id bigserial primary key,
  pac_id bigint,
  tipo text,  -- 'evolucao' | 'anamnese' | 'agendamento'
  titulo text,
  conteudo jsonb,
  prof_id bigint,
  data text,
  status text,
  fonte text,
  created_at timestamptz default now()
);

-- Configuração da Clínica
create table if not exists config_clinica (
  id bigserial primary key,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS) — opcional mas recomendado
-- Desabilite o RLS para uso simples com anon key ou configure
-- políticas de acordo com sua necessidade de segurança.
-- ============================================================
-- alter table pacientes enable row level security;
-- create policy "allow all" on pacientes for all using (true);
-- (repita para cada tabela se necessário)