const express = require('express');
const router = express.Router();
const { mainPool } = require('../services/db');
const { protect } = require('../middleware/authMiddleware');
const LeadStatus = require('../models/LeadStatus');

const getVendorLeads = async (req, res) => {
    try {
        let vendorLabel;

        // Determine vendor label based on user role
        if (req.user.role === 'admin' && req.query.vendorLabel) {
            vendorLabel = req.query.vendorLabel;
        } else {
            vendorLabel = req.user.username;
        }

        // Fetch leads from PostgreSQL
        const query = 'SELECT * FROM lead WHERE label = $1';
        const { rows } = await mainPool.query(query, [vendorLabel]);

        // Fetch booked lead statuses from MongoDB
        const bookedLeads = await LeadStatus.find({ booked: true });
        const bookedLeadIds = bookedLeads.map(lead => lead.leadId);

        // Merge the `isBooked` status into the PostgreSQL leads data
        const leadsWithBookedStatus = rows.map(lead => ({
            ...lead,
            isBooked: bookedLeadIds.includes(lead.id) // Assuming `lead.id` and `bookedLeadIds` are compatible types
        }));

        res.json(leadsWithBookedStatus);
    } catch (error) {
        console.error("Error fetching vendor leads:", error);
        res.status(500).json({ message: 'Server error occurred while fetching vendor leads', error: error.toString() });
    }
};

// Fetch booked leads for a specific vendor
const getBookedVendorLeads = async (req, res) => {
    const vendor = req.params.vendor;
    const bookedLeads = await LeadStatus.find({ booked: true });
    const bookedLeadIds = bookedLeads.map(lead => lead.leadId);

    // Assuming leads are stored in mainPool with a 'label' column for vendor
    const { rows } = await mainPool.query('SELECT * FROM lead WHERE id = ANY($1::int[]) AND label = $2', [bookedLeadIds, vendor]);
    
    // Add isBooked property to each lead
    const leadsWithBookedStatus = rows.map(row => ({ ...row, isBooked: bookedLeadIds.includes(row.id) }));

    res.json(leadsWithBookedStatus);
};

router.get('/booked-leads/:vendor', protect, getBookedVendorLeads);
router.get('/leads', protect, getVendorLeads);

// Export the router
module.exports = router;