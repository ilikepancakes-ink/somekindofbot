"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAWSWebhook = void 0;
const statusStore_1 = require("../statusStore");
const utils_1 = require("../utils");
const handleAWSWebhook = (req, res) => {
    try {
        const data = req.body;
        if (!data.service || !data.status) {
            return res.status(400).json({ error: 'Invalid AWS status data' });
        }
        const statusData = {
            platform: 'aws',
            status: (0, utils_1.mapAWSStatus)(data.status),
            message: data.message || `${data.service} in ${data.region} is ${data.status}`,
            timestamp: Date.now(),
            components: [{
                    name: `${data.service} (${data.region})`,
                    status: (0, utils_1.mapAWSStatus)(data.status),
                    description: data.message
                }]
        };
        statusStore_1.statusStore.set('aws', statusData);
        console.log(`AWS status updated: ${statusData.status} - ${statusData.message}`);
        res.status(200).json({
            success: true,
            message: 'AWS status updated successfully',
            status: statusData
        });
    }
    catch (error) {
        console.error('Error processing AWS webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.handleAWSWebhook = handleAWSWebhook;
