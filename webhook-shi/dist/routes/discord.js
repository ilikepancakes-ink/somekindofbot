"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDiscordWebhook = void 0;
const statusStore_1 = require("../statusStore");
const utils_1 = require("../utils");
const handleDiscordWebhook = (req, res) => {
    try {
        const data = req.body;
        if (!data.status || !data.status.indicator) {
            return res.status(400).json({ error: 'Invalid Discord status data' });
        }
        const statusData = {
            platform: 'discord',
            status: (0, utils_1.mapDiscordStatus)(data.status.indicator),
            message: data.status.description,
            timestamp: Date.now(),
            components: (0, utils_1.extractComponents)(data)
        };
        statusStore_1.statusStore.set('discord', statusData);
        console.log(`Discord status updated: ${statusData.status} - ${statusData.message}`);
        res.status(200).json({
            success: true,
            message: 'Discord status updated successfully',
            status: statusData
        });
    }
    catch (error) {
        console.error('Error processing Discord webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.handleDiscordWebhook = handleDiscordWebhook;
