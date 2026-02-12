"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapDiscordStatus = mapDiscordStatus;
exports.mapGitHubStatus = mapGitHubStatus;
exports.mapCloudflareStatus = mapCloudflareStatus;
exports.mapAWSStatus = mapAWSStatus;
exports.extractComponents = extractComponents;
exports.formatStatusResponse = formatStatusResponse;
function mapDiscordStatus(indicator) {
    switch (indicator) {
        case 'none':
            return 'operational';
        case 'minor':
            return 'degraded_performance';
        case 'major':
            return 'partial_outage';
        case 'critical':
            return 'major_outage';
        default:
            return 'operational';
    }
}
function mapGitHubStatus(indicator) {
    switch (indicator) {
        case 'none':
            return 'operational';
        case 'minor':
            return 'degraded_performance';
        case 'major':
            return 'partial_outage';
        case 'critical':
            return 'major_outage';
        default:
            return 'operational';
    }
}
function mapCloudflareStatus(indicator) {
    switch (indicator) {
        case 'none':
            return 'operational';
        case 'minor':
            return 'degraded_performance';
        case 'major':
            return 'partial_outage';
        case 'critical':
            return 'major_outage';
        default:
            return 'operational';
    }
}
function mapAWSStatus(status) {
    switch (status) {
        case 'operational':
            return 'operational';
        case 'degraded_performance':
            return 'degraded_performance';
        case 'partial_outage':
            return 'partial_outage';
        case 'major_outage':
            return 'major_outage';
        default:
            return 'operational';
    }
}
function extractComponents(data) {
    const components = [];
    if (data.components) {
        Object.values(data.components).forEach((component) => {
            components.push({
                name: component.name,
                status: mapDiscordStatus(component.status),
                description: component.description
            });
        });
    }
    return components;
}
function formatStatusResponse(statuses) {
    const platformStatuses = {};
    statuses.forEach(status => {
        platformStatuses[status.platform] = {
            status: status.status,
            message: status.message,
            timestamp: status.timestamp,
            components: status.components
        };
    });
    return {
        platforms: platformStatuses,
        lastUpdated: Math.max(...statuses.map(s => s.timestamp))
    };
}
