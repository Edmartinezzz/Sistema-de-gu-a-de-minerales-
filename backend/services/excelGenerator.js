const ExcelJS = require('exceljs');
const { formatNumeroGuia } = require('../utils/security');

/**
 * Genera un Excel con el historial de verificaciones
 */
async function generateVerificacionesExcel(verificaciones, fiscalizador) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Verificaciones');

    // Configuración de columnas
    worksheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Guía #', key: 'guia', width: 15 },
        { header: 'Mineral', key: 'mineral', width: 25 },
        { header: 'Cantidad', key: 'cantidad', width: 10 },
        { header: 'Unidad', key: 'unidad', width: 10 },
        { header: 'Vehículo', key: 'vehiculo', width: 15 },
        { header: 'Empresa', key: 'empresa', width: 30 },
        { header: 'Ubicación', key: 'ubicacion', width: 30 },
        { header: 'Comentarios', key: 'comentarios', width: 40 }
    ];

    // Estilo del header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1E3A8A' }
    };

    // Agregar datos
    verificaciones.forEach(v => {
        worksheet.addRow({
            fecha: new Date(v.fecha_verificacion).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }),
            guia: v.numero_guia,
            mineral: v.tipo_mineral,
            cantidad: v.cantidad,
            unidad: v.unidad,
            vehiculo: v.vehiculo_placa || 'N/A',
            empresa: v.empresa_nombre,
            ubicacion: v.ubicacion || 'N/A',
            comentarios: v.comentarios || ''
        });
    });

    return await workbook.xlsx.writeBuffer();
}

/**
 * Genera un Excel de guías consolidadas por empresa
 */
async function generateGuiasAgrupadasExcel(datos, period, adminUser) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Resumen Consolidado');

    worksheet.columns = [
        { header: 'Nombre de la Empresa', key: 'empresa', width: 40 },
        { header: 'Guías Emitidas', key: 'cantidad', width: 15 },
        { header: 'Total Facturado (Bs.)', key: 'total', width: 25 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1E3A8A' }
    };

    let totalGuiasGlobal = 0;
    let totalBsGlobal = 0;

    datos.forEach(v => {
        totalGuiasGlobal += v.cantidad_guias;
        totalBsGlobal += v.total_bs;

        const row = worksheet.addRow({
            empresa: v.empresa_nombre,
            cantidad: v.cantidad_guias,
            total: v.total_bs
        });

        // Formato moneda con separadores de miles y decimales
        row.getCell('total').numFmt = '#,##0.00';
    });

    // Fila de total
    const totalRow = worksheet.addRow({
        empresa: 'TOTAL GENERAL',
        cantidad: totalGuiasGlobal,
        total: totalBsGlobal
    });
    totalRow.font = { bold: true };
    totalRow.getCell('total').numFmt = '#,##0.00 "Bs."';

    return await workbook.xlsx.writeBuffer();
}

/**
 * Genera un Excel detallado de cada guía
 */
async function generateGuiasDetalladasExcel(guias, period, adminUser) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Detallado');

    worksheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Empresa', key: 'empresa', width: 30 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'N° Guía', key: 'numero', width: 15 },
        { header: 'Placa', key: 'placa', width: 12 },
        { header: 'Mineral / Material', key: 'mineral', width: 25 },
        { header: 'Cantidad', key: 'cantidad', width: 10 },
        { header: 'Unidad', key: 'unidad', width: 10 },
        { header: 'Total Bs.', key: 'total', width: 20 },
        { header: 'Estado', key: 'estado', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1E3A8A' }
    };

    guias.forEach(g => {
        let totalGuia = 0;
        const tasa = parseFloat(g.tasa_bcv || 0);
        
        // 1. Intentar calcular desde el monto_usd de la guía si existe
        const montoUsdGuia = parseFloat(g.monto_usd || 0);
        
        // Parsear materiales
        let mats = g.materiales;
        if (typeof mats === 'string') {
            try { mats = JSON.parse(mats); } catch(e) { mats = []; }
        }

        if (montoUsdGuia > 0 && tasa > 0) {
            totalGuia = montoUsdGuia * tasa;
        } else if (Array.isArray(mats) && mats.length > 0) {
            // 2. Si no hay monto_usd, calcular desde materiales
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

        if (totalGuia === 0) {
            totalGuia = parseFloat(g.monto_pagar || 0) + parseFloat(g.monto_recargo || 0);
        }

        // Preparar descripción de materiales y cantidad total
        let mineralDesc = g.tipo_mineral || 'N/A';
        let cantidadTotal = parseFloat(g.cantidad || 0);

        if (Array.isArray(mats) && mats.length > 0) {
            mineralDesc = mats.map(m => `${m.nombre} (${m.cantidad} ${m.unidad || 'm³'})`).join(', ');
            cantidadTotal = mats.reduce((sum, m) => sum + parseFloat(m.cantidad || 0), 0);
        }

        const row = worksheet.addRow({
            fecha: new Date(g.created_at).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }),
            empresa: g.empresa_nombre || 'N/A',
            cliente: g.cliente_nombre || 'N/A',
            numero: formatNumeroGuia(g.numero_guia, g.codigo_letra),
            placa: g.vehiculo_placa || 'N/A',
            mineral: mineralDesc,
            cantidad: cantidadTotal,
            unidad: g.unidad || 'm³',
            total: totalGuia,
            estado: g.estado
        });

        row.getCell('total').numFmt = '#,##0.00';
    });

    return await workbook.xlsx.writeBuffer();
}

module.exports = {
    generateVerificacionesExcel,
    generateGuiasAgrupadasExcel,
    generateGuiasDetalladasExcel
};
