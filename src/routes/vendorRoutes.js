const express = require('express');
const router = express.Router();
const { mainPool } = require('../services/db');
const { protect } = require('../middleware/authMiddleware');
const LeadStatus = require('../models/LeadStatus');

const getVendorLeads = async (req, res) => {
    try {
        let vendorLabel;

        // Check if the user is an admin
        if (req.user.role === 'admin' && req.query.vendorLabel) {
            // If admin, use the vendor label provided in the query parameter
            vendorLabel = req.query.vendorLabel;
        } else {
            // If not admin, use the username from the user object
            vendorLabel = req.user.username;
        }

        const query = 'SELECT * FROM lead WHERE label = $1';           
        const { rows } = await mainPool.query(query, [vendorLabel]);   

        if (rows.length > 0) {
            console.log(`Data fetched for vendor '${vendorLabel}':`, rows);
        } else {
            console.log(`No data found for vendor '${vendorLabel}'`);
        }
   
        res.json(rows);   
    } catch (error) {
        console.error("Error fetching vendor leads:", error);
        res.status(500).json({ message: 'Server error occurred while fetching vendor leads', error: error.toString() });
    }
};

const updateVendorLead = async (req, res) => {
    try {
        const { leadId } = req.params;
        const updatedData = req.body;

        // First, fetch the lead to check if it belongs to the vendor or if the user is an admin
        const leadQuery = 'SELECT * FROM lead WHERE id = $1';
        const leadResult = await mainPool.query(leadQuery, [leadId]);

        if (leadResult.rows.length === 0) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        const lead = leadResult.rows[0];

        // Check if the user is an admin or if the lead's label matches the vendor's username
        if (req.user.role !== 'admin' && lead.label !== req.user.username) {
            return res.status(403).json({ message: 'Unauthorized to edit this lead' });
        }

        // Proceed with the update
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
            updatedData.timestamp, updatedData.label, updatedData.firstname, updatedData.email, updatedData.phone1, 
            updatedData.ozip, updatedData.dzip, updatedData.dcity, updatedData.dstate, updatedData.movesize, 
            updatedData.movedte, updatedData.conversion, updatedData.validation, updatedData.notes, 
            updatedData.sent_to_gronat, updatedData.sent_to_sheets, updatedData.moverref, updatedData.ocity, updatedData.ostate, leadId
        ]);

        res.json({ message: 'Lead updated successfully' });
    } catch (error) {
        console.error("Error updating lead:", error);
        res.status(500).json({ message: 'Server error occurred while updating lead', error: error.toString() });
    }
};

// Fetch booked leads for a specific vendor
const getBookedVendorLeads = async (req, res) => {
    const vendor = req.params.vendor;
    const bookedLeads = await LeadStatus.find({ booked: true });
    const bookedLeadIds = bookedLeads.map(lead => lead.leadId);

    // Assuming leads are stored in mainPool with a 'label' column for vendor
    const { rows } = await mainPool.query('SELECT * FROM lead WHERE id = ANY($1::int[]) AND label = $2', [bookedLeadIds, vendor]);
    res.json(rows);
};

router.get('/booked-leads/:vendor', protect, getBookedVendorLeads);
router.get('/leads', protect, getVendorLeads);
router.put('/update-lead/:leadId', protect, updateVendorLead);

// Export the router
module.exports = router;