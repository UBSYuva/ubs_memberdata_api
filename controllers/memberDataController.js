const googleSheets = require('../googleSheets');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const ExcelJS = require('exceljs');

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
    CONFIG: 'configuration'
};

// GET: api/MemberData
exports.getAllMembers = async (req, res) => {
    try {
        const configRows = await googleSheets.getRows(SHEETS.CONFIG);
        const isActive = configRows.find(c => c.key === 'active')?.value?.toLowerCase() === 'true';
        if (!isActive) return res.json([]);

        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
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
            "Mobile": row.mobile
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
        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        const member = rows.find(r => r._id === id);
        
        if (!member) return res.status(404).json({ message: "Not found" });

        // Lead calculation (Self member with same memberId)
        const leadMember = rows.find(r => r.memberId === member.memberId && r.relation === 'Self');

        const result = {
            "Lead": leadMember ? leadMember.name : '',
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
            "Mobile": member.mobile,
            "Gender": member.gender
        };
        res.json(result);
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
        const configRows = await googleSheets.getRows(SHEETS.CONFIG);
        const isActive = configRows.find(c => c.key === 'active')?.value?.toLowerCase() === 'true';
        if (!isActive) return res.json([]);

        const rows = await googleSheets.getRows(SHEETS.SHUBHECHHAK);
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
            "Mobile": row.mobile
        })).sort((a, b) => parseInt(a["Member Id"]) - parseInt(b["Member Id"]));

        res.json(formattedRows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Master Data Endpoints
exports.getBloodGroups = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        res.json(getUniqueValues(rows, 'bloodGroup'));
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getRelations = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        res.json(getUniqueValues(rows, 'relation'));
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getProfessions = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        res.json(getUniqueValues(rows, 'profession'));
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMarriageStatuses = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        res.json(getUniqueValues(rows, 'marriagestatus'));
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// Donation Aggregation
exports.getTotalDonation = async (req, res) => {
    try {
        const rows = await googleSheets.getRows(SHEETS.DONATION);
        const aggregation = {};

        rows.forEach(row => {
            const date = new Date(row.paymentDate);
            if (isNaN(date.getTime())) return;
            const year = date.getFullYear();
            const amount = parseFloat(row.amount) || 0;

            if (!aggregation[year]) {
                aggregation[year] = { year, avgDonation: 0, totalEntries: 0, totalDonation: 0 };
            }
            aggregation[year].totalEntries += 1;
            aggregation[year].totalDonation += amount;
        });

        const result = Object.values(aggregation).map(item => ({
            ...item,
            avgDonation: item.totalDonation / item.totalEntries
        }));

        res.json(result);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// Donation List
exports.getDonationData = async (req, res) => {
    try {
        const { year } = req.query;
        let rows = await googleSheets.getRows(SHEETS.DONATION);

        if (year) {
            rows = rows.filter(row => {
                const date = new Date(row.paymentDate);
                return !isNaN(date.getTime()) && date.getFullYear().toString() === year;
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
        const pinEntry = configRows.find(c => c.key === 'appPin');
        res.json({ pin: pinEntry ? pinEntry.value : "1234" }); // Fallback to 1234 if not set in sheet
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
        const sortedRows = rows.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

        let rowsHtml = sortedRows.map(row => `
            <tr>
                <td>${row.id || '-'}</td>
                <td>${row.memberId || '-'}</td>
                <td>${row.name || '-'}</td>
                <td>${row.city || '-'}</td>
                <td>${row.amount || '0'}</td>
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
                <h2>UBS Seva Trust - Donation History</h2>
                <p style="font-size: 10px; color: #94a3b8; text-align: right;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Recp. No</th>
                            <th>Memb. ID</th>
                            <th>Donor Name</th>
                            <th>City</th>
                            <th>Amount</th>
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

        const isProduction = process.env.NODE_ENV === 'production';
        const browser = await puppeteer.launch({ 
            args: isProduction ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: isProduction ? await chromium.executablePath() : undefined,
            headless: isProduction ? chromium.headless : 'new',
            channel: isProduction ? undefined : 'chrome',
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
            printBackground: true
        });
        await browser.close();

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

        const isProduction = process.env.NODE_ENV === 'production';
        const browser = await puppeteer.launch({ 
            args: isProduction ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: isProduction ? await chromium.executablePath() : undefined,
            headless: isProduction ? chromium.headless : 'new',
            channel: isProduction ? undefined : 'chrome',
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
            printBackground: true
        });
        await browser.close();

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

        const isProduction = process.env.NODE_ENV === 'production';
        const browser = await puppeteer.launch({ 
            args: isProduction ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: isProduction ? await chromium.executablePath() : undefined,
            headless: isProduction ? chromium.headless : 'new',
            channel: isProduction ? undefined : 'chrome',
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
            printBackground: true
        });
        await browser.close();

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
        
        let newMemberId = value.MemberId;
        let isNew = false;

        if (!newMemberId) {
            const maxId = rows.reduce((max, row) => Math.max(max, parseInt(row.memberId) || 0), 0);
            newMemberId = maxId + 1;
            isNew = true;
        }

        const dob = formatDate(value.DateOfBirth);
        // Generate a simple _id if not provided (Sheets doesn't auto-increment)
        const _id = Date.now().toString();

        const newRow = {
            _id: _id,
            memberId: newMemberId.toString(),
            name: value.Name,
            relation: value.Relation,
            dob: dob,
            dateOfBirth: dob,
            marriagestatus: value.MarriageStatus,
            profession: value.Profession,
            designation: value.Designation,
            address: value.Address,
            companyName: value.Company,
            mobile: value.Mobile,
            bloodGroup: value.BloodGroup,
            gender: value.Gender,
            city: value.City
        };

        await googleSheets.addRow(SHEETS.MEMBERS, newRow);

        if (isNew) {
            res.json({ message: `Record added successfully! Your New member id is ${newMemberId}` });
        } else {
            res.json({ message: "Record added successfully!" });
        }
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST: api/MemberData/shubhechhak (Add Shubhechhak)
exports.addShubhechhakMember = async (req, res) => {
    try {
        const value = req.body;
        const rows = await googleSheets.getRows(SHEETS.SHUBHECHHAK);
        
        let newMemberId = value.MemberId;
        let isNew = false;

        if (!newMemberId) {
            const maxId = rows.reduce((max, row) => Math.max(max, parseInt(row.memberId) || 0), 0);
            newMemberId = maxId + 1;
            isNew = true;
        }

        const dob = formatDate(value.DateOfBirth);
        const _id = Date.now().toString();

        const newRow = {
            _id: _id,
            memberId: newMemberId.toString(),
            name: value.Name,
            relation: value.Relation,
            dob: dob,
            dateOfBirth: dob,
            marriagestatus: value.MarriageStatus,
            profession: value.Profession,
            designation: value.Designation,
            address: value.Address,
            companyName: value.Company,
            mobile: value.Mobile,
            bloodGroup: value.BloodGroup,
            gender: value.Gender,
            city: value.City
        };

        await googleSheets.addRow(SHEETS.SHUBHECHHAK, newRow);

        if (isNew) {
            res.json({ message: `Record added successfully! Your New member id is ${newMemberId}` });
        } else {
            res.json({ message: "Record added successfully!" });
        }
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT: api/MemberData/:id (Update Member)
exports.updateMember = async (req, res) => {
    try {
        const id = req.params.id || value.Id; // This is the _id
        const value = req.body;

        const rows = await googleSheets.getRows(SHEETS.MEMBERS);
        const oldMember = rows.find(r => r._id === id);
        if (!oldMember) return res.status(404).json({ message: "Member not found" });
        const oldMemberId = oldMember.memberId;

        const dob = formatDate(value.DateOfBirth);
        const updatedData = {
            _id: value.Id,
            memberId: value.MemberId.toString(),
            name: value.Name,
            relation: value.Relation,
            dob: dob,
            dateOfBirth: dob,
            marriagestatus: value.MarriageStatus,
            profession: value.Profession,
            designation: value.Designation,
            address: value.Address,
            companyName: value.Company,
            mobile: value.Mobile,
            bloodGroup: value.BloodGroup,
            city: value.City,
            gender: value.Gender
        };

        await googleSheets.updateRow(SHEETS.MEMBERS, '_id', id, updatedData);

        const newMemberId = value.MemberId.toString();
        if (oldMemberId && newMemberId && oldMemberId !== newMemberId) {
            // Update other family members and donations with same memberId
            // In Google Sheets, we have to do this Row by Row or via BatchUpdate
            // For simplicity, let's update them if needed next time they are fetched, 
            // OR iterate and update now.
            for (const row of rows) {
                if (row.memberId === oldMemberId && row._id !== value.Id) {
                    await googleSheets.updateRow(SHEETS.MEMBERS, '_id', row._id, { ...row, memberId: newMemberId });
                }
            }
            
            const donationRows = await googleSheets.getRows(SHEETS.DONATION);
            for (const dRow of donationRows) {
                if (dRow.memberId === oldMemberId) {
                    await googleSheets.updateRow(SHEETS.DONATION, 'id', dRow.id, { ...dRow, memberId: newMemberId });
                }
            }
        }

        res.json({ message: "Record updated successfully!" });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT: api/MemberData/shubhechhak/:id
exports.updateShubhechhakMember = async (req, res) => {
    try {
        const id = req.params.id || value.Id;
        const value = req.body;

        const rows = await googleSheets.getRows(SHEETS.SHUBHECHHAK);
        const oldMember = rows.find(r => r._id === id);
        if (!oldMember) return res.status(404).json({ message: "Shubhechhak not found" });
        const oldMemberId = oldMember.memberId;

        const dob = formatDate(value.DateOfBirth);
        const updatedData = {
            _id: value.Id,
            memberId: value.MemberId.toString(),
            name: value.Name,
            relation: value.Relation,
            dob: dob,
            dateOfBirth: dob,
            marriagestatus: value.MarriageStatus,
            profession: value.Profession,
            designation: value.Designation,
            address: value.Address,
            companyName: value.Company,
            mobile: value.Mobile,
            bloodGroup: value.BloodGroup,
            city: value.City,
            gender: value.Gender
        };

        await googleSheets.updateRow(SHEETS.SHUBHECHHAK, '_id', id, updatedData);

        const newMemberId = value.MemberId.toString();
        if (oldMemberId && newMemberId && oldMemberId !== newMemberId) {
            for (const row of rows) {
                if (row.memberId === oldMemberId && row._id !== value.Id) {
                    await googleSheets.updateRow(SHEETS.SHUBHECHHAK, '_id', row._id, { ...row, memberId: newMemberId });
                }
            }
            const donationRows = await googleSheets.getRows(SHEETS.DONATION);
            for (const dRow of donationRows) {
                if (dRow.memberId === oldMemberId) {
                    await googleSheets.updateRow(SHEETS.DONATION, 'id', dRow.id, { ...dRow, memberId: newMemberId });
                }
            }
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
        let maxId = "-";

        const generateOnly = value.GenerateOnly !== undefined ? value.GenerateOnly : value.generateOnly;
        const paymentTypeStr = value.PaymentType || value.paymentType;
        const memberId = value.MemberId || value.memberId;
        const amount = value.Amount || value.amount;
        const name = value.Name || value.name;
        const mobile = value.Mobile || value.mobile;
        const paymentNo = value.PaymentNo || value.paymentNo;
        const city = value.City || value.city;

        if (!generateOnly) {
            const donationRows = await googleSheets.getRows(SHEETS.DONATION);
            const nextId = donationRows.reduce((max, row) => Math.max(max, parseInt(row.id) || 0), 0) + 1;
            
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
                city: city
            };

            await googleSheets.addRow(SHEETS.DONATION, newDonation);
            maxId = nextId;
        }

        // Generate PDF (Same as before)
        const templatePath = path.join(__dirname, '..', 'template', 'Invoice.html');
        let htmlContent = fs.readFileSync(templatePath, 'utf8');

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
            .replace("#receiptNo#", maxId);

        const isProduction = process.env.NODE_ENV === 'production';

        const browser = await puppeteer.launch({ 
            args: isProduction ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: isProduction ? await chromium.executablePath() : undefined,
            headless: isProduction ? chromium.headless : 'new',
            channel: isProduction ? undefined : 'chrome',
        });
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
        await browser.close();

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
