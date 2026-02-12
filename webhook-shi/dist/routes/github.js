"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGitHubWebhook = void 0;
const statusStore_1 = require("../statusStore");
const utils_1 = require("../utils");
const handleGitHubWebhook = (req, res) => {
    try {
        const data = req.body;
        if (!data.status || !data.status.indicator) {
            return res.status(400).json({ error: 'Invalid GitHub status data' });
        }
        const statusData = {
            platform: 'github',
            status: (0, utils_1.mapGitHubStatus)(data.status.indicator),
            message: data.status.description,
            timestamp: Date.now(),
            components: (0, utils_1.extractComponents)(data)
        };
        statusStore_1.statusStore.set('github', statusData);
        console.log(`GitHub status updated: ${statusData.status} - ${statusData.message}`);
        res.status(200).json({
            success: true,
            message: 'GitHub status updated successfully',
            status: statusData
        });
    }
    catch (error) {
        console.error('Error processing GitHub webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.handleGitHubWebhook = handleGitHubWebhook;
