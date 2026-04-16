const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

class GoogleContactsService {
    constructor() {
        const authConfig = {
            scopes: [
                'https://www.googleapis.com/auth/contacts',
                'https://www.googleapis.com/auth/contacts.readonly'
            ],
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
                console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_JSON in ContactsService:', error.message);
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
                    console.error('Error parsing GOOGLE_APPLICATION_CREDENTIALS JSON in ContactsService:', error.message);
                }
            } else {
                authConfig.keyFile = googleAppCreds;
            }
        }

        if (!authConfig.credentials && !authConfig.keyFile) {
            authConfig.keyFile = path.join(__dirname, 'google-credentials.json');
        }

        this.auth = new google.auth.GoogleAuth(authConfig);
        this.people = google.people({ version: 'v1', auth: this.auth });
    }

    async syncMember(member, type) {
        try {
            const memberId = member.memberId || member.MemberId;
            const name = member.name || member.Name;
            const mobile = member.mobile || member.Mobile;
            const city = member.city || member.City;

            if (!memberId || !name) {
                console.log('Skipping contact sync: missing memberId or name');
                return;
            }

            const prefix = type === 'Ajivan' ? 'A' : 'S';
            const contactName = `UBS - ${prefix} - ${memberId} ${name}`;

            // Search for existing contact with this memberId in the name
            // We search for "UBS - {prefix} - {memberId}" to find the contact
            const searchPattern = `UBS - ${prefix} - ${memberId}`;
            const existingContact = await this.findContactByPattern(searchPattern);

            const contactData = {
                names: [{ displayName: contactName, givenName: contactName }],
                phoneNumbers: mobile ? [{ value: mobile, type: 'mobile' }] : [],
                addresses: city ? [{ city: city, type: 'home' }] : [],
                notes: `System ID: ${member._id || ''}, Member ID: ${memberId}, Type: ${type}`
            };

            if (existingContact) {
                console.log(`Updating existing contact for ${searchPattern}`);
                await this.people.people.updateContact({
                    resourceName: existingContact.resourceName,
                    updatePersonFields: 'names,phoneNumbers,addresses,notes',
                    requestBody: {
                        ...contactData,
                        etag: existingContact.etag
                    }
                });
            } else {
                console.log(`Creating new contact: ${contactName}`);
                await this.people.people.createContact({
                    requestBody: contactData
                });
            }
        } catch (error) {
            console.error('Error syncing contact to Google:', error.response?.data || error.message);
        }
    }

    async findContactByExactName(exactName) {
        try {
            const response = await this.people.people.searchContacts({
                query: exactName,
                readMask: 'names,metadata'
            });

            if (response.data.results && response.data.results.length > 0) {
                const match = response.data.results.find(res => {
                    const name = res.person.names?.[0]?.displayName || '';
                    return name === exactName;
                });
                
                if (match) {
                    const person = await this.people.people.get({
                        resourceName: match.person.resourceName,
                        personFields: 'names,metadata'
                    });
                    return person.data;
                }
            }
            return null;
        } catch (error) {
            console.error('Error searching contacts:', error.message);
            return null;
        }
    }

    async findContactByPattern(pattern) {
        try {
            const response = await this.people.people.searchContacts({
                query: pattern,
                readMask: 'names,metadata'
            });

            if (response.data.results && response.data.results.length > 0) {
                // Return the first one that starts with the pattern (likely the correct memberId)
                const match = response.data.results.find(res => {
                    const name = res.person.names?.[0]?.displayName || '';
                    return name.startsWith(pattern);
                });
                
                if (match) {
                    const person = await this.people.people.get({
                        resourceName: match.person.resourceName,
                        personFields: 'names,metadata'
                    });
                    return person.data;
                }
            }
            return null;
        } catch (error) {
            console.error('Error searching contacts by pattern:', error.message);
            return null;
        }
    }

    async deleteContact(memberId, name, type) {
        try {
            const prefix = type === 'Ajivan' ? 'A' : 'S';
            const contactName = `UBS - ${prefix} - ${memberId} ${name}`;
            const contact = await this.findContactByExactName(contactName);
            
            if (contact) {
                await this.people.people.deleteContact({
                    resourceName: contact.resourceName
                });
                console.log(`Deleted contact: ${contactName}`);
            }
        } catch (error) {
            console.error('Error deleting contact from Google:', error.message);
        }
    }
}

module.exports = new GoogleContactsService();
