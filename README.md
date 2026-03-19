# UBS Member Data API (Node.js)

This is a Node.js port of the C# API for UBS Member Data.

## Prerequisites

- Node.js (v18+)
- MySQL Database

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   - `DB_HOST`: Database host
   - `DB_PORT`: Database port (default 3306 or 27708 as per your config)
   - `DB_USER`: Database user
   - `DB_PASS`: Database password
   - `DB_NAME`: Database name
   - `PORT`: Server port (default 3000)

3. Start the server:
   ```bash
   npm start
   ```

## Folder Structure

- `controllers/` - Request handlers and business logic.
- `routes/` - API path definitions.
- `template/` - HTML templates for PDF generation.
- `fonts/` - Custom fonts for PDF generation.
- `db.js` - Database connection pool.
- `index.js` - App entry point and middleware configuration.

## Endpoints

- `GET /api/MemberData` - Get all members
- `GET /api/MemberData/:id` - Get member by internal ID
- `GET /api/MemberData/shubhechhak` - Get all Shubhechhak members
- `GET /api/MemberData/bloodGroup` - Get distinct blood groups
- `GET /api/MemberData/relation` - Get distinct relations
- `GET /api/MemberData/profession` - Get distinct professions
- `GET /api/MemberData/marriageStatus` - Get distinct marriage statuses
- `GET /api/MemberData/getTotalDonation` - Get donation summary by year
- `GET /api/MemberData/donationData?year=YYYY` - Get donation list
- `GET /api/MemberData/downloadDonationData` - Download donation list as Excel
- `POST /api/MemberData` - Add a new member
- `POST /api/MemberData/shubhechhak` - Add a new Shubhechhak member
- `PUT /api/MemberData/:id` - Update a member
- `PUT /api/MemberData/shubhechhak/:id` - Update a Shubhechhak member
- `DELETE /api/MemberData/:id` - Delete a member
- `DELETE /api/MemberData/shubhechhak/:id` - Delete a Shubhechhak member
- `DELETE /api/MemberData/donation/:id` - Delete a donation record
- `POST /api/MemberData/donation` - Add a donation and generate a PDF receipt
