const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { uploadFile } = require('../services/supabaseService');
const { generateUUID } = require('../utils/security');

// Configuración de Multer para subir logos
// Configuración de Multer en memoria para logos
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, webp)'));
    }
});

// GET /api/empresas/perfil - Obtener perfil de la empresa actual
router.get('/perfil', authenticateToken, requireRole(['empresa', 'contribuyente']), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, rif, razon_social, direccion, telefono, email, representante_legal, logo_url, created_at FROM empresas WHERE id = $1',
            [req.user.empresaId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Empresa no encontrada' });
        }

        res.json({ success: true, empresa: result.rows[0] });
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/empresas/perfil/logo - Subir/Actualizar logo
router.put('/perfil/logo', authenticateToken, requireRole(['empresa', 'contribuyente']), upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ninguna imagen' });
        }

        // Subir a Supabase Storage
        const fileExt = path.extname(req.file.originalname);
        const fileName = `logos/${req.user.empresaId}_${generateUUID()}${fileExt}`;
        const logoUrl = await uploadFile(req.file.buffer, fileName, 'public_assets');

        // Actualizar en BD
        await pool.query(
            'UPDATE empresas SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [logoUrl, req.user.empresaId]
        );

        res.json({
            success: true,
            message: 'Logo actualizado correctamente',
            logo_url: logoUrl
        });

    } catch (error) {
        console.error('Error subiendo logo:', error);
        res.status(500).json({ error: 'Error al subir la imagen' });
    }
});

// PUT /api/empresas/perfil - Actualizar datos básicos (Opcional por ahora)
router.put('/perfil', authenticateToken, requireRole(['empresa', 'contribuyente']), async (req, res) => {
    const { direccion, telefono, email, representante_legal } = req.body;
    try {
        await pool.query(
            'UPDATE empresas SET direccion = $1, telefono = $2, email = $3, representante_legal = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
            [direccion, telefono, email, representante_legal, req.user.empresaId]
        );
        res.json({ success: true, message: 'Perfil actualizado exitosamente' });
    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
});

// GET /api/empresas - Listar todas las empresas (Solo Master)
router.get('/', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, rif, razon_social, activo FROM empresas ORDER BY razon_social ASC'
        );
        res.json({ success: true, empresas: result.rows });
    } catch (error) {
        console.error('Error listando empresas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
