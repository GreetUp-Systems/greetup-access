-- Script de inicialização do banco de dados
-- Executado automaticamente pelo Docker na primeira inicialização

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- busca textual
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- índices compostos

-- Configuração de timezone
SET timezone = 'UTC';

-- Função helper para updated_at automático
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
