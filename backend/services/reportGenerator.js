const PDFDocument = require('pdfkit');
const { formatNumeroGuia } = require('../utils/security');

/**
 * Genera un PDF con el historial de verificaciones de un fiscalizador
 * @param {Array} verificaciones - Lista de verificaciones
 * @param {Object} fiscalizador - Datos del fiscalizador (nombre)
 * @returns {Promise<Buffer>} Buffer del PDF
 */
async function generateVerificacionesPDF(verificaciones, fiscalizador) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Título
            doc.fontSize(16).font('Helvetica-Bold').text('REPORTE DE VERIFICACIONES DE GUÍAS', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica').text(`Generado por: ${fiscalizador.username}`, { align: 'center' });
            doc.text(`Fecha de Reporte: ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`, { align: 'center' });
            doc.moveDown(2);

            // Tabla Headers
            const tableTop = 150;
            const colWidths = [100, 80, 120, 80, 120];
            const colNames = ['Fecha', 'Guía #', 'Mineral', 'Vehículo', 'Empresa'];
            let x = 50;

            doc.fontSize(10).font('Helvetica-Bold');
            colNames.forEach((name, i) => {
                doc.text(name, x, tableTop);
                x += colWidths[i];
            });

            doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
            
            // Tabla Filas
            let y = tableTop + 25;
            doc.fontSize(9).font('Helvetica');

            verificaciones.forEach(v => {
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }

                const fecha = new Date(v.fecha_verificacion).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
                const vehiculo = v.vehiculo_placa || 'N/A';
                
                x = 50;
                doc.text(fecha, x, y);
                x += colWidths[0];
                doc.text(v.numero_guia, x, y);
                x += colWidths[1];
                doc.text(`${v.tipo_mineral} (${v.cantidad} ${v.unidad})`, x, y, { width: colWidths[2] - 5 });
                x += colWidths[2];
                doc.text(vehiculo, x, y);
                x += colWidths[3];
                doc.text(v.empresa_nombre, x, y, { width: colWidths[4] - 5 });

                y += 25;
            });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

async function generateGuiasAgrupadasPDF(datos, period, adminUser) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 40, bottom: 40, left: 40, right: 40 }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Colores Premium
            const primaryColor = '#1e3a8a';
            const secondaryColor = '#f3f4f6';
            const textColor = '#1f2937';

            // Cabecera Premium
            doc.rect(0, 0, 612, 80).fill(primaryColor);
            doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text('SISTEMA DE CONTROL DE MINERALES', 40, 25);
            doc.fontSize(12).font('Helvetica').text('Resumen Consolidado de Guías Emitidas', 40, 50);
            
            doc.fillColor('white').fontSize(10).text(`FECHA: ${new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas' })}`, 450, 35, { align: 'right' });
            
            let periodText = 'Periodo: Historico';
            if (period.desde && period.hasta) {
                periodText = `Periodo: ${period.desde} al ${period.hasta}`;
            }
            doc.text(periodText, 450, 50, { align: 'right' });

            doc.fillColor(textColor);
            doc.moveDown(4);

            // Tabla Headers
            const tableTop = 120;
            const colWidths = [300, 100, 132];
            const colNames = ['Nombre de la Empresa', 'Guías Emitidas', 'Total Facturado (Bs.)'];
            
            doc.rect(40, tableTop - 5, 532, 25).fill(primaryColor);
            doc.fillColor('white');

            let x = 45;
            doc.fontSize(10).font('Helvetica-Bold');
            colNames.forEach((name, i) => {
                doc.text(name, x, tableTop, { width: colWidths[i] - 10, align: i === 0 ? 'left' : 'right' });
                x += colWidths[i];
            });
            
            // Tabla Filas
            let y = tableTop + 30;
            doc.fontSize(9).font('Helvetica').fillColor(textColor);

            let totalGuiasGlobal = 0;
            let totalBsGlobal = 0;

            datos.forEach((v, index) => {
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                    doc.rect(40, y - 5, 532, 25).fill(primaryColor);
                    doc.fillColor('white');
                    x = 45;
                    doc.fontSize(10).font('Helvetica-Bold');
                    colNames.forEach((name, i) => {
                        doc.text(name, x, y, { width: colWidths[i] - 10, align: i === 0 ? 'left' : 'right' });
                        x += colWidths[i];
                    });
                    y += 30;
                    doc.fontSize(9).font('Helvetica').fillColor(textColor);
                }

                totalGuiasGlobal += v.cantidad_guias;
                totalBsGlobal += v.total_bs;

                if (index % 2 === 0) {
                    doc.rect(40, y - 5, 532, 20).fill(secondaryColor);
                }
                doc.fillColor(textColor);
                doc.rect(40, y - 5, 532, 20).stroke('#e5e7eb');

                x = 45;
                doc.text(v.empresa_nombre, x, y, { width: colWidths[0] - 10 });
                x += colWidths[0];
                doc.text(v.cantidad_guias.toString(), x, y, { width: colWidths[1] - 10, align: 'right' });
                x += colWidths[1];
                
                const bsFormatted = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v.total_bs);
                doc.text(`Bs. ${bsFormatted}`, x, y, { width: colWidths[2] - 10, align: 'right' });

                y += 20;
            });

            // Fila de Total Global
            doc.rect(40, y, 532, 25).fill(primaryColor);
            doc.fillColor('white');
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('TOTAL GENERAL', 45, y + 5, { width: colWidths[0] - 10 });
            
            doc.text(totalGuiasGlobal.toString(), 40 + colWidths[0], y + 5, { width: colWidths[1] - 10, align: 'right' });
            
            const totalBsFormatted = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalBsGlobal);
            doc.text(`Bs. ${totalBsFormatted}`, 40 + colWidths[0] + colWidths[1], y + 5, { width: colWidths[2] - 10, align: 'right' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

async function generateGuiasDetalladasPDF(guias, period, adminUser) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                layout: 'landscape',
                margins: { top: 40, bottom: 40, left: 40, right: 40 }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Colores Premium
            const primaryColor = '#1e3a8a'; // Azul oscuro premium
            const secondaryColor = '#f3f4f6'; // Gris muy claro para filas
            const accentColor = '#3b82f6'; // Azul brillante
            const textColor = '#1f2937';
            const lightTextColor = '#6b7280';

            // Logo o Cabecera Decorativa
            doc.rect(0, 0, 792, 80).fill(primaryColor);
            doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('SISTEMA DE CONTROL DE MINERALES', 40, 20);
            doc.fontSize(12).font('Helvetica').text('Reporte Detallado de Guías Emitidas', 40, 50);
            
            doc.fillColor('white').fontSize(10).text(`ADMIN: ${adminUser.username}`, 600, 25, { align: 'right' });
            doc.text(`FECHA: ${new Date().toLocaleDateString('es-VE', { timeZone: 'America/Caracas' })}`, 600, 40, { align: 'right' });
            
            let periodText = 'Periodo: Historico';
            if (period.desde && period.hasta) {
                periodText = `Periodo: ${period.desde} al ${period.hasta}`;
            }
            doc.text(periodText, 600, 55, { align: 'right' });

            doc.fillColor(textColor);
            doc.moveDown(4);

            // Tabla Headers
            const tableTop = 110;
            const colWidths = [55, 85, 100, 55, 65, 100, 55, 197];
            const colNames = ['Fecha', 'Empresa', 'Cliente', 'N° Guía', 'Placa', 'Mineral / Material', 'Cant.', 'Total Bs.'];
            
            doc.rect(40, tableTop - 5, 712, 25).fill(primaryColor);
            doc.fillColor('white');

            let x = 45;
            doc.fontSize(10).font('Helvetica-Bold');
            colNames.forEach((name, i) => {
                doc.text(name, x, tableTop, { width: colWidths[i] - 5, align: i === 6 ? 'right' : 'left' });
                x += colWidths[i];
            });
            
            // Tabla Filas
            let y = tableTop + 30;
            doc.fontSize(8).font('Helvetica').fillColor(textColor);

            let totalBsGlobal = 0;
            let totalGuias = 0;
            let totalCantidadGlobal = 0;
            const totalesPorMaterial = {}; // { 'Piedra': { cant: 10, unidad: 'm3' } }

            guias.forEach((g, index) => {
                // Calcular total desde materiales si monto_pagar es 0
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

                totalBsGlobal += totalGuia;
                totalGuias++;

                // Acumular por material para el resumen final (Manejo de multi-materiales)
                let mats = g.materiales;
                if (typeof mats === 'string') {
                    try { mats = JSON.parse(mats); } catch(e) { mats = []; }
                }

                if (Array.isArray(mats) && mats.length > 0) {
                    mats.forEach(m => {
                        const materialKey = m.nombre || 'N/A';
                        const cant = parseFloat(m.cantidad || 0);
                        if (!totalesPorMaterial[materialKey]) {
                            totalesPorMaterial[materialKey] = { cantidad: 0, unidad: m.unidad || 'm³' };
                        }
                        totalesPorMaterial[materialKey].cantidad += cant;
                        totalCantidadGlobal += cant;
                    });
                } else {
                    // Fallback para guías antiguas sin el campo JSONB materiales
                    const materialKey = g.tipo_mineral || 'N/A';
                    const cant = parseFloat(g.cantidad || 0);
                    if (!totalesPorMaterial[materialKey]) {
                        totalesPorMaterial[materialKey] = { cantidad: 0, unidad: g.unidad || 'm³' };
                    }
                    totalesPorMaterial[materialKey].cantidad += cant;
                    totalCantidadGlobal += cant;
                }

                if (y > 500) {
                    doc.addPage();
                    // Re-dibujar header de página
                    doc.rect(0, 0, 792, 40).fill(primaryColor);
                    doc.fillColor('white').fontSize(12).font('Helvetica-Bold').text('Continuación de Reporte...', 40, 15);
                    
                    y = 60;
                    doc.rect(40, y - 5, 712, 25).fill(primaryColor);
                    doc.fillColor('white');
                    x = 45;
                    doc.fontSize(10).font('Helvetica-Bold');
                    colNames.forEach((name, i) => {
                        doc.text(name, x, y, { width: colWidths[i] - 5, align: i === 6 ? 'right' : 'left' });
                        x += colWidths[i];
                    });
                    y += 30;
                    doc.fontSize(8).font('Helvetica').fillColor(textColor);
                }

                // Fondo alternado para filas
                if (index % 2 === 0) {
                    doc.rect(40, y - 5, 712, 25).fill(secondaryColor);
                }
                doc.fillColor(textColor);
                
                // Bordes suaves
                doc.rect(40, y - 5, 712, 25).stroke('#e5e7eb');

                x = 45;
                doc.text(new Date(g.created_at).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }), x, y);
                x += colWidths[0];
                doc.text(g.empresa_nombre || 'N/A', x, y, { width: colWidths[1] - 5 });
                x += colWidths[1];
                doc.text(g.cliente_nombre || 'N/A', x, y, { width: colWidths[2] - 5 });
                x += colWidths[2];
                doc.text(formatNumeroGuia(g.numero_guia, g.codigo_letra), x, y);
                x += colWidths[3];
                doc.text(g.vehiculo_placa || 'N/A', x, y, { width: colWidths[4] - 5 });
                x += colWidths[4];
                doc.text(g.tipo_mineral || 'N/A', x, y, { width: colWidths[5] - 5 });
                x += colWidths[5];
                doc.text(`${g.cantidad} ${g.unidad}`, x, y, { width: colWidths[6] - 5 });
                x += colWidths[6];
                
                const bsFormatted = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalGuia);
                doc.text(bsFormatted, x, y, { width: colWidths[7] - 5, align: 'right' });

                y += 25;
            });

            // Resumen Final
            if (y > 480) {
                doc.addPage();
                y = 50;
            } else {
                y += 20;
            }

            // Nueva sección: Totales por Material (Dinámica)
            const numMateriales = Object.keys(totalesPorMaterial).length;
            const itemHeight = 12;
            const headerHeight = 25;
            const footerHeight = 20;
            const boxHeight = Math.max(80, headerHeight + (numMateriales * itemHeight) + footerHeight);

            doc.rect(40, y, 240, boxHeight).fill('#f8fafc').stroke(primaryColor);
            doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold');
            doc.text('TOTALES POR MATERIAL', 50, y + 10);
            doc.fillColor(textColor).fontSize(9).font('Helvetica');
            
            let matY = y + 30;
            Object.keys(totalesPorMaterial).forEach(mat => {
                const cantFormateada = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(totalesPorMaterial[mat].cantidad);
                doc.text(`${mat}:`, 50, matY, { width: 150 });
                doc.text(`${cantFormateada} ${totalesPorMaterial[mat].unidad}`, 50, matY, { width: 220, align: 'right' });
                matY += itemHeight;
            });

            // Fila de Total de Cantidades
            doc.moveTo(50, matY).lineTo(270, matY).stroke(primaryColor);
            matY += 5;
            doc.font('Helvetica-Bold').text('TOTAL CANTIDAD:', 50, matY, { width: 150 });
            const totalCantFormateada = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(totalCantidadGlobal);
            doc.text(`${totalCantFormateada} m³`, 50, matY, { width: 220, align: 'right' });

            // Resumen Financiero
            doc.rect(500, y, 252, 80).fill('#f8fafc').stroke(primaryColor);
            doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold');
            doc.text('RESUMEN DE REPORTE', 510, y + 10);
            
            doc.fillColor(textColor).fontSize(10).font('Helvetica');
            doc.text(`Total de Guías:`, 510, y + 35);
            doc.text(`${totalGuias}`, 740, y + 35, { align: 'right' });
            
            doc.font('Helvetica-Bold').text(`TOTAL GENERAL (Bs.):`, 510, y + 55);
            const totalBsFormatted = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalBsGlobal);
            doc.text(`Bs. ${totalBsFormatted}`, 600, y + 55, { width: 140, align: 'right' });

            // Footer
            doc.fontSize(8).fillColor(lightTextColor).text('Documento generado automáticamente por el Sistema de Guías de Minerales - Estado La Guaira', 40, 560, { align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generateVerificacionesPDF,
    generateGuiasAgrupadasPDF,
    generateGuiasDetalladasPDF
};
