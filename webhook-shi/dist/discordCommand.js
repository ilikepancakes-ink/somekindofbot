"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStatusCommand = void 0;
const statusStore_1 = require("./statusStore");
const utils_1 = require("./utils");
const handleStatusCommand = (req, res) => {
    try {
        const { platform } = req.body.data?.options?.[0] || {};
        if (platform) {
            // Get specific platform status
            const status = statusStore_1.statusStore.get(platform.value);
            if (!status) {
                return res.status(200).json({
                    type: 4,
                    data: {
                        content: `No status found for platform: ${platform.value}`
                    }
                });
            }
            const embed = {
                title: `Status for ${platform.value}`,
                description: status.message || 'No message available',
                color: getStatusColor(status.status),
                fields: [
                    {
                        name: 'Status',
                        value: formatStatusText(status.status),
                        inline: true
                    },
                    {
                        name: 'Last Updated',
                        value: new Date(status.timestamp).toLocaleString(),
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString()
            };
            if (status.components && status.components.length > 0) {
                embed.fields.push({
                    name: 'Components',
                    value: status.components.map(comp => `${getStatusEmoji(comp.status)} **${comp.name}**: ${comp.description || comp.status}`).join('\n'),
                    inline: false
                });
            }
            res.status(200).json({
                type: 4,
                data: {
                    embeds: [embed]
                }
            });
        }
        else {
            // Get all platform statuses
            const allStatuses = statusStore_1.statusStore.getAll();
            const response = (0, utils_1.formatStatusResponse)(allStatuses);
            const embed = {
                title: 'All Platform Statuses',
                description: `Last updated: ${new Date(response.lastUpdated).toLocaleString()}`,
                color: 0x0099ff,
                fields: Object.entries(response.platforms).map(([platform, data]) => ({
                    name: platform.toUpperCase(),
                    value: `${getStatusEmoji(data.status)} **${formatStatusText(data.status)}**\n${data.message || 'No message available'}`,
                    inline: true
                })),
                timestamp: new Date().toISOString()
            };
            res.status(200).json({
                type: 4,
                data: {
                    embeds: [embed]
                }
            });
        }
    }
    catch (error) {
        console.error('Error handling status command:', error);
        res.status(200).json({
            type: 4,
            data: {
                content: 'An error occurred while processing your request.'
            }
        });
    }
};
exports.handleStatusCommand = handleStatusCommand;
function getStatusColor(status) {
    switch (status) {
        case 'operational':
            return 0x00ff00;
        case 'degraded_performance':
            return 0xffff00;
        case 'partial_outage':
            return 0xffa500;
        case 'major_outage':
            return 0xff0000;
        default:
            return 0x808080;
    }
}
function getStatusEmoji(status) {
    switch (status) {
        case 'operational':
            return '🟢';
        case 'degraded_performance':
            return '🟡';
        case 'partial_outage':
            return '🟠';
        case 'major_outage':
            return '🔴';
        default:
            return '⚪';
    }
}
function formatStatusText(status) {
    switch (status) {
        case 'operational':
            return 'Operational';
        case 'degraded_performance':
            return 'Degraded Performance';
        case 'partial_outage':
            return 'Partial Outage';
        case 'major_outage':
            return 'Major Outage';
        default:
            return status;
    }
}
