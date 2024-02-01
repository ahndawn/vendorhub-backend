const { google } = require('googleapis');

async function readFromGoogleSheet(range) {
    try {
        const credentials = JSON.parse(process.env.GOOGLE_API_CREDENTIALS);

        // Configure a JWT client with the credentials
        const auth = new google.auth.JWT(
            credentials.client_email,
            null,
            credentials.private_key.replace(/\\n/g, '\n'), // Ensure correct handling of new lines in private key
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        // Create the sheets API client
        const sheets = google.sheets({ version: 'v4', auth });

        // Specify the spreadsheet ID and range
        const spreadsheetId = process.env.SPREADSHEET_ID;
        const range = 'import!A2:A';
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        return response.data.values;
    } catch (error) {
        console.error('The API returned an error: ' + error);
        throw error;
    }
}

module.exports = readFromGoogleSheet