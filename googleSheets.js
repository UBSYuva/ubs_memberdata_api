const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

class GoogleSheetsService {
    constructor() {
        this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
        this.cache = {};
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes default TTL
        
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

    _clearCache(sheetName) {
        if (!sheetName) {
            this.cache = {};
        } else {
            delete this.cache[sheetName];
        }
    }

    async ensureHeaders(sheetName, keys) {
        try {
            const headersResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!1:1`,
            });
            let headers = headersResponse.data.values ? headersResponse.data.values[0] : [];
            const missing = keys.filter(k => k && !headers.includes(k));
            
            if (missing.length > 0) {
                headers = [...headers, ...missing];
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: `${sheetName}!1:1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [headers] },
                });
                this._clearCache(sheetName);
            }
        } catch (error) {
            console.error(`Error ensuring headers in ${sheetName}:`, error);
        }
    }

    async getRows(sheetName, forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this.cache[sheetName] && (now - this.cache[sheetName].timestamp < this.cacheTTL)) {
            return this.cache[sheetName].data;
        }

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:Z`,
            });
            const rows = response.data.values;
            if (!rows || rows.length === 0) return [];

            const headers = rows[0];
            const data = rows.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index];
                });
                return obj;
            });

            this.cache[sheetName] = {
                timestamp: now,
                data: data
            };

            return data;
        } catch (error) {
            console.error(`Error getting rows from ${sheetName}:`, error);
            throw error;
        }
    }

    async addRow(sheetName, data) {
        this._clearCache(sheetName);
        return this.addRows(sheetName, [data]);
    }

    async addRows(sheetName, dataArray) {
        this._clearCache(sheetName);
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
        this._clearCache(sheetName);
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
        this._clearCache(sheetName);
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
        this._clearCache(sheetName);
        try {
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:Z`,
            });

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
    async batchUpdateRows(sheetName, updates) {
        if (!updates || updates.length === 0) return;
        this._clearCache(sheetName);
        try {
            const rowsResponse = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:Z`,
            });
            const rows = rowsResponse.data.values;
            const headers = rows[0];
            
            const dataToUpdate = updates.map(update => {
                const { idColumn, idValue, data } = update;
                const idIndex = headers.indexOf(idColumn);
                if (idIndex === -1) throw new Error(`Column ${idColumn} not found`);
                
                const rowIndex = rows.findIndex(row => row[idIndex] === idValue.toString());
                if (rowIndex === -1) return null;

                const updatedRow = headers.map(header => data[header] !== undefined ? data[header] : '');
                return {
                    range: `${sheetName}!A${rowIndex + 1}`,
                    values: [updatedRow]
                };
            }).filter(u => u !== null);

            if (dataToUpdate.length > 0) {
                await this.sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    resource: {
                        valueInputOption: 'USER_ENTERED',
                        data: dataToUpdate
                    }
                });
            }
        } catch (error) {
            console.error(`Error batch updating rows in ${sheetName}:`, error);
            throw error;
        }
    }
}

module.exports = new GoogleSheetsService();
