const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

class GoogleSheetsService {
    constructor() {
        this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
        
        const authConfig = {
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        };

        let serviceAccountJson = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
        if ((serviceAccountJson.startsWith("'") && serviceAccountJson.endsWith("'")) || 
            (serviceAccountJson.startsWith('"') && serviceAccountJson.endsWith('"'))) {
            serviceAccountJson = serviceAccountJson.substring(1, serviceAccountJson.length - 1).trim();
        }

        if (serviceAccountJson) {
            try {
                const creds = JSON.parse(serviceAccountJson);
                if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
                authConfig.credentials = creds;
            } catch (error) {
                console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON:', error.message);
            }
        }

        let googleAppCreds = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
        
        // Strip surrounding quotes if the string is wrapped in them (common in some env setups)
        if ((googleAppCreds.startsWith("'") && googleAppCreds.endsWith("'")) || 
            (googleAppCreds.startsWith('"') && googleAppCreds.endsWith('"'))) {
            googleAppCreds = googleAppCreds.substring(1, googleAppCreds.length - 1).trim();
        }

        if (!authConfig.credentials && googleAppCreds) {
            if (googleAppCreds.startsWith('{')) {
                try {
                    const creds = JSON.parse(googleAppCreds);
                    if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
                    authConfig.credentials = creds;
                } catch (error) {
                    console.error('Error parsing GOOGLE_APPLICATION_CREDENTIALS JSON:', error.message);
                    // If it's definitely JSON start but parsing failed, don't fallback to keyFile 
                    // to avoid ENAMETOOLONG errors.
                }
            } else {
                authConfig.keyFile = googleAppCreds;
            }
        }

        if (!authConfig.credentials && !authConfig.keyFile) {
            authConfig.keyFile = path.join(__dirname, 'google-credentials.json');
        }

        this.auth = new google.auth.GoogleAuth(authConfig);
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    }

    async getRows(sheetName) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:Z`,
            });
            const rows = response.data.values;
            if (!rows || rows.length === 0) return [];

            const headers = rows[0];
            return rows.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index];
                });
                return obj;
            });
        } catch (error) {
            console.error(`Error getting rows from ${sheetName}:`, error);
            throw error;
        }
    }

    async addRow(sheetName, data) {
        return this.addRows(sheetName, [data]);
    }

    async addRows(sheetName, dataArray) {
        try {
            const headersResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!1:1`,
            });
            const headers = headersResponse.data.values[0];
            const rowsToAppend = dataArray.map(data => headers.map(header => data[header] ?? ''));

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: rowsToAppend },
            });
        } catch (error) {
            console.error(`Error adding rows to ${sheetName}:`, error);
            throw error;
        }
    }

    async updateRow(sheetName, idColumn, idValue, data) {
        try {
            const rowsResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:Z`,
            });
            const rows = rowsResponse.data.values;
            const headers = rows[0];
            const idIndex = headers.indexOf(idColumn);
            
            if (idIndex === -1) throw new Error(`Column ${idColumn} not found`);

            const rowIndex = rows.findIndex(row => row[idIndex] === idValue.toString());
            if (rowIndex === -1) throw new Error(`Row with ${idColumn}=${idValue} not found`);

            const updatedRow = headers.map(header => data[header] !== undefined ? data[header] : '');

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A${rowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [updatedRow] },
            });
        } catch (error) {
            console.error(`Error updating row in ${sheetName}:`, error);
            throw error;
        }
    }

    async deleteRow(sheetName, idColumn, idValue) {
        try {
            const rowsResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:Z`,
            });
            const rows = rowsResponse.data.values;
            const headers = rows[0];
            const idIndex = headers.indexOf(idColumn);
            
            if (idIndex === -1) throw new Error(`Column ${idColumn} not found`);

            const rowIndex = rows.findIndex(row => row[idIndex] === idValue.toString());
            if (rowIndex === -1) throw new Error(`Row with ${idColumn}=${idValue} not found`);

            const sheetIdResponse = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            const sheet = sheetIdResponse.data.sheets.find(s => s.properties.title === sheetName);
            const sheetId = sheet.properties.sheetId;

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex,
                                endIndex: rowIndex + 1
                            }
                        }
                    }]
                }
            });
        } catch (error) {
            console.error(`Error deleting row from ${sheetName}:`, error);
            throw error;
        }
    }

    async createSheetIfNotExists(title) {
        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            const sheet = response.data.sheets.find(s => s.properties.title === title);
            
            if (!sheet) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: { title }
                            }
                        }]
                    }
                });
                console.log(`Sheet "${title}" created.`);
            }
        } catch (error) {
            console.error(`Error creating sheet ${title}:`, error);
            throw error;
        }
    }

    async updateEntireSheet(sheetName, data) {
        try {
            // First, clear existing content
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:Z`,
            });

            // Then, update with new data
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: data },
            });
            console.log(`Sheet "${sheetName}" updated with ${data.length} rows.`);
        } catch (error) {
            console.error(`Error updating entire sheet ${sheetName}:`, error);
            throw error;
        }
    }
}

module.exports = new GoogleSheetsService();
