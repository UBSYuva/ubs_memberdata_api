const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const googleSheets = require('../googleSheets');

const SHEETS = {
    MEMBERS: 'mst_member',
    RELATION: 'mst_relation',
    MARRIAGE_STATUS: 'mst_marriagestatus',
    CITY: 'mst_city',
    PROFESSION: 'mst_profession',
    BLOODGROUP: 'mst_bloodgroup'
};

const migrate = async () => {
    try {
        console.log('Fetching members data...');
        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        
        const masters = {
            [SHEETS.RELATION]: { column: 'relation', header: 'relation' },
            [SHEETS.MARRIAGE_STATUS]: { column: 'marriagestatus', header: 'marriageStatus' },
            [SHEETS.CITY]: { column: 'city', header: 'city' },
            [SHEETS.PROFESSION]: { column: 'profession', header: 'profession' },
            [SHEETS.BLOODGROUP]: { column: 'bloodGroup', header: 'bloodGroup' }
        };

        for (const [sheetTitle, config] of Object.entries(masters)) {
            console.log(`Migrating ${sheetTitle}...`);
            await googleSheets.createSheetIfNotExists(sheetTitle);
            
            let uniqueValues = [...new Set(rows.map(r => r[config.column]).filter(v => v && v !== '' && v !== 'null'))].sort();
            
            // Add defaults for marriage status if empty
            if (sheetTitle === SHEETS.MARRIAGE_STATUS && uniqueValues.length === 0) {
               uniqueValues = ['Married', 'Unmarried', 'Widow', 'Widower', 'Divorced'];
            }
            
            const dataToUpload = [
                [config.header], // Header
                ...uniqueValues.map(v => [v])
            ];
            
            await googleSheets.updateEntireSheet(sheetTitle, dataToUpload);
        }
        
        console.log('Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err.message);
    }
};

migrate();
