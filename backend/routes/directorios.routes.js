const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { sanitizeInput } = require('../utils/security');

const router = express.Router();

// Validar que el usuario tenga un empresaId asignado
const requireEmpresaId = (req, res, next) => {
    if (!req.user || !req.user.empresaId) {
        return res.status(403).json({ error: 'Acceso denegado. Este usuario no está asociado a una empresa.' });
    }
    next();
};

// Aplicar seguridad a todas las rutas de este enrutador
router.use(authenticateToken);
router.use(requireRole(['empresa']));
router.use(requireEmpresaId);

// ==========================================
// 1. DIRECTORIO DE CLIENTES
// ==========================================

// GET: Listar clientes de la cantera
router.get('/clientes', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM cantera_clientes WHERE empresa_id = $1 ORDER BY nombre ASC',
            [req.user.empresaId]
        );
        res.json({ success: true, clientes: result.rows });
    } catch (error) {
        console.error('Error al obtener clientes del directorio:', error);
        res.status(500).json({ error: 'Error al obtener clientes del directorio.' });
    }
});

// POST: Agregar un cliente al directorio
router.post('/clientes', async (req, res) => {
    try {
        const { rif, nombre, direccion, telefono } = req.body;

        if (!rif || !nombre) {
            return res.status(400).json({ error: 'RIF y Nombre son obligatorios.' });
        }

        const cleanRif = sanitizeInput(rif).trim().toUpperCase();
        const cleanNombre = sanitizeInput(nombre).trim();
        const cleanDireccion = direccion ? sanitizeInput(direccion).trim() : null;
        const cleanTelefono = telefono ? sanitizeInput(telefono).trim() : null;

        // Verificar duplicados para esta empresa
        const dupCheck = await db.query(
            'SELECT id FROM cantera_clientes WHERE empresa_id = $1 AND rif = $2',
            [req.user.empresaId, cleanRif]
        );

        if (dupCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe un cliente con este RIF en tu directorio.' });
        }

        const result = await db.query(
            `INSERT INTO cantera_clientes (empresa_id, rif, nombre, direccion, telefono) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [req.user.empresaId, cleanRif, cleanNombre, cleanDireccion, cleanTelefono]
        );

        res.status(201).json({ success: true, cliente: result.rows[0], message: 'Cliente guardado en el directorio.' });
    } catch (error) {
        console.error('Error al guardar cliente en el directorio:', error);
        res.status(500).json({ error: 'Error al guardar cliente en el directorio.' });
    }
});

// PUT: Modificar un cliente
router.put('/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rif, nombre, direccion, telefono } = req.body;

        if (!rif || !nombre) {
            return res.status(400).json({ error: 'RIF y Nombre son obligatorios.' });
        }

        const cleanRif = sanitizeInput(rif).trim().toUpperCase();
        const cleanNombre = sanitizeInput(nombre).trim();
        const cleanDireccion = direccion ? sanitizeInput(direccion).trim() : null;
        const cleanTelefono = telefono ? sanitizeInput(telefono).trim() : null;

        // Verificar que exista y pertenezca a la empresa
        const clientCheck = await db.query(
            'SELECT id FROM cantera_clientes WHERE id = $1 AND empresa_id = $2',
            [id, req.user.empresaId]
        );

        if (clientCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado en tu directorio.' });
        }

        // Verificar duplicados de RIF con otros clientes
        const dupCheck = await db.query(
            'SELECT id FROM cantera_clientes WHERE empresa_id = $1 AND rif = $2 AND id <> $3',
            [req.user.empresaId, cleanRif, id]
        );

        if (dupCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe otro cliente con este RIF en tu directorio.' });
        }

        const result = await db.query(
            `UPDATE cantera_clientes 
             SET rif = $1, nombre = $2, direccion = $3, telefono = $4, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $5 AND empresa_id = $6 
             RETURNING *`,
            [cleanRif, cleanNombre, cleanDireccion, cleanTelefono, id, req.user.empresaId]
        );

        res.json({ success: true, cliente: result.rows[0], message: 'Cliente actualizado correctamente.' });
    } catch (error) {
        console.error('Error al actualizar cliente del directorio:', error);
        res.status(500).json({ error: 'Error al actualizar cliente del directorio.' });
    }
});

// DELETE: Eliminar un cliente
router.delete('/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM cantera_clientes WHERE id = $1 AND empresa_id = $2 RETURNING *',
            [id, req.user.empresaId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado en tu directorio.' });
        }

        res.json({ success: true, message: 'Cliente eliminado del directorio.' });
    } catch (error) {
        console.error('Error al eliminar cliente del directorio:', error);
        res.status(500).json({ error: 'Error al eliminar cliente del directorio.' });
    }
});

// ==========================================
// 2. DIRECTORIO DE CHOFERES
// ==========================================

// GET: Listar choferes
router.get('/choferes', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM cantera_choferes WHERE empresa_id = $1 ORDER BY nombre ASC',
            [req.user.empresaId]
        );
        res.json({ success: true, choferes: result.rows });
    } catch (error) {
        console.error('Error al obtener choferes del directorio:', error);
        res.status(500).json({ error: 'Error al obtener choferes del directorio.' });
    }
});

// POST: Agregar chofer
router.post('/choferes', async (req, res) => {
    try {
        const { cedula, nombre, telefono } = req.body;

        if (!cedula || !nombre) {
            return res.status(400).json({ error: 'Cédula y Nombre son obligatorios.' });
        }

        const cleanCedula = sanitizeInput(cedula).trim().toUpperCase();
        const cleanNombre = sanitizeInput(nombre).trim();
        const cleanTelefono = telefono ? sanitizeInput(telefono).trim() : null;

        const dupCheck = await db.query(
            'SELECT id FROM cantera_choferes WHERE empresa_id = $1 AND cedula = $2',
            [req.user.empresaId, cleanCedula]
        );

        if (dupCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe un conductor con esta cédula en tu directorio.' });
        }

        const result = await db.query(
            `INSERT INTO cantera_choferes (empresa_id, cedula, nombre, telefono) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [req.user.empresaId, cleanCedula, cleanNombre, cleanTelefono]
        );

        res.status(201).json({ success: true, chofer: result.rows[0], message: 'Conductor guardado en el directorio.' });
    } catch (error) {
        console.error('Error al guardar conductor en el directorio:', error);
        res.status(500).json({ error: 'Error al guardar conductor en el directorio.' });
    }
});

// PUT: Modificar chofer
router.put('/choferes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { cedula, nombre, telefono } = req.body;

        if (!cedula || !nombre) {
            return res.status(400).json({ error: 'Cédula y Nombre son obligatorios.' });
        }

        const cleanCedula = sanitizeInput(cedula).trim().toUpperCase();
        const cleanNombre = sanitizeInput(nombre).trim();
        const cleanTelefono = telefono ? sanitizeInput(telefono).trim() : null;

        const choferCheck = await db.query(
            'SELECT id FROM cantera_choferes WHERE id = $1 AND empresa_id = $2',
            [id, req.user.empresaId]
        );

        if (choferCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Conductor no encontrado en tu directorio.' });
        }

        const dupCheck = await db.query(
            'SELECT id FROM cantera_choferes WHERE empresa_id = $1 AND cedula = $2 AND id <> $3',
            [req.user.empresaId, cleanCedula, id]
        );

        if (dupCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe otro conductor con esta cédula en tu directorio.' });
        }

        const result = await db.query(
            `UPDATE cantera_choferes 
             SET cedula = $1, nombre = $2, telefono = $3, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $4 AND empresa_id = $5 
             RETURNING *`,
            [cleanCedula, cleanNombre, cleanTelefono, id, req.user.empresaId]
        );

        res.json({ success: true, chofer: result.rows[0], message: 'Conductor actualizado correctamente.' });
    } catch (error) {
        console.error('Error al actualizar conductor del directorio:', error);
        res.status(500).json({ error: 'Error al actualizar conductor del directorio.' });
    }
});

// DELETE: Eliminar chofer
router.delete('/choferes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM cantera_choferes WHERE id = $1 AND empresa_id = $2 RETURNING *',
            [id, req.user.empresaId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conductor no encontrado en tu directorio.' });
        }

        res.json({ success: true, message: 'Conductor eliminado del directorio.' });
    } catch (error) {
        console.error('Error al eliminar conductor del directorio:', error);
        res.status(500).json({ error: 'Error al eliminar conductor del directorio.' });
    }
});

// ==========================================
// 3. DIRECTORIO DE VEHÍCULOS
// ==========================================

// GET: Listar vehículos
router.get('/vehiculos', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM cantera_vehiculos WHERE empresa_id = $1 ORDER BY placa ASC',
            [req.user.empresaId]
        );
        res.json({ success: true, vehiculos: result.rows });
    } catch (error) {
        console.error('Error al obtener vehículos del directorio:', error);
        res.status(500).json({ error: 'Error al obtener vehículos del directorio.' });
    }
});

// POST: Agregar vehículo
router.post('/vehiculos', async (req, res) => {
    try {
        const { placa, marca, modelo, color, carroceria } = req.body;

        if (!placa || !marca || !modelo || !color || !carroceria) {
            return res.status(400).json({ error: 'Placa, Marca, Modelo, Color y Carrocería son obligatorios.' });
        }

        const cleanPlaca = sanitizeInput(placa).trim().toUpperCase();
        const cleanMarca = sanitizeInput(marca).trim();
        const cleanModelo = sanitizeInput(modelo).trim();
        const cleanColor = sanitizeInput(color).trim();
        const cleanCarroceria = sanitizeInput(carroceria).trim();

        const dupCheck = await db.query(
            'SELECT id FROM cantera_vehiculos WHERE empresa_id = $1 AND placa = $2',
            [req.user.empresaId, cleanPlaca]
        );

        if (dupCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe un vehículo con esta placa en tu directorio.' });
        }

        const result = await db.query(
            `INSERT INTO cantera_vehiculos (empresa_id, placa, marca, modelo, color, carroceria) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [req.user.empresaId, cleanPlaca, cleanMarca, cleanModelo, cleanColor, cleanCarroceria]
        );

        res.status(201).json({ success: true, vehiculo: result.rows[0], message: 'Vehículo guardado en el directorio.' });
    } catch (error) {
        console.error('Error al guardar vehículo en el directorio:', error);
        res.status(500).json({ error: 'Error al guardar vehículo en el directorio.' });
    }
});

// PUT: Modificar vehículo
router.put('/vehiculos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { placa, marca, modelo, color, carroceria } = req.body;

        if (!placa || !marca || !modelo || !color || !carroceria) {
            return res.status(400).json({ error: 'Placa, Marca, Modelo, Color y Carrocería son obligatorios.' });
        }

        const cleanPlaca = sanitizeInput(placa).trim().toUpperCase();
        const cleanMarca = sanitizeInput(marca).trim();
        const cleanModelo = sanitizeInput(modelo).trim();
        const cleanColor = sanitizeInput(color).trim();
        const cleanCarroceria = sanitizeInput(carroceria).trim();

        const vehiculoCheck = await db.query(
            'SELECT id FROM cantera_vehiculos WHERE id = $1 AND empresa_id = $2',
            [id, req.user.empresaId]
        );

        if (vehiculoCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Vehículo no encontrado en tu directorio.' });
        }

        const dupCheck = await db.query(
            'SELECT id FROM cantera_vehiculos WHERE empresa_id = $1 AND placa = $2 AND id <> $3',
            [req.user.empresaId, cleanPlaca, id]
        );

        if (dupCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Ya existe otro vehículo con esta placa en tu directorio.' });
        }

        const result = await db.query(
            `UPDATE cantera_vehiculos 
             SET placa = $1, marca = $2, modelo = $3, color = $4, carroceria = $5, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $6 AND empresa_id = $7 
             RETURNING *`,
            [cleanPlaca, cleanMarca, cleanModelo, cleanColor, cleanCarroceria, id, req.user.empresaId]
        );

        res.json({ success: true, vehiculo: result.rows[0], message: 'Vehículo actualizado correctamente.' });
    } catch (error) {
        console.error('Error al actualizar vehículo del directorio:', error);
        res.status(500).json({ error: 'Error al actualizar vehículo del directorio.' });
    }
});

// DELETE: Eliminar vehículo
router.delete('/vehiculos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM cantera_vehiculos WHERE id = $1 AND empresa_id = $2 RETURNING *',
            [id, req.user.empresaId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vehículo no encontrado en tu directorio.' });
        }

        res.json({ success: true, message: 'Vehículo eliminado del directorio.' });
    } catch (error) {
        console.error('Error al eliminar vehículo del directorio:', error);
        res.status(500).json({ error: 'Error al eliminar vehículo del directorio.' });
    }
});

module.exports = router;
