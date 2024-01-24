const express = require('express');
const router = express.Router();
const { mainPool } = require('../../db');
const { protect } = require('../middleware/authMiddleware'); // Import the middleware

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

// Apply the authMiddleware to the route
router.get('/leads', protect, getVendorLeads);

// Export the router
module.exports = router;