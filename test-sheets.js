const googleSheets = require('./googleSheets');
require('dotenv').config();

async function testConnection() {
    console.log('--- Testing Google Sheets Connection ---');
    console.log('Spreadsheet ID:', process.env.GOOGLE_SHEET_ID);
    console.log('Credentials Path:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

    try {
        const sheets = ['mst_member', 'mst_subhechhak', 'donation', 'configuration'];
        for (const sheet of sheets) {
            console.log(`\nFetching data from sheet: ${sheet}...`);
            const rows = await googleSheets.getRows(sheet);
            console.log(`Successfully fetched ${rows.length} rows.`);
            if (rows.length > 0) {
                console.log('First row sample:', rows[0]);
            }
        }
        console.log('\n--- Connection Test Passed! ---');
    } catch (error) {
        console.error('\n--- Connection Test Failed! ---');
        console.error(error.message);
        console.log('\nPossible reasons:');
        console.log('1. GOOGLE_SHEET_ID in .env is incorrect.');
        console.log('2. Service account JSON file is missing or path is wrong.');
        console.log('3. Spreadsheet is not shared with the service account email.');
        console.log('4. Google Sheets API is not enabled in Google Cloud Console.');
    }
}

testConnection();
