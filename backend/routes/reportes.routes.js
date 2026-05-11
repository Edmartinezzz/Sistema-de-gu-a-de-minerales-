const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { formatNumeroGuia } = require('../utils/security');
const { generateVerificacionesPDF, generateGuiasAgrupadasPDF, generateGuiasDetalladasPDF } = require('../services/reportGenerator');
const { generateVerificacionesExcel, generateGuiasAgrupadasExcel, generateGuiasDetalladasExcel } = require('../services/excelGenerator');


const router = express.Router();

/**
 * GET /api/reportes/guias-detalladas-pdf
 * Generar reporte PDF detallado de cada guía
 */
router.get('/guias-detalladas-pdf', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const { desde, hasta, empresa_id } = req.query;

        let query = `
            SELECT g.*, e.razon_social as empresa_nombre, e.codigo_letra
            FROM guias_movilizacion g
            JOIN empresas e ON g.empresa_id = e.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (empresa_id) {
            query += ` AND g.empresa_id = $${paramCount}`;
            params.push(empresa_id);
            paramCount++;
        }

        if (desde && desde !== 'null') {
            query += ` AND g.created_at >= $${paramCount}`;
            params.push(desde);
            paramCount++;
        }

        if (hasta && hasta !== 'null') {
            query += ` AND g.created_at <= $${paramCount}::timestamp + interval '1 day' - interval '1 second'`;
            params.push(hasta);
            paramCount++;
        }

        query += ` ORDER BY g.created_at ASC`;

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron guías en el rango especificado.' });
        }

        const period = { desde, hasta };
        const pdfBuffer = await generateGuiasDetalladasPDF(result.rows, period, req.user);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename=reporte-guias-detallado.pdf',
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error al generar PDF de guías detallado:', error);
        res.status(500).json({ error: 'Error al generar el PDF.' });
    }
});

/**
 * GET /api/reportes/guias-detalladas-excel
 * Generar reporte Excel detallado de cada guía
 */
router.get('/guias-detalladas-excel', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const { desde, hasta, empresa_id } = req.query;

        let query = `
            SELECT g.*, e.razon_social as empresa_nombre, e.codigo_letra
            FROM guias_movilizacion g
            JOIN empresas e ON g.empresa_id = e.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (empresa_id) {
            query += ` AND g.empresa_id = $${paramCount}`;
            params.push(empresa_id);
            paramCount++;
        }

        if (desde && desde !== 'null') {
            query += ` AND g.created_at >= $${paramCount}`;
            params.push(desde);
            paramCount++;
        }

        if (hasta && hasta !== 'null') {
            query += ` AND g.created_at <= $${paramCount}::timestamp + interval '1 day' - interval '1 second'`;
            params.push(hasta);
            paramCount++;
        }

        query += ` ORDER BY g.created_at ASC`;

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron guías en el rango especificado.' });
        }

        const period = { desde, hasta };
        const excelBuffer = await generateGuiasDetalladasExcel(result.rows, period, req.user);

        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename=reporte-guias-detallado.xlsx',
            'Content-Length': excelBuffer.length
        });

        res.send(excelBuffer);

    } catch (error) {
        console.error('Error al generar Excel de guías detallado:', error);
        res.status(500).json({ error: 'Error al generar el Excel.' });
    }
});



/**
 * GET /api/reportes/estadisticas
 * Obtener estadísticas del dashboard (solo master)
 */
router.get('/estadisticas', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        // Total de empresas activas
        const empresasResult = await db.query(
            'SELECT COUNT(*) as total FROM empresas WHERE activo = true'
        );

        // Total de guías por estado
        const guiasResult = await db.query(
            `SELECT estado, COUNT(*) as cantidad
             FROM guias_movilizacion
             GROUP BY estado`
        );

        // Pagos pendientes
        const pagosPendientesResult = await db.query(
            'SELECT COUNT(*) as total FROM pagos WHERE estado = \'pendiente\''
        );

        // Ingresos del mes actual
        const ingresosMesResult = await db.query(
            `SELECT SUM(monto) as total
             FROM pagos
             WHERE estado = 'verificado'
             AND EXTRACT(MONTH FROM fecha_verificacion) = EXTRACT(MONTH FROM CURRENT_DATE)
             AND EXTRACT(YEAR FROM fecha_verificacion) = EXTRACT(YEAR FROM CURRENT_DATE)`
        );

        // Ingresos totales (histórico)
        const ingresosTotalesResult = await db.query(
            `SELECT SUM(monto) as total
             FROM pagos
             WHERE estado = 'verificado'`
        );

        // Desglose mensual (últimos 12 meses)
        const desgloseMensualResult = await db.query(
            `SELECT 
                EXTRACT(MONTH FROM fecha_verificacion) as mes,
                EXTRACT(YEAR FROM fecha_verificacion) as anio,
                SUM(monto) as total
             FROM pagos
             WHERE estado = 'verificado'
             GROUP BY anio, mes
             ORDER BY anio DESC, mes DESC
             LIMIT 12`
        );

        // Guías emitidas este mes
        const guiasMesResult = await db.query(
            `SELECT COUNT(*) as total
             FROM guias_movilizacion
             WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
             AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
        );

        res.json({
            success: true,
            estadisticas: {
                empresas_activas: parseInt(empresasResult.rows[0].total),
                guias_por_estado: guiasResult.rows,
                pagos_pendientes: parseInt(pagosPendientesResult.rows[0].total),
                ingresos_mes: parseFloat(ingresosMesResult.rows[0].total || 0),
                ingresos_totales: parseFloat(ingresosTotalesResult.rows[0].total || 0),
                desglose_mensual: desgloseMensualResult.rows,
                guias_mes: parseInt(guiasMesResult.rows[0].total)
            }
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas.' });
    }
});

/**
 * GET /api/reportes/guias
 * Generar reporte de guías (solo master)
 */
router.get('/guias', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const { empresa_id, tipo_mineral, estado, fecha_desde, fecha_hasta } = req.query;

        let query = `
            SELECT g.*, e.razon_social as empresa_nombre, e.rif as empresa_rif
            FROM guias_movilizacion g
            JOIN empresas e ON g.empresa_id = e.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (empresa_id) {
            query += ` AND g.empresa_id = $${paramCount}`;
            params.push(empresa_id);
            paramCount++;
        }

        if (tipo_mineral) {
            query += ` AND g.tipo_mineral ILIKE $${paramCount}`;
            params.push(`%${tipo_mineral}%`);
            paramCount++;
        }

        if (estado) {
            query += ` AND g.estado = $${paramCount}`;
            params.push(estado);
            paramCount++;
        }

        if (fecha_desde) {
            query += ` AND g.created_at >= $${paramCount}`;
            params.push(fecha_desde);
            paramCount++;
        }

        if (fecha_hasta) {
            query += ` AND g.created_at <= $${paramCount}`;
            params.push(fecha_hasta);
            paramCount++;
        }

        query += ' ORDER BY g.created_at DESC';

        const result = await db.query(query, params);

        // Formatear números de guía con #
        const guiasFormateadas = result.rows.map(guia => ({
            ...guia,
            numero_guia: formatNumeroGuia(guia.numero_guia)
        }));

        res.json({
            success: true,
            total: guiasFormateadas.length,
            guias: guiasFormateadas
        });

    } catch (error) {
        console.error('Error al generar reporte:', error);
        res.status(500).json({ error: 'Error al generar reporte.' });
    }
});

/**
 * GET /api/reportes/pagos
 * Generar reporte de pagos (solo master)
 */
router.get('/pagos', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const { empresa_id, estado, fecha_desde, fecha_hasta } = req.query;

        let query = `
            SELECT p.*, g.numero_guia, g.tipo_mineral,
                   e.razon_social as empresa_nombre, e.rif as empresa_rif
            FROM pagos p
            JOIN guias_movilizacion g ON p.guia_id = g.id
            JOIN empresas e ON p.empresa_id = e.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (empresa_id) {
            query += ` AND p.empresa_id = $${paramCount}`;
            params.push(empresa_id);
            paramCount++;
        }

        if (estado) {
            query += ` AND p.estado = $${paramCount}`;
            params.push(estado);
            paramCount++;
        }

        if (fecha_desde) {
            query += ` AND p.created_at >= $${paramCount}`;
            params.push(fecha_desde);
            paramCount++;
        }

        if (fecha_hasta) {
            query += ` AND p.created_at <= $${paramCount}`;
            params.push(fecha_hasta);
            paramCount++;
        }

        query += ' ORDER BY p.created_at DESC';

        const result = await db.query(query, params);

        // Calcular totales
        const totales = result.rows.reduce((acc, pago) => {
            if (pago.estado === 'verificado') {
                acc.verificado += parseFloat(pago.monto);
            }
            acc.total += parseFloat(pago.monto);
            return acc;
        }, { total: 0, verificado: 0 });

        // Formatear números de guía con #
        const pagosFormateados = result.rows.map(pago => ({
            ...pago,
            numero_guia: formatNumeroGuia(pago.numero_guia)
        }));

        res.json({
            success: true,
            total_registros: pagosFormateados.length,
            totales: totales,
            pagos: pagosFormateados
        });

    } catch (error) {
        console.error('Error al generar reporte:', error);
        res.status(500).json({ error: 'Error al generar reporte.' });
    }
});

/**
 * GET /api/reportes/empresas
 * Listar todas las empresas (solo master)
 */
router.get('/empresas', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT e.*,
                    COUNT(DISTINCT g.id) as total_guias,
                    COUNT(DISTINCT CASE WHEN g.estado = 'activa' THEN g.id END) as guias_activas,
                    COALESCE(SUM(CASE WHEN p.estado = 'verificado' THEN p.monto ELSE 0 END), 0) as total_pagado
             FROM empresas e
             LEFT JOIN guias_movilizacion g ON e.id = g.empresa_id
             LEFT JOIN pagos p ON g.id = p.guia_id
             GROUP BY e.id
             ORDER BY e.razon_social`
        );

        res.json({
            success: true,
            empresas: result.rows
        });

    } catch (error) {
        console.error('Error al listar empresas:', error);
        res.status(500).json({ error: 'Error al listar empresas.' });
    }
});

/**
 * GET /api/reportes/verificaciones-pdf
 * Generar reporte PDF de las verificaciones realizadas por el fiscalizador
 */
router.get('/verificaciones-pdf', authenticateToken, requireRole(['fiscalizador', 'master']), async (req, res) => {
    try {
        const fiscalizadorId = req.user.id;
        const { startDate, endDate } = req.query;

        let query = `
            SELECT v.id, v.fecha_verificacion, v.ubicacion, v.comentarios,
                    g.numero_guia, g.tipo_mineral, g.cantidad, g.unidad, g.vehiculo_placa,
                    e.razon_social as empresa_nombre
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

        query += ` ORDER BY v.fecha_verificacion DESC`;

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron verificaciones para este reporte.' });
        }

        // Formatear números de guía
        const datos = result.rows.map(v => ({
            ...v,
            numero_guia: formatNumeroGuia(v.numero_guia)
        }));

        const pdfBuffer = await generateVerificacionesPDF(datos, req.user);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename=reporte-verificaciones.pdf',
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error al generar PDF de verificaciones:', error);
        res.status(500).json({ error: 'Error al generar el PDF.' });
    }
});

/**
 * GET /api/reportes/verificaciones-excel
 * Generar reporte Excel de las verificaciones realizadas por el fiscalizador
 */
router.get('/verificaciones-excel', authenticateToken, requireRole(['fiscalizador', 'master']), async (req, res) => {
    try {
        const fiscalizadorId = req.user.id;
        const { startDate, endDate } = req.query;

        let query = `
            SELECT v.id, v.fecha_verificacion, v.ubicacion, v.comentarios,
                    g.numero_guia, g.tipo_mineral, g.cantidad, g.unidad, g.vehiculo_placa,
                    e.razon_social as empresa_nombre
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

        query += ` ORDER BY v.fecha_verificacion DESC`;

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron verificaciones para este reporte.' });
        }

        // Formatear números de guía
        const datos = result.rows.map(v => ({
            ...v,
            numero_guia: formatNumeroGuia(v.numero_guia)
        }));

        const excelBuffer = await generateVerificacionesExcel(datos, req.user);

        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename=reporte-verificaciones.xlsx',
            'Content-Length': excelBuffer.length
        });

        res.send(excelBuffer);

    } catch (error) {
        console.error('Error al generar Excel de verificaciones:', error);
        res.status(500).json({ error: 'Error al generar el Excel.' });
    }
});


/**
 * GET /api/reportes/guias-agrupadas-pdf
 * Generar reporte PDF de guías consolidadas por empresa
 */
router.get('/guias-agrupadas-pdf', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const { desde, hasta, empresa_id } = req.query;

        // Obtenemos todas las guías individuales para poder procesar el JSON de materiales si es necesario
        let query = `
            SELECT g.*, e.razon_social as empresa_nombre, e.rif as empresa_rif
            FROM guias_movilizacion g
            JOIN empresas e ON g.empresa_id = e.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (empresa_id) {
            query += ` AND g.empresa_id = $${paramCount}`;
            params.push(empresa_id);
            paramCount++;
        }

        if (desde && desde !== 'null') {
            query += ` AND g.created_at >= $${paramCount}`;
            params.push(desde);
            paramCount++;
        }

        if (hasta && hasta !== 'null') {
            query += ` AND g.created_at <= $${paramCount}::timestamp + interval '1 day' - interval '1 second'`;
            params.push(hasta);
            paramCount++;
        }

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron guías en el rango especificado.' });
        }

        // Agrupar por empresa en JS para manejar la lógica de materiales
        const empresasMap = {};

        result.rows.forEach(g => {
            if (!empresasMap[g.empresa_id]) {
                empresasMap[g.empresa_id] = {
                    empresa_nombre: g.empresa_nombre,
                    cantidad_guias: 0,
                    total_bs: 0
                };
            }

            let totalGuia = 0;
            const tasa = parseFloat(g.tasa_bcv || 0);
            const montoUsdGuia = parseFloat(g.monto_usd || 0);

            if (montoUsdGuia > 0 && tasa > 0) {
                totalGuia = montoUsdGuia * tasa;
            } else if (g.materiales) {
                let mats = g.materiales;
                if (typeof mats === 'string') {
                    try { mats = JSON.parse(mats); } catch(e) { mats = []; }
                }
                if (Array.isArray(mats)) {
                    mats.forEach(m => {
                        const cant = parseFloat(m.cantidad || 0);
                        const precioUsd = parseFloat(m.precio_unitario || 0);
                        const precioBsRaw = parseFloat(m.precio_unitario_bs || 0);

                        if (precioUsd > 0 && tasa > 0) {
                            totalGuia += (cant * precioUsd * tasa);
                        } else if (precioBsRaw > 0) {
                            totalGuia += (cant * precioBsRaw);
                        }
                    });
                }
            }

            if (totalGuia === 0) {
                totalGuia = parseFloat(g.monto_pagar || 0) + parseFloat(g.monto_recargo || 0);
            }

            empresasMap[g.empresa_id].cantidad_guias += 1;
            empresasMap[g.empresa_id].total_bs += totalGuia;
        });

        const datos = Object.values(empresasMap);

        const period = { desde, hasta };
        const pdfBuffer = await generateGuiasAgrupadasPDF(datos, period, req.user);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename=reporte-guias-agrupadas.pdf',
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error al generar PDF de guías agrupadas:', error);
        res.status(500).json({ error: 'Error al generar el PDF.' });
    }
});

/**
 * GET /api/reportes/guias-agrupadas-excel
 * Generar reporte Excel de guías consolidadas por empresa
 */
router.get('/guias-agrupadas-excel', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const { desde, hasta, empresa_id } = req.query;

        let query = `
            SELECT g.*, e.razon_social as empresa_nombre, e.rif as empresa_rif
            FROM guias_movilizacion g
            JOIN empresas e ON g.empresa_id = e.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (empresa_id) {
            query += ` AND g.empresa_id = $${paramCount}`;
            params.push(empresa_id);
            paramCount++;
        }

        if (desde && desde !== 'null') {
            query += ` AND g.created_at >= $${paramCount}`;
            params.push(desde);
            paramCount++;
        }

        if (hasta && hasta !== 'null') {
            query += ` AND g.created_at <= $${paramCount}::timestamp + interval '1 day' - interval '1 second'`;
            params.push(hasta);
            paramCount++;
        }

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron guías en el rango especificado.' });
        }

        const empresasMap = {};
        result.rows.forEach(g => {
            if (!empresasMap[g.empresa_id]) {
                empresasMap[g.empresa_id] = {
                    empresa_nombre: g.empresa_nombre,
                    cantidad_guias: 0,
                    total_bs: 0
                };
            }

            let totalGuia = parseFloat(g.monto_pagar || 0) + parseFloat(g.monto_recargo || 0);
            if (totalGuia === 0 && g.materiales) {
                let mats = g.materiales;
                if (typeof mats === 'string') {
                    try { mats = JSON.parse(mats); } catch(e) { mats = []; }
                }
                if (Array.isArray(mats)) {
                    mats.forEach(m => {
                        totalGuia += (parseFloat(m.cantidad || 0) * parseFloat(m.precio_unitario_bs || 0));
                    });
                }
            }

            empresasMap[g.empresa_id].cantidad_guias += 1;
            empresasMap[g.empresa_id].total_bs += totalGuia;
        });

        const datos = Object.values(empresasMap);
        const period = { desde, hasta };
        const excelBuffer = await generateGuiasAgrupadasExcel(datos, period, req.user);

        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename=reporte-guias-agrupadas.xlsx',
            'Content-Length': excelBuffer.length
        });

        res.send(excelBuffer);

    } catch (error) {
        console.error('Error al generar Excel de guías agrupadas:', error);
        res.status(500).json({ error: 'Error al generar el Excel.' });
    }
});


module.exports = router;
