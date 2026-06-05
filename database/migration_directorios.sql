-- Migración: Crear Tablas para los Directorios de las Canteras

-- 1. Tabla de Clientes Guardados por Cantera
CREATE TABLE IF NOT EXISTS cantera_clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    rif VARCHAR(20) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    direccion TEXT NOT NULL,
    telefono VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_empresa_rif UNIQUE (empresa_id, rif)
);

-- 2. Tabla de Choferes Guardados por Cantera
CREATE TABLE IF NOT EXISTS cantera_choferes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cedula VARCHAR(20) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_empresa_cedula UNIQUE (empresa_id, cedula)
);

-- 3. Tabla de Vehículos Guardados por Cantera
CREATE TABLE IF NOT EXISTS cantera_vehiculos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    placa VARCHAR(20) NOT NULL,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    color VARCHAR(50) NOT NULL,
    carroceria VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_empresa_placa UNIQUE (empresa_id, placa)
);

-- Índices de búsqueda para optimizar rendimiento por empresa
CREATE INDEX IF NOT EXISTS idx_cantera_clientes_empresa ON cantera_clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cantera_choferes_empresa ON cantera_choferes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cantera_vehiculos_empresa ON cantera_vehiculos(empresa_id);

-- Comentarios explicativos
COMMENT ON TABLE cantera_clientes IS 'Clientes guardados de manera personalizada por cada empresa (cantera)';
COMMENT ON TABLE cantera_choferes IS 'Choferes/conductores guardados por cada empresa (cantera)';
COMMENT ON TABLE cantera_vehiculos IS 'Vehículos/camiones guardados por cada empresa (cantera)';
