const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth.routes');
const guiasRoutes = require('./routes/guias.routes');
const pagosRoutes = require('./routes/pagos.routes');
const reportesRoutes = require('./routes/reportes.routes');
const confirmacionesRoutes = require('./routes/confirmaciones.routes');
const empresasRoutes = require('./routes/empresas.routes');
const sistemaRoutes = require('./routes/sistema.routes');
const mineralesRoutes = require('./routes/minerales.routes');
const directoriosRoutes = require('./routes/directorios.routes');
const currencyService = require('./services/currencyService');

const app = express();
const PORT = process.env.PORT || 3000;

// Necesario para que el rate limiter detecte correctamente las IPs en Vercel
app.set('trust proxy', 1);

// ===== MIDDLEWARE DE SEGURIDAD =====
// Disable CSP from helmet - the Capacitor WebView handles its own security
app.use(helmet({
    contentSecurityPolicy: false
}));

// Manual CORS & OPTIONS handling to ensure Vercel/Capacitor compatibility
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Explicitly handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// ===== MIDDLEWARE GENERAL =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting para todas las rutas API
app.use('/api/', apiLimiter);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ===== RUTAS API =====
app.use('/api/auth', authRoutes);
app.use('/api/guias', guiasRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/confirmaciones', confirmacionesRoutes);
app.use('/api/tracking', require('./routes/tracking.routes'));
app.use('/api/empresas', empresasRoutes);
app.use('/api/sistema', sistemaRoutes);
app.use('/api/minerales', mineralesRoutes);
app.use('/api/directorios', directoriosRoutes);
app.use('/api/stats', require('./routes/stats.routes'));

// ===== RUTA DE SALUD =====
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Sistema de Minerales La Guaira'
    });
});

// ===== PÁGINA DE VERIFICACIÓN PÚBLICA =====
app.get('/verificar/:id?', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/verificar.html'));
});

// ===== RUTA PRINCIPAL =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ===== MANEJO DE ERRORES 404 =====
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada'
    });
});

// ===== MANEJO DE ERRORES GLOBAL =====
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);

    if (err.name === 'MulterError') {
        return res.status(400).json({
            error: 'Error al subir archivo: ' + err.message
        });
    }

    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Error interno del servidor'
            : err.message
    });
});

// ===== INICIAR SERVIDOR =====
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log('╔═══════════════════════════════════════════════════════════╗');
        console.log('║  Sistema de Movilización y Control de Minerales          ║');
        console.log('║  Estado La Guaira                                         ║');
        console.log('╚═══════════════════════════════════════════════════════════╝');
        console.log('');
        console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
        console.log(`🌐 URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
        console.log(`📝 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log('');
        console.log('✓ Sistema listo para recibir solicitudes');
        console.log('');
    });
}

module.exports = app;
