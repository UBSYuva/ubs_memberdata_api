const googleSheets = require('./googleSheets');

async function setupPins() {
    try {
        console.log('Fetching configuration rows...');
        const rows = await googleSheets.getRows('configuration');
        
        const pins = [
            { key: 'adminPin', value: '2026' },
            { key: 'viewMembersPin', value: '1111' },
            { key: 'donationInvoicePin', value: '2222' }
        ];

        for (const pin of pins) {
            const existing = rows.find(r => r.key === pin.key);
            if (!existing) {
                console.log(`Adding ${pin.key}...`);
                await googleSheets.addRow('configuration', pin);
            } else {
                console.log(`${pin.key} already exists with value: ${existing.value}`);
            }
        }
        console.log('Setup complete!');
    } catch (err) {
        console.error('Error during setup:', err);
    }
}

setupPins();
