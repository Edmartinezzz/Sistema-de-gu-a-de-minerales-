const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('❌ ERROR: DATABASE_URL no está en el .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('📖 Leyendo migration_directorios.sql...');
        const migrationPath = path.join(__dirname, 'database', 'migration_directorios.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🚀 Ejecutando script SQL de migración en Supabase...');
        await pool.query(sql);

        console.log('✅ ¡Migración de directorios aplicada exitosamente!');
        
        // Verificar las tablas
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN ('cantera_clientes', 'cantera_choferes', 'cantera_vehiculos')
        `);
        console.log('📊 Tablas creadas:');
        tableCheck.rows.forEach(r => console.log(`  • ${r.table_name}`));

        await pool.end();
    } catch (error) {
        console.error('❌ Error ejecutando migración:', error.message);
        process.exit(1);
    }
}

runMigration();
