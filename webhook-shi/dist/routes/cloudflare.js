"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCloudflareWebhook = void 0;
const statusStore_1 = require("../statusStore");
const utils_1 = require("../utils");
const handleCloudflareWebhook = (req, res) => {
    try {
        const data = req.body;
        if (!data.status || !data.status.indicator) {
            return res.status(400).json({ error: 'Invalid Cloudflare status data' });
        }
        const components = data.components?.map(component => ({
            name: component.name,
            status: (0, utils_1.mapCloudflareStatus)(component.status),
            description: component.description
        })) || [];
        const statusData = {
            platform: 'cloudflare',
            status: (0, utils_1.mapCloudflareStatus)(data.status.indicator),
            message: data.status.description,
            timestamp: Date.now(),
            components
        };
        statusStore_1.statusStore.set('cloudflare', statusData);
        console.log(`Cloudflare status updated: ${statusData.status} - ${statusData.message}`);
        res.status(200).json({
            success: true,
            message: 'Cloudflare status updated successfully',
            status: statusData
        });
    }
    catch (error) {
        console.error('Error processing Cloudflare webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.handleCloudflareWebhook = handleCloudflareWebhook;
