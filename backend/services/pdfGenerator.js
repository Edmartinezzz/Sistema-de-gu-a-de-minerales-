const PDFDocument = require('pdfkit');
const { generateHash, formatNumeroGuia } = require('../utils/security');
const { generateQRBuffer } = require('./qrGenerator');
const path = require('path');
const fs = require('fs');

// Lista de materiales para la tabla
const MATERIALES = [
    'Piedra Picada',
    'Arrocillo',
    'Arena 2"',
    'Arena 2/4',
    'Arena 5"',
    'Agregado 4/8',
    'Agregado 8/15',
    'Agregado 5/15',
    'Agregado 15/25',
    'Arena Integral',
    'Granzón',
    'P100',
    'P3000',
    'Coraza',
    'Arena Cernida',
    'Canto Rodado',
    'Polvillo',
    'Arena Amarilla',
    'Otros'
];

/**
 * Genera un PDF de guía de movilización - Formato Oficial La Guaira
 * @param {Object} guiaData - Datos de la guía
 * @returns {Promise<Buffer>} Buffer del PDF generado
 */
async function generateGuiaPDF(guiaData) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 20, bottom: 20, left: 25, right: 25 }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const pageWidth = 612;
            const pageHeight = 792;
            const marginLeft = 25;
            const marginRight = 25;
            const contentWidth = pageWidth - marginLeft - marginRight;

            let y = 20;

            // ============================================================
            // ENCABEZADO CON LOGO
            // ============================================================

            // Intentar cargar logo
            const logoPath = path.join(__dirname, '../../public/assets/logo-laguaira.png');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, marginLeft, y, { width: 60 });
            } else {
                // Dibujar un placeholder circular para el logo
                doc.circle(marginLeft + 30, y + 30, 28).lineWidth(2).stroke('#003DA5');
                doc.fontSize(6).fillColor('#003DA5').text('LOGO', marginLeft + 18, y + 27);
            }

            // Textos del encabezado (Lado del logo)
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
            doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA', marginLeft + 70, y, { width: 300, align: 'left' });
            doc.text('GOBERNACIÓN DEL ESTADO LA GUAIRA', marginLeft + 70, y + 12, { width: 300, align: 'left' });
            doc.text('GRUPO EMPRESARIAL LA GUAIRA C. A.', marginLeft + 70, y + 24, { width: 300, align: 'left' });
            doc.fontSize(8).text('RIF G- 20016643-6', marginLeft + 70, y + 36, { width: 300, align: 'left' });

            // ============================================================
            // CÓDIGO DE GUÍA (Esquina superior derecha)
            // ============================================================
            const codigoWidth = 110;
            const codigoGuiaX = pageWidth - marginRight - codigoWidth;
            const codigoGuiaY = y;

            // Etiqueta "CÓDIGO DE GUÍA"
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#1a5f7a');
            doc.text('CÓDIGO DE GUÍA', codigoGuiaX, codigoGuiaY, { width: codigoWidth, align: 'right' });

            // Número de guía grande
            doc.fontSize(22).font('Helvetica-Bold').fillColor('#000000');
            const numeroGuia = String(guiaData.numero_guia); // Ya viene formateado: #CA02
            doc.text(numeroGuia, codigoGuiaX, codigoGuiaY + 12, {
                width: codigoWidth,
                align: 'right'
            });

            // Hora de generación (Justo debajo del número de guía)
            if (guiaData.fecha_emision) {
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
                const horaGeneracion = formatTime(guiaData.fecha_emision);
                doc.text(`Hora: ${horaGeneracion}`, codigoGuiaX, codigoGuiaY + 36, {
                    width: codigoWidth,
                    align: 'right'
                });
            }

            y += 55;

            // Línea separadora
            doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).lineWidth(1).stroke('#000');
            y += 5;

            // ============================================================
            // TÍTULO PRINCIPAL
            // ============================================================
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a5f7a');
            doc.text('CONTROL Y REGISTRO DE MINERALES NO METALICOS DEL ESTADO LA GUAIRA', marginLeft, y, { width: contentWidth, align: 'center' });
            y += 18;

            // ============================================================
            // SECCIÓN SUPERIOR: GUÍA + BASE LEGAL + FECHAS
            // ============================================================
            const seccionSuperiorY = y;
            const colBaseLegal = marginLeft;
            const colBaseLegalWidth = 380;
            const colDatosGuia = marginLeft + 385;
            const colDatosGuiaWidth = 175;

            // Celda GUIA DE MOVILIZACIÓN N°
            drawCell(doc, colDatosGuia, seccionSuperiorY, colDatosGuiaWidth, 15, 'GUIA DE MOVILIZACIÓN N°', true, '#e8e8e8');
            drawCell(doc, colDatosGuia, seccionSuperiorY + 15, colDatosGuiaWidth, 15, String(guiaData.numero_guia), false);

            // Base Legal (celda grande a la izquierda)
            const baseLegalText = 'Base Legal: Gaceta Oficial del Estado Vargas N° 31 Ordinaria de fecha 02 de diciembre del 2002; CAPÍTULO I "Trata de las Disposiciones Generales de la Ley como es de asumir para el estado Vargas (hoy estado La Guaira) el Régimen, Administración y Explotación de los Recursos Minerales con templados en el Artículo 7 de la Ley de Minas Nacional, la Planificación mi- nera a través de la Secretaría de Desarrollo Económico, y el(la) Gobernador(a). Gaceta Oficial del estado Vargas N° 175 Ordinaria de fecha 03 de diciembre de 2009 Ley de Reforma de Ley de Minerales No Metálicos del estado Vargas (hoy La Guaira). Gaceta Oficial del estado La Guaira N° 1958 Extraordinaria de fecha 03 de septiembre del 2025 Reglamento Parcial de la Ley de Minerales No Metálicos del estado Vargas (ratio Tempori) sobre el transporte y circulación de Minerales No Metálicos del estado La Guaira.';

            doc.rect(colBaseLegal, seccionSuperiorY, colBaseLegalWidth, 90).lineWidth(0.5).stroke('#000');
            doc.fontSize(6).font('Helvetica').fillColor('#000');
            doc.text(baseLegalText, colBaseLegal + 3, seccionSuperiorY + 3, { width: colBaseLegalWidth - 6, align: 'justify' });

            // Fechas y datos a la derecha
            let fechaY = seccionSuperiorY + 30;
            drawCell(doc, colDatosGuia, fechaY, colDatosGuiaWidth, 15, 'Fecha de Emisión:', true);
            drawCell(doc, colDatosGuia, fechaY + 15, colDatosGuiaWidth, 12, formatDateShort(guiaData.fecha_emision), false);
            fechaY += 27;
            drawCell(doc, colDatosGuia, fechaY, colDatosGuiaWidth, 15, 'Fecha de Vencimiento:', true);
            drawCell(doc, colDatosGuia, fechaY + 15, colDatosGuiaWidth, 12, formatDateShort(guiaData.fecha_vencimiento), false);
            fechaY += 27;
            drawCell(doc, colDatosGuia, fechaY, 87, 12, 'N°. Factura Afectada:', true);
            drawCell(doc, colDatosGuia + 87, fechaY, 88, 12, '', false);
            fechaY += 12;
            drawCell(doc, colDatosGuia, fechaY, 87, 12, 'N°. Nota de Despacho:', true);
            drawCell(doc, colDatosGuia + 87, fechaY, 88, 12, '', false);

            y = seccionSuperiorY + 95;

            // ============================================================
            // DATOS DEL CLIENTE
            // ============================================================
            drawSectionHeader(doc, marginLeft, y, contentWidth, 'DATOS DEL CLIENTE');
            y += 15;
            drawLabelValue(doc, marginLeft, y, 420, 'Razón Social:', (guiaData.cliente_nombre || guiaData.empresa_razon_social || '').toUpperCase());
            drawLabelValue(doc, marginLeft + 420, y, 140, 'RIF:', (guiaData.cliente_rif || guiaData.empresa_rif || '').toUpperCase());
            y += 13;
            drawLabelValue(doc, marginLeft, y, contentWidth, 'Dirección Fiscal:', (guiaData.cliente_direccion || guiaData.empresa_direccion || '').toUpperCase());
            y += 15;

            // ============================================================
            // DATOS DEL CONDUCTOR
            // ============================================================
            drawSectionHeader(doc, marginLeft, y, contentWidth, 'DATOS DEL CONDUCTOR');
            y += 15;
            drawLabelValue(doc, marginLeft, y, 420, 'Nombres y Apellidos:', guiaData.conductor_nombre || '');
            drawLabelValue(doc, marginLeft + 420, y, 140, 'RIF / Cédula de Identidad:', guiaData.conductor_cedula || '');
            y += 15;

            // ============================================================
            // DATOS DEL VEHÍCULO + DESCRIPCIÓN DEL MATERIAL (lado a lado)
            // ============================================================
            const vehiculoX = marginLeft;
            const vehiculoWidth = 280;
            const materialX = marginLeft + 285;
            const materialWidth = 275;

            // Encabezado DATOS DEL VEHÍCULO
            drawSectionHeader(doc, vehiculoX, y, vehiculoWidth, 'DATOS DEL VEHÍCULO');
            // Encabezado DESCRIPCIÓN DEL MATERIAL
            drawSectionHeader(doc, materialX, y, materialWidth, 'DESCRIPCIÓN DEL MATERIAL');
            y += 15;

            // Datos del vehículo
            const vehiculoStartY = y;
            const vehiculoFields = [
                { label: 'Marca:', value: guiaData.vehiculo_marca || '' },
                { label: 'Modelo:', value: guiaData.vehiculo_modelo || '' },
                { label: 'Color:', value: guiaData.vehiculo_color || '' },
                { label: 'Placa:', value: guiaData.vehiculo_placa || '' },
                { label: 'Carrocería:', value: guiaData.vehiculo_carroceria || '' },
                { label: 'Otros:', value: '' }
            ];

            let vY = vehiculoStartY;
            vehiculoFields.forEach(field => {
                drawLabelValue(doc, vehiculoX, vY, vehiculoWidth, field.label, field.value);
                vY += 13;
            });

            // Tabla de materiales
            const materialStartY = y;
            // Encabezados de la tabla
            doc.rect(materialX, materialStartY, 110, 13).fillAndStroke('#e8e8e8', '#000');
            doc.rect(materialX + 110, materialStartY, 50, 13).fillAndStroke('#e8e8e8', '#000');
            doc.rect(materialX + 160, materialStartY, 60, 13).fillAndStroke('#e8e8e8', '#000');
            doc.rect(materialX + 220, materialStartY, 55, 13).fillAndStroke('#e8e8e8', '#000');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#000');
            doc.text('Nombre del Material', materialX + 3, materialStartY + 3, { width: 104 });
            doc.text('Cantidad', materialX + 113, materialStartY + 3, { width: 44, align: 'center' });
            doc.text('P. Unit. (Bs.)', materialX + 163, materialStartY + 3, { width: 54, align: 'center' });
            doc.text('Total (Bs.)', materialX + 223, materialStartY + 3, { width: 49, align: 'center' });

            let mY = materialStartY + 13;
            const rowHeight = 11;

            // Recopilar materiales activos (cantidad > 0)
            const materialesActivos = [];
            
            // Primero verificamos el nuevo formato JSONB
            if (guiaData.materiales && Array.isArray(guiaData.materiales)) {
                guiaData.materiales.forEach(m => {
                    if (parseFloat(m.cantidad) > 0) {
                        materialesActivos.push({
                            label: m.nombre,
                            cantidad: parseFloat(m.cantidad),
                            unidad: m.unidad || 'Ton',
                            precio_unitario: m.precio_unitario || 0,
                            precio_unitario_bs: m.precio_unitario_bs || 0,
                            precio_unitario_bs_text: m.precio_unitario_bs_text || null
                        });
                    }
                });
            } 
            
            // Si no hay nada en el nuevo formato, intentar el legacy tipo_mineral + cantidad
            if (materialesActivos.length === 0 && guiaData.tipo_mineral && parseFloat(guiaData.cantidad) > 0) {
                materialesActivos.push({
                    label: guiaData.tipo_mineral,
                    cantidad: parseFloat(guiaData.cantidad),
                    unidad: guiaData.unidad || 'Ton',
                    precio_unitario: 0, 
                    precio_unitario_bs: 0, // Las guias muy viejas no traian esto por material
                    precio_unitario_bs_text: null
                });
            }

            // Si aún está vacío, mostrar una fila vacía o 'Otros' como placeholder (opcional)
            if (materialesActivos.length === 0) {
                materialesActivos.push({ label: 'Otros', cantidad: 0, unidad: 'Ton' });
            }

            // Dibujar las filas de materiales activos
            materialesActivos.forEach(item => {
                const materialLabel = item.label;
                const cantidad = item.cantidad;
                const unidad = item.unidad;
                
                const tasaBcv = parseFloat(guiaData.tasa_bcv) || 1;
                
                // El Total Bs debe calcularse matemáticamente desde el USD: (Cantidad * Precio USD) * Tasa BCV
                const precioParsedUSD = parseFloat(item.precio_unitario);
                const precioUnidadUSD = isNaN(precioParsedUSD) ? 0 : precioParsedUSD;
                const cantMaterial = parseFloat(item.cantidad) || 0;
                const totalUSD = cantMaterial * precioUnidadUSD;
                const totalItemBS = totalUSD * tasaBcv;

                // Para la columna visual de Precio Unitario Bs, usamos el valor ingresado o calculamos el fallback
                let precioUnidadBS = parseFloat(item.precio_unitario_bs) || 0;
                if(precioUnidadBS === 0) {
                     precioUnidadBS = precioUnidadUSD * tasaBcv;
                }

                doc.rect(materialX, mY, 110, rowHeight).stroke('#000');
                doc.rect(materialX + 110, mY, 50, rowHeight).stroke('#000');
                doc.rect(materialX + 160, mY, 60, rowHeight).stroke('#000');
                doc.rect(materialX + 220, mY, 55, rowHeight).stroke('#000');

                doc.fontSize(6).font('Helvetica').fillColor('#000');
                doc.text(materialLabel, materialX + 3, mY + 2, { width: 104 });

                if (cantidad > 0) {
                    doc.text(`${cantidad} ${unidad}`, materialX + 113, mY + 2, { width: 44, align: 'center' });
                    
                    // Si el usuario ingresó texto libre (ej: 5.869,55), lo imprimimos tal cual
                    if (item.precio_unitario_bs_text) {
                        doc.text(item.precio_unitario_bs_text, materialX + 163, mY + 2, { width: 54, align: 'center' });
                    } else {
                        doc.text(precioUnidadBS.toLocaleString('es-VE', { minimumFractionDigits: 2 }), materialX + 163, mY + 2, { width: 54, align: 'center' });
                    }
                    
                    doc.text((totalItemBS || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 }), materialX + 223, mY + 2, { width: 49, align: 'center' });
                }

                mY += rowHeight;
            });

            // Fila TOTALES (Simplificada: Solo mostrar el monto final que es el 100% del valor)
            const rowHeightTotal = 13;
            const montoPagarBS = parseFloat(guiaData.monto_pagar) || 0;
            const montoRecargoBS = parseFloat(guiaData.monto_recargo) || 0;
            const totalFinalBS = montoPagarBS + montoRecargoBS;
            const tasa_bcv = parseFloat(guiaData.tasa_bcv) || 1;

            // Lógica para detectar si monto_usd es el total (100%) o solo el impuesto (2.5% legacy)
            let totalUSD = parseFloat(guiaData.monto_usd) || 0;
            const montoPagarUsdEquiv = tasa_bcv > 0 ? montoPagarBS / tasa_bcv : 0;

            // Si el monto en USD guardado es muy pequeño comparado con el monto en Bolívares al cambio,
            // es porque era una guía vieja que solo guardaba el 2.5% en 'monto_usd'.
            if (totalUSD > 0 && totalUSD < (montoPagarUsdEquiv * 0.5)) {
                totalUSD = totalUSD / 0.025; // Convertir de 2.5% a 100%
            }

            // Espacio en blanco para separar de la tabla
            mY += 2;

            // Fila GRAN TOTAL A PAGAR (100% del Valor de Materiales)
            doc.rect(materialX, mY, 140, rowHeightTotal).fillAndStroke('#1a5f7a', '#1a5f7a');
            doc.rect(materialX + 140, mY, 60, rowHeightTotal).stroke('#000');
            doc.rect(materialX + 200, mY, 75, rowHeightTotal).stroke('#000');
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF').text('TOTAL A PAGAR', materialX + 5, mY + 3);
            doc.fillColor('#000000').text(`Bs. ${(totalFinalBS || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, materialX + 200, mY + 3, { width: 75, align: 'center' });
            mY += rowHeightTotal;

            if (montoRecargoBS > 0) {
                doc.rect(materialX, mY, 140, rowHeightTotal).fillAndStroke('#fff0f0', '#000');
                doc.rect(materialX + 140, mY, 60, rowHeightTotal).stroke('#000');
                doc.rect(materialX + 200, mY, 75, rowHeightTotal).stroke('#000');
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#CF142B').text('RECARGO RETRASO (10%)', materialX + 5, mY + 3);
                doc.text(`Bs. ${montoRecargoBS.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, materialX + 200, mY + 3, { width: 75, align: 'center' });
                mY += rowHeightTotal;
            }

            // Fila TASA BCV / USD
            doc.rect(materialX, mY, 140, rowHeightTotal).fillAndStroke('#f8f9fa', '#000');
            doc.rect(materialX + 140, mY, 60, rowHeightTotal).stroke('#000');
            doc.rect(materialX + 200, mY, 75, rowHeightTotal).stroke('#000');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#666').text(`TASA BCV: ${tasa_bcv.toFixed(2)} | TOTAL USD: $${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, materialX + 5, mY + 4);
            doc.text(`$${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, materialX + 200, mY + 4, { width: 75, align: 'center' });

            // Calcular Y máximo entre vehículo y materiales
            y = Math.max(vY, mY + rowHeight) + 12;

            // ============================================================
            // RUTAS DE TRASLADOS
            // ============================================================
            drawSectionHeader(doc, vehiculoX, y, vehiculoWidth, 'RUTAS DE TRASLADOS');
            y += 15;
            drawLabelValue(doc, vehiculoX, y, vehiculoWidth, 'Dirección de Origen:', '');
            y += 13;
            doc.rect(vehiculoX, y, vehiculoWidth, 15).stroke('#000');
            doc.fontSize(7).font('Helvetica').text(guiaData.origen || '', vehiculoX + 3, y + 4, { width: vehiculoWidth - 6 });
            y += 18;
            drawLabelValue(doc, vehiculoX, y, vehiculoWidth, 'Dirección de Destino:', '');
            y += 13;
            doc.rect(vehiculoX, y, vehiculoWidth, 15).stroke('#000');
            doc.fontSize(7).font('Helvetica').text(guiaData.destino || '', vehiculoX + 3, y + 4, { width: vehiculoWidth - 6 });

            // ============================================================
            // FECHA DE VALIDEZ (al lado de Rutas)
            // ============================================================
            const validezY = y - 59;
            drawSectionHeader(doc, materialX, validezY, materialWidth, 'FECHA DE VALIDEZ');
            let fvY = validezY + 15;
            drawLabelValue(doc, materialX, fvY, materialWidth, 'Fecha de Inicio de fiscalización:', formatDateShort(guiaData.fecha_emision));
            fvY += 15;
            drawLabelValue(doc, materialX, fvY, materialWidth, 'Fecha de Cierre de fiscalización:', formatDateShort(guiaData.fecha_vencimiento));
            fvY += 15;
            drawLabelValue(doc, materialX, fvY, materialWidth, 'Observación:', '');
            fvY += 13;
            doc.rect(materialX, fvY, materialWidth, 25).stroke('#000');
            doc.fontSize(7).font('Helvetica').text(guiaData.observaciones || '', materialX + 3, fvY + 3, { width: materialWidth - 6 });

            y += 15;

            // ============================================================
            // DATOS DEL DESPACHO
            // ============================================================
            drawSectionHeader(doc, marginLeft, y, contentWidth, 'DATOS DEL DESPACHO');
            y += 15;
            drawLabelValue(doc, marginLeft, y, contentWidth, 'Condición del Despacho:', '');
            y += 13;
            doc.rect(marginLeft, y, contentWidth, 20).stroke('#000');
            y += 20;

            // ============================================================
            // FIRMAS
            // ============================================================
            const firmaWidth = contentWidth / 2 - 10;
            doc.rect(marginLeft, y, firmaWidth, 35).stroke('#000');
            doc.rect(marginLeft + firmaWidth + 20, y, firmaWidth, 35).stroke('#000');

            doc.fontSize(8).font('Helvetica-Bold');
            doc.text('Autorizado por:', marginLeft + 5, y + 5);
            doc.text('Recibe Conforme:', marginLeft + firmaWidth + 25, y + 5);

            // ============================================================
            // QR CODE (Esquina inferior izquierda, GRANDE)
            // ============================================================
            let finalY = y + 45; // Debajo de las firmas
            const newQrSize = 130;
            
            try {
                const qrBuffer = await generateQRBuffer(guiaData.id, guiaData.qr_code_data);
                doc.image(qrBuffer, marginLeft, finalY, { width: newQrSize });
                
                // Texto instruccional al lado del QR
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a5f7a');
                doc.text('CÓDIGO DE VERIFICACIÓN OFICIAL', marginLeft + newQrSize + 15, finalY + (newQrSize / 2) - 15, { width: 150 });
                
                doc.fontSize(8).font('Helvetica').fillColor('#666');
                doc.text('Escanee este código QR con su dispositivo para comprobar la validez de esta guía en el sistema central de la Gobernación del Estado La Guaira.', marginLeft + newQrSize + 15, finalY + (newQrSize/2), { width: 200, align: 'justify' });
            } catch (e) {
                console.error('Error generando QR:', e);
            }

            // Hash de seguridad
            doc.fontSize(5).fillColor('#999');
            doc.text(`ID: ${guiaData.id}`, marginLeft, pageHeight - 25, { width: 200 });
            if (guiaData.hash_documento) {
                doc.text(`Hash: ${guiaData.hash_documento}`, marginLeft, pageHeight - 18, { width: 300 });
            }

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

// ============================================================
// FUNCIONES AUXILIARES PARA DIBUJAR
// ============================================================

function drawCell(doc, x, y, width, height, text, isHeader = false, bgColor = null) {
    if (bgColor) {
        doc.rect(x, y, width, height).fillAndStroke(bgColor, '#000');
    } else {
        doc.rect(x, y, width, height).stroke('#000');
    }
    doc.fontSize(isHeader ? 7 : 8)
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor('#000')
        .text(text, x + 3, y + (height - 8) / 2, { width: width - 6, align: isHeader ? 'left' : 'left' });
}

function drawSectionHeader(doc, x, y, width, text) {
    doc.rect(x, y, width, 14).fillAndStroke('#d0d0d0', '#000');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
    doc.text(text, x, y + 3, { width: width, align: 'center' });
}

function drawLabelValue(doc, x, y, width, label, value) {
    doc.rect(x, y, width, 13).stroke('#000');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000');
    doc.text(label, x + 3, y + 3);
    const labelWidth = doc.widthOfString(label) + 5;
    doc.font('Helvetica').text(value || '', x + labelWidth + 5, y + 3, { width: width - labelWidth - 10 });
}

function formatDateShort(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    try {
        const formatter = new Intl.DateTimeFormat('es-VE', {
            timeZone: 'America/Caracas',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        return formatter.format(d);
    } catch (e) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    try {
        return d.toLocaleDateString('es-VE', {
            timeZone: 'America/Caracas',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return d.toLocaleDateString('es-VE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

/**
 * Formatea la hora en formato HH:MM:SS
 * @param {Date|String} date - Fecha a formatear
 * @returns {String} Hora formateada
 */
function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Caracas',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return formatter.format(d);
    } catch (e) {
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // La hora '0' debe ser '12'
        
        return `${hours}:${minutes} ${ampm}`;
    }
}

module.exports = {
    generateGuiaPDF
};
