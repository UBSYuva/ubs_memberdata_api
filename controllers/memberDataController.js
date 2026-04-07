const googleSheets = require('../googleSheets');
const path = require('path');
const fs = require('fs');
const { getBrowser } = require('../browserManager');
const ExcelJS = require('exceljs');
const chromium = require('@sparticuz/chromium');

// Load logo once and convert to Base64 for embedding
let logoBase64 = '';
try {
    const logoBuffer = fs.readFileSync(path.join(__dirname, '..', 'template', 'logo.png'));
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
} catch (error) {
    console.error("Warning: Logo file not found at template/logo.png");
}

// Helper to format Date (consistent with previous implementation)
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    } catch (e) {
        return '';
    }
};

// Helper for unique values (replaces SELECT DISTINCT)
const getUniqueValues = (rows, column) => {
    const values = rows.map(row => row[column]).filter(v => v && v !== '');
    return [...new Set(values)].sort().map(v => ({ [column]: v }));
};

const SHEETS = {
    MEMBERS: 'mst_member',
    SHUBHECHHAK: 'mst_subhechhak',
    DONATION: 'donation',
    CONFIG: 'configuration',
    RELATION: 'mst_relation',
    MARRIAGE_STATUS: 'mst_marriagestatus',
    CITY: 'mst_city',
    PROFESSION: 'mst_profession',
    BLOODGROUP: 'mst_bloodgroup'
};

const ensureMasterValue = async (sheetName, header, value) => {
    if (!value || value === '' || value === 'null') return;
    try {
        const rows = await googleSheets.getRows(sheetName);
        const exists = rows.find(r => (r[header] || '').trim().toLowerCase() === value.trim().toLowerCase());
        if (!exists) {
            await googleSheets.addRow(sheetName, { [header]: value.trim() });
            console.log(`Added new master value "${value}" to ${sheetName}`);
        }
    } catch (e) {
        console.error(`Error ensuring master value in ${sheetName}:`, e.message);
    }
};

// GET: api/MemberData
exports.getAllMembers = async (req, res) => {
    try {
        const [configRows, rows] = await Promise.all([
            googleSheets.getRows(SHEETS.CONFIG),
            googleSheets.getRows(SHEETS.MEMBERS)
        ]);
        const isActive = configRows.find(c => c.key === 'active')?.value?.toLowerCase() === 'true';
        if (!isActive) return res.json([]);
        // Map to expected format and sort
        const formattedRows = rows.map(row => ({
            "Id": row._id,
            "Member Id": row.memberId,
            "Gender": row.gender,
            "Name": row.name,
            "Date Of Birth": row.dateOfBirth,
            "Birth Date": row.dob,
            "Relation": row.relation,
            "Married": row.marriagestatus,
            "Profession": row.profession,
            "Designation": row.designation,
            "Address": row.address,
            "Company": row.companyName,
            "Company Address": row.companyAddress,
            "Mobile": row.mobile,
            "Blood Group": row.bloodGroup,
            "City": row.city,
            "ParentId": row.parentId
        })).sort((a, b) => parseInt(a["Member Id"]) - parseInt(b["Member Id"]));

        res.json(formattedRows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET: api/MemberData/:id
exports.getMemberById = async (req, res) => {
    try {
        const id = req.params.id;
        const [memberRows, shubhechhakRows] = await Promise.all([
            googleSheets.getRows(SHEETS.MEMBERS),
            googleSheets.getRows(SHEETS.SHUBHECHHAK)
        ]);

        let member = memberRows.find(r => r._id === id);
        let isShubhechhak = false;
        
        if (!member) {
            member = shubhechhakRows.find(r => r._id === id);
            isShubhechhak = true;
        }
        
        if (!member) return res.status(404).json({ message: "Not found" });

        // Lead calculation (Self member with same memberId)
        let leadName = '';
        if (!isShubhechhak) {
            const leadMember = memberRows.find(r => r.memberId === member.memberId && r.relation === 'Self');
            leadName = leadMember ? leadMember.name : '';
        }

        const result = {
            "Lead": leadName,
            "Address": member.address,
            "Id": member._id,
            "Member Id": member.memberId,
            "Name": member.name,
            "Date Of Birth": member.dateOfBirth,
            "Birth Date": member.dob,
            "Relation": member.relation,
            "Blood Group": member.bloodGroup,
            "City": member.city,
            "Married": member.marriagestatus,
            "Profession": member.profession,
            "Designation": member.designation,
            "Company": member.companyName,
            "Company Address": member.companyAddress,
            "Mobile": member.mobile,
            "Gender": member.gender,
            "ParentId": member.parentId
        };
        res.json({ "Table": [result] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET: api/MemberData/fetchByMemberId/:memberId
exports.getMemberByMemberId = async (req, res) => {
    try {
        const memberId = req.params.memberId;
        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        const member = rows.find(r => r.memberId === memberId && r.relation === 'Self');
        
        if (!member) return res.status(404).json({ message: "Member not found" });
        
        res.json({
            "Name": member.name,
            "City": member.city,
            "Mobile": member.mobile
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// GET: api/MemberData/shubhechhak
exports.getShubhechhakMembers = async (req, res) => {
    try {
        const [configRows, rows] = await Promise.all([
            googleSheets.getRows(SHEETS.CONFIG),
            googleSheets.getRows(SHEETS.SHUBHECHHAK)
        ]);
        const isActive = configRows.find(c => c.key === 'active')?.value?.toLowerCase() === 'true';
        if (!isActive) return res.json([]);
        const formattedRows = rows.map(row => ({
            "Id": row._id,
            "Member Id": row.memberId,
            "Name": row.name,
            "Gender": row.gender,
            "Date Of Birth": row.dateOfBirth,
            "Birth Date": row.dob,
            "Relation": row.relation,
            "Married": row.marriagestatus,
            "Profession": row.profession,
            "Designation": row.designation,
            "Address": row.address,
            "Company": row.companyName,
            "Company Address": row.companyAddress,
            "Mobile": row.mobile,
            "Blood Group": row.bloodGroup,
            "City": row.city,
            "ParentId": row.parentId
        })).sort((a, b) => parseInt(a["Member Id"]) - parseInt(b["Member Id"]));

        res.json(formattedRows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Master Data Endpoints
exports.getBloodGroups = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.BLOODGROUP);
        res.json(rows.length > 0 ? rows : []);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getRelations = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.RELATION);
        res.json(rows.length > 0 ? rows : []);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getProfessions = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.PROFESSION);
        res.json(rows.length > 0 ? rows : []);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMarriageStatuses = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.MARRIAGE_STATUS);
        res.json(rows.length > 0 ? rows : []);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getCities = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.CITY);
        res.json(rows.length > 0 ? rows : []);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getShubhechhakCities = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.CITY);
        res.json(rows.length > 0 ? rows : []);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// Donation Aggregation (By Year & Month)
exports.getTotalDonation = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.DONATION);
        const aggregation = {};
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        const { filter, date: dateParam } = req.query;
        let filteredRows = [...rows];

        if (filter === 'today') {
            const today = dateParam ? new Date(dateParam) : new Date();
            filteredRows = rows.filter(row => {
                const date = new Date(row.paymentDate);
                return !isNaN(date.getTime()) &&
                    date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
            });
        }

        filteredRows.forEach(row => {
            const dateObj = new Date(row.paymentDate);
            if (isNaN(dateObj.getTime())) return;
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth();
            const dateStr = dateObj.getDate();
            
            // For 'today' filter, we want a daily summary. For normal, we want monthly.
            const key = (filter === 'today') 
                ? `${year}-${month}-${dateStr}` 
                : `${year}-${month.toString().padStart(2, '0')}`;
            
            const amount = parseFloat(row.amount) || 0;

            if (!aggregation[key]) {
                aggregation[key] = { 
                    year, 
                    month, 
                    day: dateStr,
                    monthName: monthNames[month],
                    avgDonation: 0, 
                    totalEntries: 0, 
                    totalDonation: 0 
                };
            }
            aggregation[key].totalEntries += 1;
            aggregation[key].totalDonation += amount;
        });

        const result = Object.values(aggregation)
            .map(item => ({
                ...item,
                avgDonation: item.totalDonation / item.totalEntries
            }))
            .sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.month - a.month;
            });

        res.json(result);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// Donation List (Filtered by Year & Month)
exports.getDonationData = async (req, res) => {
    try {
        const { year, month, filter, date: dateParam } = req.query;
        let rows = await googleSheets.getRows(SHEETS.DONATION);

        if (filter === 'today') {
            const today = dateParam ? new Date(dateParam) : new Date();
            rows = rows.filter(row => {
                const date = new Date(row.paymentDate);
                return !isNaN(date.getTime()) &&
                    date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
            });
        } else if (year) {
            rows = rows.filter(row => {
                const date = new Date(row.paymentDate);
                if (isNaN(date.getTime())) return false;
                
                const matchesYear = date.getFullYear().toString() === year;
                if (!matchesYear) return false;
                
                if (month !== undefined && month !== null && month !== '') {
                    return date.getMonth().toString() === month;
                }
                return true;
            });
        }

        const formattedRows = rows.map(row => ({
            id: row.id,
            "Member Id": row.memberId,
            "Name": row.name,
            "City": row.city,
            "Mobile": row.mobile,
            "Amount": row.amount,
            "PaymentType": row.paymentType,
            "DonationType": row.donationType,
            "PaymentNo": row.paymentNo,
            "PaymentDate": row.paymentDate
        })).sort((a, b) => new Date(b.PaymentDate) - new Date(a.PaymentDate));

        res.json(formattedRows);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET: api/memberdata/appPin
exports.getAppPin = async (req, res) => {
    try {
        const configRows = await googleSheets.getRows(SHEETS.CONFIG);
        
        // Fetch specific pins for each role
        let adminPin = configRows.find(c => c.key === 'adminPin')?.value;
        let viewMembersPin = configRows.find(c => c.key === 'viewMembersPin')?.value;
        let donationInvoicePin = configRows.find(c => c.key === 'donationInvoicePin')?.value;
        let viewOnlyPin = configRows.find(c => c.key === 'viewOnlyPin')?.value;
        const legacyPin = configRows.find(c => c.key === 'appPin')?.value;

        // Proactively create missing pins in googlesheet if they don't exist
        if (!adminPin) {
            adminPin = legacyPin || '2026';
            await googleSheets.addRow(SHEETS.CONFIG, { key: 'adminPin', value: adminPin });
        }
        if (!viewMembersPin) {
            viewMembersPin = '1111';
            await googleSheets.addRow(SHEETS.CONFIG, { key: 'viewMembersPin', value: viewMembersPin });
        }
        if (!donationInvoicePin) {
            donationInvoicePin = '2222';
            await googleSheets.addRow(SHEETS.CONFIG, { key: 'donationInvoicePin', value: donationInvoicePin });
        }
        if (!viewOnlyPin) {
            viewOnlyPin = '3333';
            await googleSheets.addRow(SHEETS.CONFIG, { key: 'viewOnlyPin', value: viewOnlyPin });
        }

        res.json({ 
            admin: adminPin,
            viewMembers: viewMembersPin,
            donationInvoice: donationInvoicePin,
            viewOnly: viewOnlyPin,
            pin: legacyPin || adminPin // Backward compatibility
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Download Donation Data (Excel)
exports.downloadDonationData = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.DONATION);
        const data = rows.map(row => ({
            receiptNo: row.id,
            memberId: row.memberId,
            name: row.name,
            city: row.city,
            mobile: row.mobile,
            amount: row.amount,
            paymentType: row.paymentType,
            donationType: row.donationType,
            paymentNo: row.paymentNo,
            paymentDate: row.paymentDate
        }));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Donations');

        if (data.length > 0) {
            worksheet.columns = Object.keys(data[0]).map(key => ({ header: key, key: key }));
            worksheet.addRows(data);
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=donation_data.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// Download Donation Data (PDF)
exports.downloadDonationPDF = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.DONATION);
        const sortedRows = rows.sort((a, b) => {
            const dateA = a.paymentDate ? new Date(a.paymentDate).getTime() : 0;
            const dateB = b.paymentDate ? new Date(b.paymentDate).getTime() : 0;
            return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
        });

        let rowsHtml = sortedRows.map(row => `
            <tr>
                <td>${row.id || '-'}</td>
                <td>${row.memberId || '-'}</td>
                <td>${row.name || '-'}</td>
                <td>${row.city || '-'}</td>
                <td>${row.amount || '0'}</td>
                <td>${row.donationType || '-'}</td>
                <td>${row.paymentType || '-'}</td>
                <td>${row.paymentDate || '-'}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    h2 { text-align: center; color: #4f46e5; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 12px; }
                    th { background-color: #f8fafc; color: #64748b; font-weight: bold; }
                    tr:nth-child(even) { background-color: #fbfcfe; }
                </style>
            </head>
            <body>
                <h2>UBS - Donation History</h2>
                <p style="font-size: 10px; color: #94a3b8; text-align: right;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Recp. No</th>
                            <th>Memb. ID</th>
                            <th>Donor Name</th>
                            <th>City</th>
                            <th>Amount</th>
                            <th>Donation Type</th>
                            <th>Payment</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
            printBackground: true
        });
        await page.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="donation_report.pdf"',
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// Download Member Data (PDF)
exports.downloadMemberPDF = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        const sortedRows = rows.sort((a, b) => (parseInt(a.memberId) || 0) - (parseInt(b.memberId) || 0));

        let rowsHtml = sortedRows.map(row => `
            <tr>
                <td>${row.memberId || '-'}</td>
                <td>${row.name || '-'}</td>
                <td>${row.relation || '-'}</td>
                <td>${row.city || '-'}</td>
                <td>${row.mobile || '-'}</td>
                <td>${row.gender || '-'}</td>
                <td>${row.marriagestatus || '-'}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    h2 { text-align: center; color: #1e293b; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 11px; }
                    th { background-color: #f8fafc; color: #64748b; font-weight: bold; }
                    tr:nth-child(even) { background-color: #fbfcfe; }
                </style>
            </head>
            <body>
                <h2>UBS Seva Trust - Members Directory</h2>
                <p style="font-size: 10px; color: #94a3b8; text-align: right;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Memb. ID</th>
                            <th>Name</th>
                            <th>Relation</th>
                            <th>City</th>
                            <th>Mobile</th>
                            <th>Gender</th>
                            <th>Married</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
            printBackground: true
        });
        await page.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="members_directory.pdf"',
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// Download Shubhechhak Data (PDF)
exports.downloadShubhechhakPDF = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.SHUBHECHHAK);
        const sortedRows = rows.sort((a, b) => (parseInt(a.memberId) || 0) - (parseInt(b.memberId) || 0));

        let rowsHtml = sortedRows.map(row => `
            <tr>
                <td>${row.memberId || '-'}</td>
                <td>${row.name || '-'}</td>
                <td>${row.relation || '-'}</td>
                <td>${row.city || '-'}</td>
                <td>${row.mobile || '-'}</td>
                <td>${row.gender || '-'}</td>
                <td>${row.marriagestatus || '-'}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    h2 { text-align: center; color: #1e293b; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 11px; }
                    th { background-color: #f8fafc; color: #64748b; font-weight: bold; }
                    tr:nth-child(even) { background-color: #fbfcfe; }
                </style>
            </head>
            <body>
                <h2>UBS Seva Trust - Shubhechhak Directory</h2>
                <p style="font-size: 10px; color: #94a3b8; text-align: right;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Memb. ID</th>
                            <th>Name</th>
                            <th>Relation</th>
                            <th>City</th>
                            <th>Mobile</th>
                            <th>Gender</th>
                            <th>Married</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
            printBackground: true
        });
        await page.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="shubhechhak_directory.pdf"',
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// POST: api/MemberData (Add Member)
exports.addMember = async (req, res) => {
    try {
        const value = req.body;
        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        
        const memberId = value.MemberId || value['Member Id'] || value.memberId;
        let newMemberId = memberId;
        let isNew = false;

        if (!newMemberId) {
            const maxId = rows.reduce((max, row) => Math.max(max, parseInt(row.memberId) || 0), 0);
            newMemberId = maxId + 1;
            isNew = true;
        }

        // Ensure headers exist
        const requiredKeys = ['_id', 'memberId', 'name', 'gender', 'relation', 'dob', 'dateOfBirth', 'marriagestatus', 'profession', 'designation', 'address', 'companyName', 'companyAddress', 'mobile', 'bloodGroup', 'city'];
        await googleSheets.ensureHeaders(SHEETS.MEMBERS, requiredKeys);

        const dob = formatDate(value.DateOfBirth || value.dob || value['Date Of Birth']);
        const _id = value.Id || value.id || Date.now().toString();

        const newRow = {
            _id: _id,
            memberId: newMemberId.toString(),
            name: value.Name || value.name,
            relation: value.Relation || value.relation,
            dob: dob,
            dateOfBirth: dob,
            marriagestatus: value.Married || value.MarriageStatus || value.marriageStatus,
            profession: value.Profession || value.profession,
            designation: value.Designation || value.designation,
            address: value.Address || value.address,
            companyName: value.Company || value.CompanyName || value.companyName || value.company,
            companyAddress: value.CompanyAddress || value.companyAddress || value['Company Address'],
            mobile: value.Mobile || value.mobile,
            bloodGroup: value.BloodGroup || value['Blood Group'] || value.bloodGroup,
            gender: value.Gender || value.gender,
            city: value.City || value.city
        };

        await googleSheets.addRow(SHEETS.MEMBERS, newRow);

        // Update Master Data Sheets
        await Promise.all([
            ensureMasterValue(SHEETS.RELATION, 'relation', newRow.relation),
            ensureMasterValue(SHEETS.MARRIAGE_STATUS, 'marriageStatus', newRow.marriagestatus),
            ensureMasterValue(SHEETS.PROFESSION, 'profession', newRow.profession),
            ensureMasterValue(SHEETS.BLOODGROUP, 'bloodGroup', newRow.bloodGroup),
            ensureMasterValue(SHEETS.CITY, 'city', newRow.city)
        ]);

        res.json({ message: isNew ? `Record added successfully! Your New member id is ${newMemberId}` : "Record added successfully!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST: api/MemberData/shubhechhak (Add Shubhechhak)
exports.addShubhechhakMember = async (req, res) => {
    try {
        const value = req.body;
        const rows = await googleSheets.getRows(SHEETS.SHUBHECHHAK);
        
        const memberId = value.MemberId || value['Member Id'] || value.memberId;
        let newMemberId = memberId;
        let isNew = false;

        if (!newMemberId) {
            const maxId = rows.reduce((max, row) => Math.max(max, parseInt(row.memberId) || 0), 0);
            newMemberId = maxId + 1;
            isNew = true;
        }

        // Ensure headers exist
        const requiredKeys = ['_id', 'memberId', 'name', 'gender', 'relation', 'dob', 'dateOfBirth', 'marriagestatus', 'profession', 'designation', 'address', 'companyName', 'companyAddress', 'mobile', 'bloodGroup', 'city'];
        await googleSheets.ensureHeaders(SHEETS.SHUBHECHHAK, requiredKeys);

        const dob = formatDate(value.DateOfBirth || value.dob || value['Date Of Birth']);
        const _id = value.Id || value.id || Date.now().toString();

        const newRow = {
            _id: _id,
            memberId: newMemberId.toString(),
            name: value.Name || value.name,
            relation: value.Relation || value.relation,
            dob: dob,
            dateOfBirth: dob,
            marriagestatus: value.Married || value.MarriageStatus || value.marriageStatus,
            profession: value.Profession || value.profession,
            designation: value.Designation || value.designation,
            address: value.Address || value.address,
            companyName: value.Company || value.CompanyName || value.companyName || value.company,
            companyAddress: value.CompanyAddress || value.companyAddress || value['Company Address'],
            mobile: value.Mobile || value.mobile,
            bloodGroup: value.BloodGroup || value['Blood Group'] || value.bloodGroup,
            gender: value.Gender || value.gender,
            city: value.City || value.city
        };

        await googleSheets.addRow(SHEETS.SHUBHECHHAK, newRow);
        
        // Update Master Data Sheets 
        await Promise.all([
            ensureMasterValue(SHEETS.RELATION, 'relation', newRow.relation),
            ensureMasterValue(SHEETS.MARRIAGE_STATUS, 'marriageStatus', newRow.marriagestatus),
            ensureMasterValue(SHEETS.PROFESSION, 'profession', newRow.profession),
            ensureMasterValue(SHEETS.BLOODGROUP, 'bloodGroup', newRow.bloodGroup),
            ensureMasterValue(SHEETS.CITY, 'city', newRow.city)
        ]);

        res.json({ message: isNew ? `Record added successfully! Your New member id is ${newMemberId}` : "Record added successfully!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT: api/MemberData/:id (Update Member)
exports.updateMember = async (req, res) => {
    try {
        const value = req.body;
        const id = req.params.id || value.Id || value.id; 

        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        const oldMember = rows.find(r => r._id === id);
        if (!oldMember) return res.status(404).json({ message: "Member not found" });
        const oldMemberId = oldMember.memberId;
        const newMemberIdRaw = value.MemberId || value['Member Id'] || value.memberId;
        const newMemberId = (newMemberIdRaw !== undefined && newMemberIdRaw !== null && newMemberIdRaw !== '') ? newMemberIdRaw.toString() : oldMemberId;

        // Uniqueness check for family ID
        if (newMemberId !== oldMemberId) {
            const familyExists = rows.find(r => r.memberId === newMemberId && r.relation === 'Self' && r._id !== id);
            if (familyExists) {
                return res.status(400).json({ message: `Member ID ${newMemberId} is already assigned to another family (${familyExists.name})` });
            }
        }

        // Ensure headers exist
        const requiredKeys = ['_id', 'memberId', 'name', 'gender', 'relation', 'dob', 'dateOfBirth', 'marriagestatus', 'profession', 'designation', 'address', 'companyName', 'companyAddress', 'mobile', 'bloodGroup', 'city'];
        await googleSheets.ensureHeaders(SHEETS.MEMBERS, requiredKeys);

        const dob = formatDate(value.DateOfBirth ?? value.dob ?? value['Date Of Birth']);
        const updatedData = {
            _id: id,
            memberId: newMemberId,
            name: value.Name ?? value.name ?? oldMember.name,
            relation: value.Relation ?? value.relation ?? oldMember.relation,
            dob: dob ?? oldMember.dob,
            dateOfBirth: dob ?? oldMember.dateOfBirth,
            marriagestatus: value.Married ?? value.MarriageStatus ?? value.marriageStatus ?? oldMember.marriagestatus,
            profession: value.Profession ?? value.profession ?? oldMember.profession,
            designation: value.Designation ?? value.designation ?? oldMember.designation,
            address: value.Address ?? value.address ?? oldMember.address,
            companyName: value.Company ?? value.CompanyName ?? value.companyName ?? value.company ?? oldMember.companyName,
            companyAddress: value.CompanyAddress ?? value.companyAddress ?? value['Company Address'] ?? oldMember.companyAddress,
            mobile: value.Mobile ?? value.mobile ?? oldMember.mobile,
            bloodGroup: value.BloodGroup ?? value['Blood Group'] ?? value.bloodGroup ?? oldMember.bloodGroup,
            city: value.City ?? value.city ?? oldMember.city,
            gender: value.Gender ?? value.gender ?? oldMember.gender
        };

        await googleSheets.updateRow(SHEETS.MEMBERS, '_id', id, updatedData);

        // Update Master Data Sheets
        await Promise.all([
            ensureMasterValue(SHEETS.RELATION, 'relation', updatedData.relation),
            ensureMasterValue(SHEETS.MARRIAGE_STATUS, 'marriageStatus', updatedData.marriagestatus),
            ensureMasterValue(SHEETS.PROFESSION, 'profession', updatedData.profession),
            ensureMasterValue(SHEETS.BLOODGROUP, 'bloodGroup', updatedData.bloodGroup),
            ensureMasterValue(SHEETS.CITY, 'city', updatedData.city)
        ]);

        if (oldMemberId && newMemberId && oldMemberId !== newMemberId) {
            const memberUpdates = rows
                .filter(row => row.memberId === oldMemberId && row._id !== id)
                .map(row => ({ idColumn: '_id', idValue: row._id, data: { ...row, memberId: newMemberId } }));
            
            const donationRows = await googleSheets.getRows(SHEETS.DONATION);
            const donationUpdates = donationRows
                .filter(dRow => dRow.memberId === oldMemberId)
                .map(dRow => ({ idColumn: 'id', idValue: dRow.id, data: { ...dRow, memberId: newMemberId } }));

            await Promise.all([
                googleSheets.batchUpdateRows(SHEETS.MEMBERS, memberUpdates),
                googleSheets.batchUpdateRows(SHEETS.DONATION, donationUpdates)
            ]);
        }

        res.json({ message: "Record updated successfully!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT: api/MemberData/shubhechhak/:id
exports.updateShubhechhakMember = async (req, res) => {
    try {
        const value = req.body;
        const id = req.params.id || value.Id || value.id;

        const rows = await googleSheets.getRows(SHEETS.SHUBHECHHAK);
        const oldMember = rows.find(r => r._id === id);
        if (!oldMember) return res.status(404).json({ message: "Shubhechhak not found" });
        const oldMemberId = oldMember.memberId;
        const newMemberIdRaw = value.MemberId || value['Member Id'] || value.memberId;
        const newMemberId = (newMemberIdRaw !== undefined && newMemberIdRaw !== null && newMemberIdRaw !== '') ? newMemberIdRaw.toString() : oldMemberId;

        // Uniqueness check for shubhechhak ID
        if (newMemberId !== oldMemberId) {
            const familyExists = rows.find(r => r.memberId === newMemberId && r._id !== id);
            if (familyExists) {
                return res.status(400).json({ message: `Shubhechhak ID ${newMemberId} is already assigned to ${familyExists.name}` });
            }
        }

        // Ensure headers exist
        const requiredKeys = ['_id', 'memberId', 'name', 'gender', 'relation', 'dob', 'dateOfBirth', 'marriagestatus', 'profession', 'designation', 'address', 'companyName', 'companyAddress', 'mobile', 'bloodGroup', 'city'];
        await googleSheets.ensureHeaders(SHEETS.SHUBHECHHAK, requiredKeys);

        const dob = formatDate(value.DateOfBirth ?? value.dob ?? value['Date Of Birth']);
        const updatedData = {
            _id: id,
            memberId: newMemberId,
            name: value.Name ?? value.name ?? oldMember.name,
            relation: value.Relation ?? value.relation ?? oldMember.relation,
            dob: dob ?? oldMember.dob,
            dateOfBirth: dob ?? oldMember.dateOfBirth,
            marriagestatus: value.Married ?? value.MarriageStatus ?? value.marriageStatus ?? oldMember.marriagestatus,
            profession: value.Profession ?? value.profession ?? oldMember.profession,
            designation: value.Designation ?? value.designation ?? oldMember.designation,
            address: value.Address ?? value.address ?? oldMember.address,
            companyName: value.Company ?? value.CompanyName ?? value.companyName ?? value.company ?? oldMember.companyName,
            companyAddress: value.CompanyAddress ?? value.companyAddress ?? value['Company Address'] ?? oldMember.companyAddress,
            mobile: value.Mobile ?? value.mobile ?? oldMember.mobile,
            bloodGroup: value.BloodGroup ?? value['Blood Group'] ?? value.bloodGroup ?? oldMember.bloodGroup,
            city: value.City ?? value.city ?? oldMember.city,
            gender: value.Gender ?? value.gender ?? oldMember.gender
        };

        await googleSheets.updateRow(SHEETS.SHUBHECHHAK, '_id', id, updatedData);

        // Update Master Data Sheets
        await Promise.all([
            ensureMasterValue(SHEETS.RELATION, 'relation', updatedData.relation),
            ensureMasterValue(SHEETS.MARRIAGE_STATUS, 'marriageStatus', updatedData.marriagestatus),
            ensureMasterValue(SHEETS.PROFESSION, 'profession', updatedData.profession),
            ensureMasterValue(SHEETS.BLOODGROUP, 'bloodGroup', updatedData.bloodGroup),
            ensureMasterValue(SHEETS.CITY, 'city', updatedData.city)
        ]);

        if (oldMemberId && newMemberId && oldMemberId !== newMemberId) {
            const shubhechhakUpdates = rows
                .filter(row => row.memberId === oldMemberId && row._id !== id)
                .map(row => ({ idColumn: '_id', idValue: row._id, data: { ...row, memberId: newMemberId } }));
            
            const donationRows = await googleSheets.getRows(SHEETS.DONATION);
            const donationUpdates = donationRows
                .filter(dRow => dRow.memberId === oldMemberId)
                .map(dRow => ({ idColumn: 'id', idValue: dRow.id, data: { ...dRow, memberId: newMemberId } }));

            await Promise.all([
                googleSheets.batchUpdateRows(SHEETS.SHUBHECHHAK, shubhechhakUpdates),
                googleSheets.batchUpdateRows(SHEETS.DONATION, donationUpdates)
            ]);
        }

        res.json({ message: "Record updated successfully!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE: api/MemberData/:id
exports.deleteMember = async (req, res) => {
    try {
        await googleSheets.deleteRow(SHEETS.MEMBERS, '_id', req.params.id);
        res.json({ message: "Record deleted successfully from Member list!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE: api/MemberData/shubhechhak/:id
exports.deleteShubhechhakMember = async (req, res) => {
    try {
        await googleSheets.deleteRow(SHEETS.SHUBHECHHAK, '_id', req.params.id);
        res.json({ message: "Record deleted successfully from Shubhechhak list!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE: api/MemberData/donation/:id
exports.deleteDonation = async (req, res) => {
    try {
        await googleSheets.deleteRow(SHEETS.DONATION, 'id', req.params.id);
        res.json({ message: "Donation record deleted successfully!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST: api/MemberData/donation
exports.createDonation = async (req, res) => {
    try {
        const value = req.body;
        const generateOnly = value.GenerateOnly !== undefined ? value.GenerateOnly : value.generateOnly;
        const saveOnly = value.SaveOnly !== undefined ? value.SaveOnly : value.saveOnly;
        let maxId = value.id || value.Id || "-"; // Use provided ID if available
        const paymentTypeStr = value.PaymentType || value.paymentType;
        const memberId = value.MemberId || value.memberId;
        const amount = value.Amount || value.amount;
        const name = value.Name || value.name;
        const mobile = value.Mobile || value.mobile;
        const paymentNo = value.PaymentNo || value.paymentNo;
        const city = value.City || value.city;
        const donationType = value.DonationType || value.donationType || "UBS Trust";

        const [donationRows, templateContent] = await Promise.all([
            (generateOnly) ? Promise.resolve([]) : googleSheets.getRows(SHEETS.DONATION),
            (saveOnly) ? Promise.resolve('') : fs.promises.readFile(path.join(__dirname, '..', 'template', 'Invoice.html'), 'utf8')
        ]);
        
        let nextId = 0;
        if (!generateOnly) {
            // Ensure headers exist
            await googleSheets.ensureHeaders(SHEETS.DONATION, ['id', 'memberId', 'amount', 'name', 'mobile', 'paymentType', 'donationType', 'paymentNo', 'paymentDate', 'city']);

            nextId = donationRows.reduce((max, row) => Math.max(max, parseInt(row.id) || 0), 0) + 1;
            
            const paymentType = paymentTypeStr === "રોકડા" ? "cash" : (paymentTypeStr === "UPI" ? "upi" : (paymentTypeStr === "ચેક" ? "cheque" : null));
            const now = new Date().toISOString().slice(0, 10);

            const newDonation = {
                id: nextId.toString(),
                memberId: memberId ? memberId.toString() : '',
                amount: amount.toString(),
                name: name,
                mobile: mobile,
                paymentType: paymentType,
                paymentNo: paymentNo || '',
                paymentDate: now,
                city: city,
                donationType: donationType
            };

            await googleSheets.addRow(SHEETS.DONATION, newDonation);
            
            // Update Master Data Sheet
            await ensureMasterValue(SHEETS.CITY, 'city', city);

            maxId = nextId;

            if (saveOnly) {
                return res.json({ success: true, message: "Donation data saved successfully!", id: maxId });
            }
        }

        let htmlContent = templateContent;

        const nowFormatted = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

        htmlContent = htmlContent
            .replace("#name#", name || (memberId ? memberId.toString() : "-"))
            .replace("#paid-date#", nowFormatted)
            .replace("#city#", city || "-")
            .replace("#amount#", amount ? amount.toString() : "-")
            .replace("#memberId#", memberId || "-")
            .replace("#mobile#", mobile || "-")
            .replace("#paymentType#", paymentTypeStr === "રોકડા" ? paymentTypeStr : paymentTypeStr + " દ્વારા ")
            .replace("#paymentType-1#", !paymentTypeStr ? "-" : (paymentTypeStr === "રોકડા" ? "" : paymentTypeStr + " નંબર: "))
            .replace("#paymentNo#", !paymentNo ? (paymentTypeStr === "રોકડા" ? "" : "-") : paymentNo)
            .replace("#logo#", logoBase64)
            .replace("#trustName#", donationType === "UBS" ? "શ્રી ઉનેવાળ બ્રહ્મસમાજ, વડોદરા" : "શ્રી ઉનેવાળ બ્રહ્મસમાજ સેવા ટ્રસ્ટ, વડોદરા")
            .replace("#receiptNo#", maxId);

        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        // Small delay to ensure Google Fonts are fully rendered
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 3 });
        
        const imageBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 95,
            fullPage: true
        });
        await page.close();

        const safeName = (name || "receipt").replace(/[^a-zA-Z0-9]/g, '_');
        const encodedName = encodeURIComponent(name || "receipt");

        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Disposition': `attachment; filename="${safeName}.jpg"; filename*=UTF-8''${encodedName}.jpg`,
            'Content-Length': imageBuffer.length
        });
        res.send(imageBuffer);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// GET: api/MemberData/ping (Used for heartbeat/cron)
exports.ping = (req, res) => {
    res.json({ 
        status: "active", 
        timestamp: new Date().toISOString(),
        message: "API is warm and ready!"
    });
};
