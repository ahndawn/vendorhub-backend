const express = require('express');
const router = express.Router();
const { mainPool, sharedPool } = require('../services/db');
const { protect } = require('../middleware/authMiddleware');
const LeadStatus = require('../models/LeadStatus');
const readFromGoogleSheet = require('../services/googleSheetsClient');

const updateLead = async (req, res) => {
    try {
        const { leadId } = req.params;
        const {
            timestamp, label, firstname, email, phone1, ozip, dzip, dcity, dstate, movesize, 
            movedte, conversion, validation, notes, sent_to_gronat, sent_to_sheets, moverref, ocity, ostate,
            isBooked
        } = req.body;

        const updateQuery = `
            UPDATE lead 
            SET 
                timestamp = $1, label = $2, firstname = $3, email = $4, phone1 = $5, 
                ozip = $6, dzip = $7, dcity = $8, dstate = $9, movesize = $10, 
                movedte = $11, conversion = $12, validation = $13, notes = $14, 
                sent_to_gronat = $15, sent_to_sheets = $16, moverref = $17, ocity = $18, ostate = $19
            WHERE id = $20
        `;
        await mainPool.query(updateQuery, [
            timestamp, label, firstname, email, phone1, ozip, dzip, dcity, dstate, movesize, 
            movedte, conversion, validation, notes, sent_to_gronat, sent_to_sheets, moverref, ocity, ostate, leadId
        ]);

        // Log the received isBooked value for debugging
        console.log(`Updating leadId: ${leadId}, isBooked: ${isBooked}`);

        // Update MongoDB booked status if isBooked is provided
        if (typeof isBooked !== 'undefined') {
            await LeadStatus.findOneAndUpdate(
                { leadId: leadId },
                { booked: isBooked },
                { new: true, upsert: true }
            );
        }

        res.json({ message: 'Lead updated successfully' });
    } catch (error) {
        console.error("Error updating lead:", error);
        res.status(500).json({ message: 'Server error occurred while updating lead', error: error.toString() });
    }
};


const updateBookedStatus = async (req, res) => {
    try {
        // Read data from Google Sheet starting at A2
        const sheetData = await readFromGoogleSheet();

        // Iterate over each row from the sheet
        for (const [note] of sheetData) {
            // Find matching lead in PostgreSQL
            const { rows } = await mainPool.query('SELECT * FROM lead WHERE notes = $1', [note]);

            // If a matching lead is found
            if (rows.length > 0) {
                const leadId = rows[0].id; // Assuming 'id' is the identifier for leads

                // Update the booked status in MongoDB
                await LeadStatus.findOneAndUpdate(
                    { leadId: leadId },
                    { booked: true },
                    { new: true, upsert: true }
                );
            }
        }

        res.json({ message: 'Booked statuses updated from Google Sheet' });
    } catch (error) {
        console.error('Error updating booked statuses:', error);
        res.status(500).json({ message: 'Error updating booked statuses', error: error.toString() });
    }
};

router.put('/update-lead/:leadId', protect, updateLead);
router.put('/update-lead-booked-status/:leadId', protect, updateBookedStatus);

module.exports = router;