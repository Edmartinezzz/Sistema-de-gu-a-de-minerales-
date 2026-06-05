const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole, checkEmpresaAccess } = require('../middleware/auth');
const { generateUUID, generateHash, sanitizeInput, formatNumeroGuia, truncateIP, generateVerificationCode } = require('../utils/security');
const { generateGuiaPDF } = require('../services/pdfGenerator');
const { generateQRCode } = require('../services/qrGenerator');
const currencyService = require('../services/currencyService');
const { uploadFile, supabase } = require('../services/supabaseService');

const router = express.Router();

/**
 * POST /api/guias/solicitar
 * Solicitar una nueva guía de movilización (solo empresas)
 */
router.post('/solicitar', authenticateToken, requireRole(['empresa', 'contribuyente']), async (req, res) => {
    const client = await db.pool.connect();

    try {
        const {
            materiales, // Array de objetos: { nombre, cantidad, unidad }
            origen,
            destino,
            vehiculo_placa,
            vehiculo_marca,
            vehiculo_modelo,
            vehiculo_color,
            vehiculo_carroceria,
            conductor_nombre,
            conductor_cedula,
            cliente_nombre,
            cliente_rif,
            cliente_direccion,
            observaciones,
            guardar_cliente_dir,
            guardar_conductor_dir,
            guardar_vehiculo_dir
        } = req.body;
        
        // Obtener tasa actual y configuración de pagos
        const [tasa_bcv, configResult] = await Promise.all([
            currencyService.getCurrentRate(),
            client.query("SELECT valor FROM config_sistema WHERE clave = 'modulo_pagos_habilitado'")
        ]);

        const moduloPagosHabilitado = configResult.rows.length > 0 ? configResult.rows[0].valor === 'true' : true;

        // Validaciones
        if (!materiales || !Array.isArray(materiales) || materiales.length === 0 ||
            !origen || !destino || !vehiculo_placa ||
            !vehiculo_marca || !vehiculo_modelo || !vehiculo_color || !vehiculo_carroceria ||
            !conductor_nombre || !conductor_cedula) {
            return res.status(400).json({
                error: 'Datos incompletos. Debe incluir al menos un material y todos los datos del vehículo/conductor.'
            });
        }

        await client.query('BEGIN');

        let total_venta_usd = 0;
        materiales.forEach(m => {
            const precioParsed = parseFloat(m.precio_unitario);
            const precio = isNaN(precioParsed) ? 0 : precioParsed;
            total_venta_usd += parseFloat(m.cantidad) * precio;
        });

        // Solo calcular montos si el módulo de pagos está habilitado
        let monto_total_usd = 0;
        let monto_total_pagar_bs = 0;

        if (moduloPagosHabilitado) {
            monto_total_usd = total_venta_usd * 0.025; // Impuesto de la guía (2.5%)
            monto_total_pagar_bs = monto_total_usd * tasa_bcv;
        } else {
            // Si está deshabilitado, los montos son 0
            total_venta_usd = 0;
        }

        // Para mantener compatibilidad con guias antiguas y scripts, guardamos el primer material en los campos legacy
        const mainMaterial = materiales[0];

        // Guardamos las observaciones del usuario tal cual
        const obsConPrecio = observaciones || '';

        // Generar UUID para la guía
        const guiaId = generateUUID();
        const verificationHash = generateVerificationCode(guiaId);
        const qrData = `${process.env.BASE_URL}/verificar/${guiaId}?v=${verificationHash}`;

        const fechaEmision = new Date();
        const fechaVencimiento = new Date();
        fechaVencimiento.setDate(fechaEmision.getDate() + 30);

        // OBTENER SIGUIENTE NÚMERO DE GUÍA PARA ESTA EMPRESA ESPECÍFICA
        const nextNumResult = await client.query(
            'SELECT COALESCE(MAX(numero_guia), 0) + 1 as next_num FROM guias_movilizacion WHERE empresa_id = $1',
            [req.user.empresaId]
        );
        const numeroGuia = nextNumResult.rows[0].next_num;

        // Insertar guía con todos los campos del vehículo y materiales JSONB
        const guiaResult = await client.query(
            `INSERT INTO guias_movilizacion 
             (id, empresa_id, numero_guia, tipo_mineral, cantidad, unidad, origen, destino, 
              vehiculo_placa, vehiculo_marca, vehiculo_modelo, vehiculo_color, vehiculo_carroceria,
              conductor_nombre, conductor_cedula, cliente_nombre, cliente_rif, cliente_direccion,
              monto_pagar, estado, qr_code_data, observaciones, materiales, monto_usd, tasa_bcv,
              fecha_emision, fecha_vencimiento, hash_documento)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
             RETURNING id, numero_guia, created_at, fecha_emision, fecha_vencimiento, qr_code_data, hash_documento`,
            [
                guiaId,
                req.user.empresaId,
                numeroGuia,
                sanitizeInput(mainMaterial.nombre),
                mainMaterial.cantidad,
                mainMaterial.unidad || 'toneladas',
                sanitizeInput(origen),
                sanitizeInput(destino),
                sanitizeInput(vehiculo_placa).toUpperCase(),
                sanitizeInput(vehiculo_marca),
                sanitizeInput(vehiculo_modelo),
                sanitizeInput(vehiculo_color),
                sanitizeInput(vehiculo_carroceria),
                sanitizeInput(conductor_nombre),
                sanitizeInput(conductor_cedula),
                sanitizeInput(cliente_nombre),
                sanitizeInput(cliente_rif),
                sanitizeInput(cliente_direccion),
                monto_total_pagar_bs, 
                'activa',
                qrData,
                sanitizeInput(obsConPrecio),
                JSON.stringify(materiales),
                total_venta_usd,
                tasa_bcv,
                fechaEmision,
                fechaVencimiento,
                verificationHash
            ]
        );

        const guia = guiaResult.rows[0];

        await client.query(
            `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.id, 'crear_guia', 'guias_movilizacion', guia.id,
            JSON.stringify({ numero_guia: guia.numero_guia, materiales_count: materiales.length, monto_pagar: monto_total_pagar_bs }), truncateIP(req.ip)]
        );

        // Inserción automática en los directorios si se solicita
        if (guardar_cliente_dir === true || guardar_cliente_dir === 'true') {
            await client.query(
                `INSERT INTO cantera_clientes (empresa_id, rif, nombre, direccion)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (empresa_id, rif) 
                 DO UPDATE SET nombre = EXCLUDED.nombre, direccion = EXCLUDED.direccion`,
                [req.user.empresaId, sanitizeInput(cliente_rif).trim().toUpperCase(), sanitizeInput(cliente_nombre).trim(), sanitizeInput(cliente_direccion).trim()]
            );
        }

        if (guardar_conductor_dir === true || guardar_conductor_dir === 'true') {
            await client.query(
                `INSERT INTO cantera_choferes (empresa_id, cedula, nombre)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (empresa_id, cedula) 
                 DO UPDATE SET nombre = EXCLUDED.nombre`,
                [req.user.empresaId, sanitizeInput(conductor_cedula).trim().toUpperCase(), sanitizeInput(conductor_nombre).trim()]
            );
        }

        if (guardar_vehiculo_dir === true || guardar_vehiculo_dir === 'true') {
            await client.query(
                `INSERT INTO cantera_vehiculos (empresa_id, placa, marca, modelo, color, carroceria)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (empresa_id, placa) 
                 DO UPDATE SET marca = EXCLUDED.marca, modelo = EXCLUDED.modelo, color = EXCLUDED.color, carroceria = EXCLUDED.carroceria`,
                [
                    req.user.empresaId, 
                    sanitizeInput(vehiculo_placa).trim().toUpperCase(), 
                    sanitizeInput(vehiculo_marca).trim(), 
                    sanitizeInput(vehiculo_modelo).trim(), 
                    sanitizeInput(vehiculo_color).trim(), 
                    sanitizeInput(vehiculo_carroceria).trim()
                ]
            );
        }

        await client.query('COMMIT');

        // Cargar datos frescos de la empresa para la generación del PDF (Evita tokens antiguos que no tengan codigo_letra)
        let companyData = { razon_social: '', rif: '', codigo_letra: '' };
        if (req.user.empresaId) {
            const resultEmpresa = await db.query('SELECT razon_social, rif, codigo_letra FROM empresas WHERE id = $1', [req.user.empresaId]);
            if(resultEmpresa.rows.length > 0) {
               companyData = resultEmpresa.rows[0];
            }
        }

        // GENERAR PDF Y SUBIR A SUPABASE (Post-Commit para no bloquear la DB)
        try {
            const pdfBuffer = await generateGuiaPDF({
                ...guia,
                numero_guia: formatNumeroGuia(guia.numero_guia, companyData.codigo_letra),
                empresa_nombre: companyData.razon_social, 
                empresa_rif: companyData.rif,     
                codigo_letra: companyData.codigo_letra,
                materiales,
                origen,
                destino,
                vehiculo_placa,
                vehiculo_marca,
                vehiculo_modelo,
                vehiculo_color,
                vehiculo_carroceria,
                cliente_nombre,
                cliente_rif,
                cliente_direccion,
                conductor_nombre,
                conductor_cedula,
                monto_total_usd, // Valor comercial total
                monto_pagar: monto_total_pagar_bs, // Impuesto a pagar
                tasa_bcv
            });

            const pdfFileName = `guias/${guia.id}.pdf`;
            const { error: uploadError } = await supabase.storage
                .from(process.env.SUPABASE_BUCKET || 'minerales-assets')
                .upload(pdfFileName, pdfBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) {
                console.error('Error al subir PDF a Supabase:', uploadError);
                return res.status(201).json({
                    success: true,
                    message: 'Guía solicitada, pero hubo un error al guardar el PDF.',
                    details: uploadError.message,
                    guia: {
                        id: guia.id,
                        numero_guia: formatNumeroGuia(guia.numero_guia),
                        monto_pagar: monto_total_pagar_bs,
                        tasa_bcv: tasa_bcv,
                        estado: 'activa'
                    }
                });
            }
        } catch (pdfError) {
            console.error('Error crítico en generación/subida de PDF:', pdfError);
        }

        res.status(201).json({
            success: true,
            message: 'Guía solicitada exitosamente.',
            guia: {
                id: guia.id,
                numero_guia: formatNumeroGuia(guia.numero_guia),
                monto_pagar: monto_total_pagar_bs,
                tasa_bcv: tasa_bcv,
                banco: 'Banco de Venezuela',
                cuenta: '0102-1234-5678-9012-3456',
                estado: 'activa'
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al solicitar guía:', error);
        res.status(500).json({
            error: 'Error al procesar la solicitud.'
        });
    } finally {
        client.release();
    }
});

/**
 * POST /api/guias/previsualizar
 * Permite previsualizar el PDF de la guía antes de confirmar su solicitud e inserción
 */
router.post('/previsualizar', authenticateToken, requireRole(['empresa', 'contribuyente', 'master']), async (req, res) => {
    try {
        console.log('--- INICIO PREVISUALIZACIÓN ---');
        const {
            materiales, origen, destino, vehiculo_placa, vehiculo_marca, vehiculo_modelo,
            vehiculo_color, vehiculo_carroceria, conductor_nombre, conductor_cedula,
            cliente_nombre, cliente_rif, cliente_direccion, observaciones
        } = req.body;
        
        // Obtener tasa actual y configuración de pagos
        const [tasa_bcv, configResult] = await Promise.all([
            currencyService.getCurrentRate(),
            db.query("SELECT valor FROM config_sistema WHERE clave = 'modulo_pagos_habilitado'")
        ]);

        const moduloPagosHabilitado = configResult.rows.length > 0 ? configResult.rows[0].valor === 'true' : true;

        if (!materiales || !Array.isArray(materiales) || materiales.length === 0 ||
            !origen || !destino || !vehiculo_placa || !conductor_nombre || !conductor_cedula) {
            console.error('Datos incompletos para preview:', { materiales: !!materiales, origen, destino, vehiculo_placa });
            return res.status(400).json({ error: 'Datos incompletos para previsualización (Origen, Destino, Placa y Conductor son obligatorios).' });
        }


        let total_venta_usd = 0;
        materiales.forEach(m => {
            const precioParsed = parseFloat(m.precio_unitario);
            const precio = isNaN(precioParsed) ? 0 : precioParsed;
            total_venta_usd += parseFloat(m.cantidad) * precio;
        });

        let monto_total_usd = 0;
        let monto_total_pagar_bs = 0;

        if (moduloPagosHabilitado) {
            monto_total_usd = total_venta_usd * 0.025; 
            monto_total_pagar_bs = monto_total_usd * tasa_bcv;
        }

        const guiaId = 'PREVIEW-0000-0000-0000-000000000000';
        const verificationHash = 'preview_hash';
        const qrData = `${process.env.BASE_URL}/verificar/${guiaId}?v=${verificationHash}`;
        
        const fechaEmision = new Date();
        const fechaVencimiento = new Date();
        fechaVencimiento.setDate(fechaEmision.getDate() + 30);

        let companyData = { razon_social: '', rif: '', codigo_letra: '' };
        if (req.user.empresaId) {
            const resultEmpresa = await db.query('SELECT razon_social, rif, codigo_letra FROM empresas WHERE id = $1', [req.user.empresaId]);
            if(resultEmpresa.rows.length > 0) {
               companyData = resultEmpresa.rows[0];
            }
        }
        
        // Asignamos un número temporal o el número siguiente estimado
        const nextNumResult = await db.query(
            'SELECT COALESCE(MAX(numero_guia), 0) + 1 as next_num FROM guias_movilizacion WHERE empresa_id = $1',
            [req.user.empresaId]
        );
        const numeroGuia = nextNumResult.rows[0].next_num;

        const pdfBuffer = await generateGuiaPDF({
            id: guiaId,
            numero_guia: formatNumeroGuia(numeroGuia, companyData.codigo_letra),
            empresa_nombre: companyData.razon_social, 
            empresa_rif: companyData.rif,     
            codigo_letra: companyData.codigo_letra,
            materiales,
            origen,
            destino,
            vehiculo_placa: sanitizeInput(vehiculo_placa).toUpperCase(),
            vehiculo_marca: sanitizeInput(vehiculo_marca),
            vehiculo_modelo: sanitizeInput(vehiculo_modelo),
            vehiculo_color: sanitizeInput(vehiculo_color),
            vehiculo_carroceria: sanitizeInput(vehiculo_carroceria),
            cliente_nombre: sanitizeInput(cliente_nombre),
            cliente_rif: sanitizeInput(cliente_rif),
            cliente_direccion: sanitizeInput(cliente_direccion),
            conductor_nombre: sanitizeInput(conductor_nombre),
            conductor_cedula: sanitizeInput(conductor_cedula),
            monto_total_usd,
            monto_pagar: monto_total_pagar_bs,
            tasa_bcv,
            fecha_emision: fechaEmision,
            fecha_vencimiento: fechaVencimiento,
            hash_documento: verificationHash,
            qr_code_data: qrData,
            observaciones: sanitizeInput(observaciones || '')
        });

        res.contentType('application/pdf');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error al generar previsualización:', error);
        res.status(500).json({ error: 'Error al procesar la previsualización.' });
    }
});

/**
 * GET /api/guias
 * Listar guías (filtradas por empresa si no es master)
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { estado, desde, hasta, empresa_id, limit = 500 } = req.query;

        let query = `
            SELECT g.*, e.razon_social as empresa_nombre, e.rif as empresa_rif, e.codigo_letra
            FROM guias_movilizacion g
            JOIN empresas e ON g.empresa_id = e.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        // Filtrar por empresa si no es master
        if (req.user.role !== 'master') {
            query += ` AND g.empresa_id = $${paramCount}`;
            params.push(req.user.empresaId);
            paramCount++;
        } else if (empresa_id) {
            // Si es master y se proporcionó empresa_id, filtrar por ella
            query += ` AND g.empresa_id = $${paramCount}`;
            params.push(empresa_id);
            paramCount++;
        }

        // Filtrar por estado
        if (estado) {
            query += ` AND g.estado = $${paramCount}`;
            params.push(estado);
            paramCount++;
        }

        // Filtrar por fecha
        if (desde) {
            query += ` AND g.created_at >= $${paramCount}`;
            params.push(desde);
            paramCount++;
        }

        if (hasta) {
            query += ` AND g.created_at <= $${paramCount}::timestamp + interval '1 day' - interval '1 second'`;
            params.push(hasta);
            paramCount++;
        }

        query += ` ORDER BY g.created_at DESC LIMIT $${paramCount}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);

        // Verificar si el módulo de pagos está habilitado
        const configResult = await db.query("SELECT valor FROM config_sistema WHERE clave = 'modulo_pagos_habilitado'");
        const moduloPagosHabilitado = configResult.rows.length > 0 ? configResult.rows[0].valor === 'true' : true;

        // Formatear números de guía con # y calcular recargo dinámico
        const now = new Date();
        const guiasFormateadas = result.rows.map(guia => {
            let recargo = 0;
            // Solo calcular recargo si el módulo está habilitado
            if (moduloPagosHabilitado) {
                if (guia.estado === 'activa' && !guia.recargo_aplicado) {
                    const createdDate = new Date(guia.created_at);
                    const diffMs = now - createdDate;
                    const diffHours = diffMs / (1000 * 60 * 60);

                    if (diffHours > 24) {
                        recargo = parseFloat(guia.monto_pagar) * 0.10;
                    }
                } else if (guia.monto_recargo) {
                    // Si ya se pagó/registró, usar el valor guardado en BD
                    recargo = parseFloat(guia.monto_recargo);
                }
            }

            return {
                ...guia,
                numero_guia: formatNumeroGuia(guia.numero_guia, guia.codigo_letra),
                recargo_mora: recargo,
                total_con_recargo: parseFloat(guia.monto_pagar) + recargo,
                // Si el módulo está deshabilitado, forzamos montos a mostrar como 0 para el UI
                monto_pagar: moduloPagosHabilitado ? guia.monto_pagar : 0,
                monto_pagado: moduloPagosHabilitado ? guia.monto_pagado : guia.monto_pagar // Simular saldado
            };
        });

        res.json({
            success: true,
            guias: guiasFormateadas
        });

    } catch (error) {
        console.error('Error al listar guías:', error);
        res.status(500).json({
            error: 'Error al obtener guías.'
        });
    }
});

/**
 * PUT /api/guias/:id/exonerar
 * Exonerar el pago de una guía (solo master)
 */
router.put('/:id/exonerar', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Obtener la guía para saber el total actual (incluyendo recargo si aplica)
        const guiaQuery = await db.query('SELECT * FROM guias_movilizacion WHERE id = $1', [id]);
        if (guiaQuery.rows.length === 0) {
            return res.status(404).json({ error: 'Guía no encontrada.' });
        }

        const guia = guiaQuery.rows[0];
        
        // Calcular recargo actual (igual que en GET /)
        let recargo = 0;
        if (guia.estado === 'activa' && !guia.recargo_aplicado) {
            const createdDate = new Date(guia.created_at);
            const diffHours = (new Date() - createdDate) / (1000 * 60 * 60);
            if (diffHours > 24) {
                recargo = parseFloat(guia.monto_pagar) * 0.10;
            }
        } else if (guia.monto_recargo) {
            recargo = parseFloat(guia.monto_recargo);
        }

        const totalRequerido = parseFloat(guia.monto_pagar) + recargo;

        // 2. Marcar como pagada totalmente (exonerada)
        await db.query(
            `UPDATE guias_movilizacion 
             SET monto_pagado = $1,
                 estado = 'activa',
                 observaciones = COALESCE(observaciones, '') || '\n[EXONERADA POR ADMIN]',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [totalRequerido, id]
        );

        // 3. Registrar en auditoría
        await db.query(
            `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'exonerar_guia', 'guias_movilizacion', id, JSON.stringify({ 
                monto_exonerado: totalRequerido - parseFloat(guia.monto_pagado || 0),
                numero_guia: guia.numero_guia 
            })]
        );

        res.json({
            success: true,
            message: 'Guía exonerada exitosamente.'
        });

    } catch (error) {
        console.error('Error al exonerar guía:', error);
        res.status(500).json({ error: 'Error al procesar exoneración.' });
    }
});

/**
 * GET /api/guias/deudas
 * Listar guías con deuda (pendientes de pago) y aplicar recargos si aplica
 */
router.get('/deudas', authenticateToken, async (req, res) => {
    // Verificar si el módulo de pagos está habilitado
    const configResult = await db.query("SELECT valor FROM config_sistema WHERE clave = 'modulo_pagos_habilitado'");
    const moduloPagosHabilitado = configResult.rows.length > 0 ? configResult.rows[0].valor === 'true' : true;

    if (!moduloPagosHabilitado) {
        return res.json({ success: true, deudas: [] });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Aplicar recargos del 10% a guías con más de 24h sin pagar
        // Filtramos por empresa si no es master para mayor eficiencia
        const recargoQuery = `
            UPDATE guias_movilizacion
            SET monto_recargo = monto_pagar * 0.10,
                recargo_aplicado = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE estado = 'activa'
              AND recargo_aplicado = false
              AND (COALESCE(monto_pagado, 0) < monto_pagar)
              AND created_at < NOW() - INTERVAL '24 hours'
              ${req.user.role !== 'master' ? 'AND empresa_id = $1' : ''}
        `;
        const recargoParams = req.user.role !== 'master' ? [req.user.empresaId] : [];
        await client.query(recargoQuery, recargoParams);

        await client.query('COMMIT');

        // 2. Obtener la lista de deudas
        let query = `
            SELECT g.*, e.razon_social as empresa_nombre, e.codigo_letra
            FROM guias_movilizacion g
            JOIN empresas e ON g.empresa_id = e.id
            WHERE g.estado = 'activa'
              AND (COALESCE(g.monto_pagado, 0) < (g.monto_pagar + COALESCE(g.monto_recargo, 0)))
        `;
        const params = [];

        if (req.user.role !== 'master') {
            query += ' AND g.empresa_id = $1';
            params.push(req.user.empresaId);
        }

        query += ' ORDER BY g.created_at DESC';

        const result = await client.query(query, params);

        res.json({
            success: true,
            deudas: result.rows.map(g => ({
                ...g,
                numero_guia: formatNumeroGuia(g.numero_guia, g.codigo_letra)
            }))
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al procesar deudas:', error);
        res.status(500).json({ error: 'Error al obtener deudas.' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/guias/:id
 * Obtener detalles de una guía específica
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        let query = `
            SELECT g.*, e.razon_social as empresa_razon_social, e.rif as empresa_rif,
                   e.direccion as empresa_direccion, e.telefono as empresa_telefono
            FROM guias_movilizacion g
            JOIN empresas e ON g.empresa_id = e.id
            WHERE g.id = $1
        `;
        const params = [id];

        // Si no es master, verificar que sea de su empresa
        if (req.user.role !== 'master') {
            query += ' AND g.empresa_id = $2';
            params.push(req.user.empresaId);
        }

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Guía no encontrada.'
            });
        }

        // Calcular recargo dinámico
        const now = new Date();
        let recargo = 0;
        const guiaData = result.rows[0];

        if (guiaData.estado === 'activa' && !guiaData.recargo_aplicado) {
            const createdDate = new Date(guiaData.created_at);
            const diffMs = now - createdDate;
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours > 24) {
                recargo = parseFloat(guiaData.monto_pagar) * 0.10;
            }
        } else if (guiaData.monto_recargo) {
            recargo = parseFloat(guiaData.monto_recargo);
        }

        // Formatear número de guía con #
        const guia = {
            ...guiaData,
            numero_guia: formatNumeroGuia(guiaData.numero_guia),
            recargo_mora: recargo,
            total_con_recargo: parseFloat(guiaData.monto_pagar) + recargo
        };

        res.json({
            success: true,
            guia: guia
        });

    } catch (error) {
        console.error('Error al obtener guía:', error);
        res.status(500).json({
            error: 'Error al obtener guía.'
        });
    }
});

/**
 * DELETE /api/guias/:id
 * Eliminar permanentemente una guía (solo master, requiere clave_admin)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'master') {
            return res.status(403).json({ error: 'Acceso denegado. Solo el administrador puede eliminar guías.' });
        }

        const { id } = req.params;
        const { clave_admin } = req.body;

        // Verificar clave de administrador
        if (clave_admin !== '2708') {
            return res.status(401).json({ error: 'Clave de administrador incorrecta.' });
        }

        // Verificar que la guía existe
        const checkResult = await db.query('SELECT id, numero_guia FROM guias_movilizacion WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Guía no encontrada.' });
        }

        const guia = checkResult.rows[0];

        // Eliminar registros relacionados primero (para evitar violaciones de FK)
        await db.query('DELETE FROM pagos WHERE guia_id = $1', [id]);
        await db.query('DELETE FROM confirmaciones_llegada WHERE guia_id = $1', [id]);
        await db.query('DELETE FROM tracking_historial WHERE guia_id = $1', [id]);
        await db.query("DELETE FROM auditoria WHERE tabla_afectada = 'guias_movilizacion' AND registro_id::text = $1", [id]);

        // Eliminar la guía
        await db.query('DELETE FROM guias_movilizacion WHERE id = $1', [id]);

        // Intentar eliminar el archivo de Supabase (no fatal si falla)
        try {
            await supabase.storage
                .from(process.env.SUPABASE_BUCKET || 'minerales-assets')
                .remove([`guias/${id}.pdf`]);
        } catch (storageErr) {
            console.warn('No se pudo eliminar el archivo de Supabase:', storageErr.message);
        }

        // Registrar en auditoría
        await db.query(
            `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, ip_address, datos_nuevos)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.id, 'eliminar_guia_permanente', 'guias_movilizacion', id, truncateIP(req.ip),
             JSON.stringify({ numero_guia: guia.numero_guia })]
        );

        res.json({ success: true, message: `Guía ${guia.numero_guia} eliminada permanentemente.` });

    } catch (error) {
        console.error('Error al eliminar guía:', error);
        res.status(500).json({ error: 'Error al eliminar la guía. Verifique que no tenga dependencias.' });
    }
});

/**
 * GET /api/guias/:id/pdf
 * Descargar PDF de la guía (solo si el pago está verificado)
 */
// Generación de PDF y verificación
const fs = require('fs');
const path = require('path');

/**
 * GET /api/guias/:id/pdf
 * Descargar PDF de la guía (solo si está activa y existe el archivo)
 */
router.get('/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener datos completos de la guía + empresa
        let query = `
            SELECT g.*, e.razon_social as empresa_nombre, e.rif as empresa_rif, e.codigo_letra
            FROM guias_movilizacion g
            LEFT JOIN empresas e ON g.empresa_id = e.id
            WHERE g.id = $1
        `;
        const params = [id];

        // Validación de propiedad
        if (req.user.role !== 'master') {
            query += ' AND g.empresa_id = $2';
            params.push(req.user.empresaId);
        }

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Guía no encontrada.' });
        }

        const guia = result.rows[0];

        // Ventana de acceso 8 AM - 6 PM en hora de Venezuela (America/Caracas)
        const now = new Date();
        let hour = now.getHours();
        let isToday = false;

        try {
            // Obtener la hora local de Caracas (0-23)
            const hourFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Caracas',
                hour: 'numeric',
                hour12: false
            });
            hour = parseInt(hourFormatter.format(now), 10);

            // Obtener fechas localizadas en "America/Caracas"
            const dateFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Caracas',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

            const nowParts = dateFormatter.formatToParts(now);
            const nowCaracasString = `${nowParts.find(p => p.type === 'year').value}-${nowParts.find(p => p.type === 'month').value}-${nowParts.find(p => p.type === 'day').value}`;

            const createdDate = new Date(guia.created_at);
            const createdParts = dateFormatter.formatToParts(createdDate);
            const createdCaracasString = `${createdParts.find(p => p.type === 'year').value}-${createdParts.find(p => p.type === 'month').value}-${createdParts.find(p => p.type === 'day').value}`;

            isToday = nowCaracasString === createdCaracasString;
        } catch (tzError) {
            console.error('Error calculando timezone en guias.routes.js:', tzError);
            // Fallback en caso de error
            hour = now.getHours();
            const createdDate = new Date(guia.created_at);
            isToday = createdDate.toDateString() === now.toDateString();
        }

        const isWithinWindow = hour >= 8 && hour < 18;

        if (guia.estado !== 'activa' && guia.estado !== 'usada' && guia.estado !== 'vencida') {
            if (!(isToday && isWithinWindow)) {
                return res.status(403).json({
                    error: 'El documento no está disponible. Fuera del horario permitido (08:00 - 18:00) o requiere verificación de pago.'
                });
            }
        }

        // Parsear materiales si llegaron como string
        let materiales = guia.materiales;
        if (typeof materiales === 'string') {
            try { materiales = JSON.parse(materiales); } catch(e) { materiales = []; }
        }

        // Regenerar el PDF siempre con los datos frescos de la empresa (código letra)
        const codigoLetra = guia.codigo_letra || '';
        const numeroGuiaFormateado = formatNumeroGuia(guia.numero_guia, codigoLetra);

        const pdfBuffer = await generateGuiaPDF({
            ...guia,
            numero_guia: numeroGuiaFormateado,
            empresa_nombre: guia.empresa_nombre || '',
            empresa_rif: guia.empresa_rif || '',
            materiales: materiales || [],
            origen: guia.origen || '',
            destino: guia.destino || ''
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=guia_${numeroGuiaFormateado}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error al descargar PDF:', error);
        res.status(500).json({
            error: 'Error al procesar la solicitud.'
        });
    }
});

/**
 * POST /api/guias/:id/fiscalizar
 * Cierre de guía (llegada a destino) o control en ruta
 * Acepta lat/lng para registro de ubicación
 */
router.post('/:id/fiscalizar', authenticateToken, async (req, res) => {
    const client = await db.pool.connect();

    try {
        const { id } = req.params;
        const { lat, lng } = req.body;

        await client.query('BEGIN');

        // Obtener estado actual
        const checkResult = await client.query('SELECT estado FROM guias_movilizacion WHERE id = $1', [id]);

        if (checkResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Guía no encontrada' });
        }

        const estadoActual = checkResult.rows[0].estado;

        // Lógica de Fiscalización / Cierre
        if (estadoActual === 'activa') {
            // Acción principal: MARCAR COMO USADA (CERRAR GUÍA)
            await client.query(
                `UPDATE guias_movilizacion 
                 SET estado = 'usada', 
                     fecha_uso = CURRENT_TIMESTAMP 
                 WHERE id = $1`,
                [id]
            );

            // Registrar Tracking (si hay coordenadas)
            if (lat && lng) {
                await client.query(
                    `INSERT INTO tracking_historial (guia_id, lat, lng, reportado_por)
                     VALUES ($1, $2, $3, $4)`,
                    [id, lat, lng, req.user.role === 'master' ? 'master_remoto' : 'fiscal_punto']
                );
            }

            await client.query(
                `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [req.user.id, 'fiscalizar_cierre', 'guias_movilizacion', id,
                JSON.stringify({ lat, lng, metodo: 'cierre_destino' }), truncateIP(req.ip)]
            );

            await client.query('COMMIT');

            return res.json({
                success: true,
                message: '✅ GUÍA CERRADA EXITOSAMENTE. Se ha registrado la llegada a destino.'
            });

        } else if (estadoActual === 'usada') {
            await client.query('ROLLBACK');
            return res.json({
                success: false,
                warning: true,
                message: '⚠️ ALERTA: Esta guía YA FUE UTILIZADA anteriormente.'
            });
        } else {
            await client.query('ROLLBACK');
            return res.json({
                success: false,
                error: true,
                message: '❌ GUÍA INVÁLIDA (Vencida o Anulada).'
            });
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al fiscalizar:', error);
        res.status(500).json({ error: 'Error del servidor' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/guias/:id/anular
 * Anular una guía (solo master)
 */
router.put('/:id/anular', authenticateToken, requireRole(['master']), async (req, res) => {
    const client = await db.pool.connect();

    try {
        const { id } = req.params;
        const { motivo } = req.body;

        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE guias_movilizacion 
             SET estado = 'anulada', observaciones = COALESCE(observaciones || E'\\n', '') || $1
             WHERE id = $2
             RETURNING *`,
            [`ANULADA: ${motivo}`, id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Guía no encontrada.' });
        }

        await client.query(
            `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.id, 'anular_guia', 'guias_movilizacion', id, JSON.stringify({ motivo }), truncateIP(req.ip)]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Guía anulada exitosamente.'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al anular guía:', error);
        res.status(500).json({ error: 'Error al anular guía.' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/guias/:id/marcar-usada
 * Marcar guía como usada (solo master)
 */
router.put('/:id/marcar-usada', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `UPDATE guias_movilizacion 
             SET estado = 'usada', fecha_uso = CURRENT_TIMESTAMP
             WHERE id = $1 AND estado = 'activa'
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Guía no encontrada o no está activa.'
            });
        }

        res.json({
            success: true,
            message: 'Guía marcada como usada.'
        });

    } catch (error) {
        console.error('Error al marcar guía:', error);
        res.status(500).json({ error: 'Error al actualizar guía.' });
    }
});


/**
 * GET /api/guias/verificar/:id
 * Verificar autenticidad de una guía (público, sin autenticación)
 */
router.get('/verificar/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT g.id, g.numero_guia, g.estado, g.fecha_emision, g.fecha_vencimiento,
                    g.tipo_mineral, g.cantidad, g.unidad, g.hash_documento,
                    g.vehiculo_placa,
                    e.razon_social as empresa_nombre, e.rif as empresa_rif
             FROM guias_movilizacion g
             JOIN empresas e ON g.empresa_id = e.id
             WHERE g.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: false,
                valida: false,
                mensaje: 'Guía no encontrada. Posible falsificación.'
            });
        }

        const guia = result.rows[0];

        // Determinar estado de validez
        let estadoValidez = guia.estado;
        if (guia.estado === 'activa' && new Date(guia.fecha_vencimiento) < new Date()) {
            estadoValidez = 'vencida';
        }

        res.json({
            success: true,
            valida: estadoValidez === 'activa',
            guia: {
                numero_guia: formatNumeroGuia(guia.numero_guia, guia.codigo_letra),
                estado: estadoValidez,
                empresa: guia.empresa_nombre,
                rif: guia.empresa_rif,
                vehiculo_placa: guia.vehiculo_placa || null,
                mineral: guia.tipo_mineral,
                cantidad: `${guia.cantidad} ${guia.unidad}`,
                fecha_emision: guia.fecha_emision,
                fecha_vencimiento: guia.fecha_vencimiento
            }
        });

    } catch (error) {
        console.error('Error al verificar guía:', error);
        res.status(500).json({
            error: 'Error al verificar guía.'
        });
    }
});

/**
 * POST /api/guias/oficial/verificar
 * Registrar verificación oficial por parte de un fiscalizador
 */
router.post('/oficial/verificar', authenticateToken, requireRole(['fiscalizador', 'master']), async (req, res) => {
    try {
        const { guiaId, ubicacion, comentarios } = req.body;
        const fiscalizadorId = req.user.id;

        if (!guiaId) {
            return res.status(400).json({ error: 'ID de guía es requerido.' });
        }

        // Obtener detalles completos de la guía para el modal detallado
        const guiaData = await db.query(
            `SELECT g.*, e.razon_social as empresa_nombre, e.rif as empresa_rif, e.codigo_letra
             FROM guias_movilizacion g
             JOIN empresas e ON g.empresa_id = e.id
             WHERE g.id = $1`,
            [guiaId]
        );

        const g = guiaData.rows[0];

        // RESTAURAR INSERCIÓN: Registrar la verificación en el historial
        await db.query(
            `INSERT INTO verificaciones_guias (guia_id, fiscalizador_id, ubicacion, comentarios)
             VALUES ($1, $2, $3, $4)`,
            [guiaId, fiscalizadorId, ubicacion || 'Punto de Control', comentarios || '']
        );

        res.json({
            success: true,
            message: 'Verificación registrada exitosamente.',
            guia: {
                numero_guia: formatNumeroGuia(g.numero_guia, g.codigo_letra),
                estado: g.estado,
                empresa_nombre: g.empresa_nombre,
                empresa_rif: g.empresa_rif,
                cliente_nombre: g.cliente_nombre,
                cliente_rif: g.cliente_rif,
                vehiculo_placa: g.vehiculo_placa,
                tipo_mineral: g.tipo_mineral,
                materiales: g.materiales, // Array de materiales JSONB
                fecha_emision: g.fecha_emision,
                fecha_vencimiento: g.fecha_vencimiento
            }
        });

    } catch (error) {
        console.error('Error al registrar verificación oficial:', error);
        res.status(500).json({ error: 'Error interno al procesar la verificación.' });
    }
});

/**
 * GET /api/guias/oficial/verificaciones
 * Obtener historial de verificaciones del fiscalizador actual
 */
router.get('/oficial/verificaciones', authenticateToken, requireRole(['fiscalizador', 'master']), async (req, res) => {
    try {
        const fiscalizadorId = req.user.id;
        const { startDate, endDate } = req.query;

        let query = `
            SELECT v.id, v.guia_id, v.fecha_verificacion, v.ubicacion, v.comentarios,
                    g.numero_guia, g.tipo_mineral, g.cantidad, g.unidad, g.vehiculo_placa,
                    e.razon_social as empresa_nombre, e.codigo_letra
             FROM verificaciones_guias v
             JOIN guias_movilizacion g ON v.guia_id = g.id
             JOIN empresas e ON g.empresa_id = e.id
             WHERE v.fiscalizador_id = $1
        `;
        const params = [fiscalizadorId];
        let paramCount = 2;

        if (startDate && startDate !== 'null') {
            query += ` AND v.fecha_verificacion >= $${paramCount}`;
            params.push(startDate);
            paramCount++;
        }

        if (endDate && endDate !== 'null') {
            query += ` AND v.fecha_verificacion <= $${paramCount}::timestamp + interval '1 day' - interval '1 second'`;
            params.push(endDate);
            paramCount++;
        }

        query += ` ORDER BY v.fecha_verificacion DESC LIMIT 50`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            verificaciones: result.rows.map(v => ({
                ...v,
                numero_guia: formatNumeroGuia(v.numero_guia, v.codigo_letra)
            }))
        });

    } catch (error) {
        console.error('Error al obtener historial de verificaciones:', error);
        res.status(500).json({ error: 'Error al obtener el historial.' });
    }
});

/**
 * GET /api/guias/public/verificar/:id
 * Verificación pública de guía (escáner QR)
 */
router.get('/public/verificar/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { v: providedHash } = req.query;

        const result = await db.query(
            `SELECT g.*, e.razon_social as empresa_nombre, e.codigo_letra
             FROM guias_movilizacion g
             JOIN empresas e ON g.empresa_id = e.id
             WHERE g.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Guía no encontrada.' });
        }

        const guia = result.rows[0];
        
        // Verificar autenticidad basándose en el hash_documento guardado
        const autentica = providedHash && (guia.hash_documento === providedHash);

        res.json({
            success: true,
            autentica: !!autentica,
            guia: {
                numero_guia: formatNumeroGuia(guia.numero_guia, guia.codigo_letra),
                estado: guia.estado,
                empresa_nombre: guia.empresa_nombre,
                cliente_nombre: guia.cliente_nombre,
                cliente_rif: guia.cliente_rif,
                conductor_nombre: guia.conductor_nombre,
                vehiculo_placa: guia.vehiculo_placa,
                tipo_mineral: guia.tipo_mineral,
                materiales: guia.materiales,
                fecha_emision: guia.fecha_emision,
                fecha_vencimiento: guia.fecha_vencimiento
            }
        });

    } catch (error) {
        console.error('Error en verificación pública:', error);
        res.status(500).json({ success: false, error: 'Error al verificar guía.' });
    }
});

/**
 * DELETE /api/guias/purgar
 * ELIMINAR TODAS LAS GUÍAS Y DATOS RELACIONADOS (Solo Master)
 * Requiere contraseña de seguridad '2708'
 */
router.delete('/purgar', authenticateToken, requireRole(['master']), async (req, res) => {
    const { password } = req.body;

    if (password !== '2708') {
        return res.status(403).json({
            error: 'Contraseña de seguridad incorrecta. Acción cancelada.'
        });
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Eliminar registros en orden de dependencia (debido a FK RESTRICT)
        // Tablas de tracking y verificaciones oficiales
        await client.query('DELETE FROM tracking_historial');
        await client.query('DELETE FROM verificaciones_guias');
        
        // Tablas relacionadas con guías (pagos y confirmaciones de llegada)
        await client.query('DELETE FROM confirmaciones_llegada');
        await client.query('DELETE FROM pagos');
        
        // Finalmente las guías (Usuarios, Empresas y Configuración permanecen intocables)
        const result = await client.query('DELETE FROM guias_movilizacion');
        const count = result.rowCount;

        // Registrar acción crítica en auditoría
        await client.query(
            `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, datos_nuevos, ip_address)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'purgar_sistema', 'todas_guias', JSON.stringify({ 
                guias_eliminadas: count, 
                fecha: new Date(),
                nota: 'Usuarios y Empresas preservados' 
            }), truncateIP(req.ip)]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Sistema purgado exitosamente. Se eliminaron ${count} guías y sus historiales. NOTA: Los Usuarios y Empresas NO fueron afectados.`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al purgar sistema:', error);
        res.status(500).json({
            error: 'Error crítico al intentar purgar el sistema.'
        });
    } finally {
        client.release();
    }
});

module.exports = router;
