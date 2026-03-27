const googleSheets = require('./googleSheets');
const SHEETS = {
    MEMBERS: 'mst_member',
    SHUBHECHHAK: 'mst_subhechhak'
};

(async () => {
    try {
        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        if (rows.length > 0) {
            console.log('Member Headers:', Object.keys(rows[0]));
        }
        const sRows = await googleSheets.getRows(SHEETS.SHUBHECHHAK);
        if (sRows.length > 0) {
            console.log('Shubhechhak Headers:', Object.keys(sRows[0]));
        }
    } catch (e) {
        console.error(e);
    }
})();
