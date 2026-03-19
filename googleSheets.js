const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

class GoogleSheetsService {
    constructor() {
        this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
        
        const authConfig = {
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        };

        if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            try {
                authConfig.credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
            } catch (error) {
                console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON:', error);
            }
        }

        if (!authConfig.credentials) {
            authConfig.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'google-credentials.json');
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
        try {
            const headersResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!1:1`,
            });
            const headers = headersResponse.data.values[0];
            const values = headers.map(header => data[header] || '');

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [values] },
            });
        } catch (error) {
            console.error(`Error adding row to ${sheetName}:`, error);
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
