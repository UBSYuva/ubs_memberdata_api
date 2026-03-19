const pool = require('./db');
const googleSheets = require('./googleSheets');
require('dotenv').config();

async function migrateData() {
    console.log('--- Starting MySQL to Google Sheets Migration ---');
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to MySQL database.');

        // 1. Get all tables
        const [tables] = await connection.query('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log(`Found ${tableNames.length} tables: ${tableNames.join(', ')}`);

        for (const tableName of tableNames) {
            console.log(`\nMigrating table: ${tableName}...`);

            // 2. Fetch data and column info
            const [rows, fields] = await connection.query(`SELECT * FROM ${tableName}`);
            const headers = fields.map(f => f.name);
            console.log(`Fetched ${rows.length} rows from ${tableName}.`);

            // 3. Prepare data for Google Sheets
            // Format: [ [header1, header2, ...], [row1val1, row1val2, ...], ... ]
            const sheetData = [headers];
            rows.forEach(row => {
                const rowValues = headers.map(header => {
                    const val = row[header];
                    // Handle Date objects and nulls
                    if (val instanceof Date) return val.toISOString().slice(0, 10);
                    if (val === null) return '';
                    return val.toString();
                });
                sheetData.push(rowValues);
            });

            // 4. Create sheet tab if it doesn't exist
            await googleSheets.createSheetIfNotExists(tableName);

            // 5. Push data to Google Sheets
            await googleSheets.updateEntireSheet(tableName, sheetData);
            console.log(`Successfully migrated ${tableName}.`);
        }

        console.log('\n--- Migration Completed Successfully! ---');
    } catch (error) {
        console.error('\n--- Migration Failed! ---');
        console.error(error);
    } finally {
        if (connection) connection.release();
        // Force exit as pool might keep process alive
        process.exit();
    }
}

migrateData();
