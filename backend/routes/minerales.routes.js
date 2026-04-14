const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/minerales
 * Listar todos los minerales activos (público/autenticado)
 */
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, nombre FROM tipos_minerales WHERE activo = true ORDER BY nombre ASC'
        );
        res.json({
            success: true,
            minerales: result.rows
        });
    } catch (error) {
        console.error('Error al obtener minerales:', error);
        res.status(500).json({ error: 'Error al obtener minerales' });
    }
});

/**
 * GET /api/minerales/todos
 * Listar todos los minerales incluyendo inactivos (solo master)
 */
router.get('/todos', authenticateToken, requireRole(['master']), async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM tipos_minerales ORDER BY nombre ASC'
        );
        res.json({
            success: true,
            minerales: result.rows
        });
    } catch (error) {
        console.error('Error al obtener todos los minerales:', error);
        res.status(500).json({ error: 'Error al obtener minerales: ' + error.message });
    }
});

/**
 * POST /api/minerales
 * Crear un nuevo tipo de mineral (solo master)
 */
router.post('/', authenticateToken, requireRole(['master']), async (req, res) => {
    const { nombre } = req.body;

    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre del mineral es requerido' });
    }

    try {
        const result = await db.query(
            'INSERT INTO tipos_minerales (nombre) VALUES ($1) RETURNING *',
            [nombre.trim()]
        );

        await db.query(
            'INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, 'crear_mineral', 'tipos_minerales', result.rows[0].id, JSON.stringify(result.rows[0])]
        );

        res.status(201).json({
            success: true,
            message: 'Mineral creado exitosamente',
            mineral: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Ya existe un mineral con ese nombre' });
        }
        console.error('Error al crear mineral:', error);
        res.status(500).json({ error: 'Error al crear mineral' });
    }
});

/**
 * PUT /api/minerales/:id
 * Actualizar un mineral o cambiar su estado (solo master)
 */
router.put('/:id', authenticateToken, requireRole(['master']), async (req, res) => {
    const { id } = req.params;
    const { nombre, activo } = req.body;

    try {
        // Obtener datos actuales para auditoría
        const current = await db.query('SELECT * FROM tipos_minerales WHERE id = $1', [id]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Mineral no encontrado' });
        }

        const result = await db.query(
            `UPDATE tipos_minerales 
             SET nombre = COALESCE($1, nombre), 
                 activo = COALESCE($2, activo),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 RETURNING *`,
            [nombre ? nombre.trim() : null, activo !== undefined ? activo : null, id]
        );

        await db.query(
            'INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos) VALUES ($1, $2, $3, $4, $5, $6)',
            [req.user.id, 'actualizar_mineral', 'tipos_minerales', id, JSON.stringify(current.rows[0]), JSON.stringify(result.rows[0])]
        );

        res.json({
            success: true,
            message: 'Mineral actualizado exitosamente',
            mineral: result.rows[0]
        });
    } catch (error) {
        console.error('Error al actualizar mineral:', error);
        res.status(500).json({ error: 'Error al actualizar mineral' });
    }
});

/**
 * DELETE /api/minerales/:id
 * Eliminar un mineral (solo master)
 */
router.delete('/:id', authenticateToken, requireRole(['master']), async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query('DELETE FROM tipos_minerales WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mineral no encontrado' });
        }

        await db.query(
            'INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, 'eliminar_mineral', 'tipos_minerales', id, JSON.stringify(result.rows[0])]
        );

        res.json({
            success: true,
            message: 'Mineral eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar mineral:', error);
        res.status(500).json({ error: 'Error al eliminar mineral' });
    }
});

module.exports = router;
