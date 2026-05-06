-- Sistema de Movilización y Control de Minerales No Metálicos
-- Estado La Guaira - Base de Datos PostgreSQL

-- Crear extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Empresas (Canteras)
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rif VARCHAR(20) UNIQUE NOT NULL,
    razon_social VARCHAR(255) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(100),
    representante_legal VARCHAR(255),
    logo_url TEXT, -- Agregado para Supabase Storage
    codigo_letra VARCHAR(10) DEFAULT '', -- Prefijo para guías
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Empresas Destinatarias
CREATE TABLE IF NOT EXISTS empresas_destinatarias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rif VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(100),
    contacto_principal VARCHAR(255),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('empresa', 'master', 'empresa_destinataria')),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    empresa_destinataria_id UUID REFERENCES empresas_destinatarias(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_role_check CHECK (
        (role = 'master' AND empresa_id IS NULL AND empresa_destinataria_id IS NULL) OR
        (role = 'empresa' AND empresa_id IS NOT NULL AND empresa_destinataria_id IS NULL) OR
        (role = 'empresa_destinataria' AND empresa_id IS NULL AND empresa_destinataria_id IS NOT NULL)
    )
);

-- Tabla de Guías de Movilización
CREATE TABLE IF NOT EXISTS guias_movilizacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_guia SERIAL,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
    tipo_mineral VARCHAR(100) NOT NULL,
    cantidad DECIMAL(10, 2) NOT NULL,
    unidad VARCHAR(20) DEFAULT 'toneladas',
    materiales JSONB, -- Agregado soporte multi-material
    origen TEXT NOT NULL,
    destino TEXT NOT NULL,
    vehiculo_placa VARCHAR(20) NOT NULL,
    vehiculo_marca VARCHAR(100), -- Agregado
    vehiculo_modelo VARCHAR(100), -- Agregado
    vehiculo_color VARCHAR(50), -- Agregado
    vehiculo_carroceria VARCHAR(100), -- Agregado
    conductor_nombre VARCHAR(255) NOT NULL,
    conductor_cedula VARCHAR(20) NOT NULL,
    monto_pagar DECIMAL(12, 2) NOT NULL,
    monto_usd DECIMAL(12, 2), -- Agregado soporte divisas
    monto_recargo DECIMAL(12, 2) DEFAULT 0, -- Agregado
    tasa_bcv DECIMAL(12, 4), -- Agregado soporte divisas
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente_pago' CHECK (
        estado IN ('pendiente_pago', 'pago_pendiente_verificacion', 'activa', 'vencida', 'anulada', 'usada')
    ),
    hash_documento VARCHAR(64),
    qr_code_data TEXT,
    fecha_emision TIMESTAMP,
    fecha_vencimiento TIMESTAMP,
    fecha_uso TIMESTAMP,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Pagos
CREATE TABLE IF NOT EXISTS pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guia_id UUID NOT NULL REFERENCES guias_movilizacion(id) ON DELETE RESTRICT,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
    monto DECIMAL(12, 2) NOT NULL,
    banco VARCHAR(100),
    numero_referencia VARCHAR(50),
    fecha_pago DATE,
    comprobante_url TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (
        estado IN ('pendiente', 'verificado', 'rechazado')
    ),
    verificado_por UUID REFERENCES usuarios(id),
    fecha_verificacion TIMESTAMP,
    notas_rechazo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Confirmaciones de Llegada
CREATE TABLE IF NOT EXISTS confirmaciones_llegada (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guia_id UUID NOT NULL REFERENCES guias_movilizacion(id) ON DELETE RESTRICT,
    empresa_destinataria_id UUID NOT NULL REFERENCES empresas_destinatarias(id) ON DELETE RESTRICT,
    usuario_confirma_id UUID REFERENCES usuarios(id),
    hora_llegada TIMESTAMP,
    nombre_empresa_confirmante VARCHAR(255),
    codigo_guia VARCHAR(50),
    mineral_recibido VARCHAR(255),
    foto_guia_url TEXT,
    foto_filename VARCHAR(255),
    foto_size_bytes BIGINT,
    foto_mime_type VARCHAR(50),
    foto_validada BOOLEAN DEFAULT false,
    validacion_resultado JSONB,
    validacion_confianza INTEGER,
    texto_extraido TEXT,
    coincidencia_numero_guia BOOLEAN,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Historial de Tracking
CREATE TABLE IF NOT EXISTS tracking_historial (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guia_id UUID NOT NULL REFERENCES guias_movilizacion(id) ON DELETE CASCADE,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    velocidad DECIMAL(10, 2),
    precision DECIMAL(10, 2),
    reportado_por VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Configuración del Sistema
CREATE TABLE IF NOT EXISTS config_sistema (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Auditoría
CREATE TABLE IF NOT EXISTS auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(50) NOT NULL,
    tabla_afectada VARCHAR(50),
    registro_id UUID,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_guias_empresa ON guias_movilizacion(empresa_id);
CREATE INDEX IF NOT EXISTS idx_guias_estado ON guias_movilizacion(estado);
CREATE INDEX IF NOT EXISTS idx_guias_fecha_emision ON guias_movilizacion(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_pagos_guia ON pagos(guia_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);
CREATE INDEX IF NOT EXISTS idx_tracking_guia ON tracking_historial(guia_id);
CREATE INDEX IF NOT EXISTS idx_confirmaciones_guia ON confirmaciones_llegada(guia_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_empresas_updated_at ON empresas;
CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON empresas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_empresas_dest_updated_at ON empresas_destinatarias;
CREATE TRIGGER update_empresas_dest_updated_at BEFORE UPDATE ON empresas_destinatarias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_guias_updated_at ON guias_movilizacion;
CREATE TRIGGER update_guias_updated_at BEFORE UPDATE ON guias_movilizacion
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pagos_updated_at ON pagos;
CREATE TRIGGER update_pagos_updated_at BEFORE UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Datos iniciales
INSERT INTO usuarios (username, password_hash, role, empresa_id) VALUES
('admin', '$2b$12$FHL/8aLTna7sNa1I6MqZy.jZf6uv43AlMrD87fNiNOrsk2fboBveq', 'master', NULL)
ON CONFLICT (username) DO NOTHING;

INSERT INTO config_sistema (clave, valor) VALUES 
('tasa_bcv', '36.50')
ON CONFLICT (clave) DO NOTHING;

-- Datos de ejemplo
INSERT INTO empresas (rif, razon_social, direccion, telefono, email, representante_legal) VALUES
('J-12345678-9', 'Cantera El Progreso C.A.', 'Sector La Montaña, La Guaira', '0212-1234567', 'info@canteraprogreso.com', 'Juan Pérez')
ON CONFLICT (rif) DO NOTHING;

INSERT INTO empresas_destinatarias (rif, nombre, direccion, contacto_principal) VALUES
('J-98765432-1', 'Constructora Puerto Seco', 'Zona Industrial, Catia La Mar', 'Pedro Jiménez')
ON CONFLICT (rif) DO NOTHING;

-- Usuarios de prueba
INSERT INTO usuarios (username, password_hash, role, empresa_id) 
SELECT 'canteraprogreso', '$2b$12$wcV17OjON2lg51zPfk/uz.7mC1tEJ7Jwqh/tR5R3qZMfjrdd3rwGO', 'empresa', id 
FROM empresas WHERE rif = 'J-12345678-9'
ON CONFLICT (username) DO NOTHING;

INSERT INTO usuarios (username, password_hash, role, empresa_destinataria_id)
SELECT 'puertoseco', '$2b$12$wcV17OjON2lg51zPfk/uz.7mC1tEJ7Jwqh/tR5R3qZMfjrdd3rwGO', 'empresa_destinataria', id
FROM empresas_destinatarias WHERE rif = 'J-98765432-1'
ON CONFLICT (username) DO NOTHING;

COMMENT ON TABLE empresas IS 'Registro de empresas mineras (canteras) autorizadas';
COMMENT ON TABLE empresas_destinatarias IS 'Registro de empresas que reciben el mineral';
COMMENT ON TABLE usuarios IS 'Usuarios del sistema con roles empresa, master o empresa_destinataria';
COMMENT ON TABLE guias_movilizacion IS 'Guías de movilización de minerales con seguridad antifalsificación';
COMMENT ON TABLE pagos IS 'Registro de pagos y comprobantes asociados a guías';
COMMENT ON TABLE confirmaciones_llegada IS 'Registro de llegada de mineral confirmado por la empresa de destino';
COMMENT ON TABLE tracking_historial IS 'Historial de ubicaciones GPS de las guías en ruta';
COMMENT ON TABLE config_sistema IS 'Configuración global del sistema (tasa BCV, etc.)';
COMMENT ON TABLE auditoria IS 'Registro de auditoría de todas las acciones del sistema';
