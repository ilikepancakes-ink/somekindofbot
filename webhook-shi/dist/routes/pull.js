"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatus = void 0;
const statusStore_1 = require("../statusStore");
const utils_1 = require("../utils");
const getStatus = (req, res) => {
    try {
        const platform = req.query.platform;
        if (platform) {
            // Get specific platform status
            const status = statusStore_1.statusStore.get(platform);
            if (!status) {
                return res.status(404).json({ error: `No status found for platform: ${platform}` });
            }
            res.status(200).json({
                platform,
                status: {
                    status: status.status,
                    message: status.message,
                    timestamp: status.timestamp,
                    components: status.components
                }
            });
        }
        else {
            // Get all platform statuses
            const allStatuses = statusStore_1.statusStore.getAll();
            const response = (0, utils_1.formatStatusResponse)(allStatuses);
            res.status(200).json(response);
        }
    }
    catch (error) {
        console.error('Error retrieving status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getStatus = getStatus;
