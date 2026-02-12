import { StatusData, Component } from './types';

export function mapDiscordStatus(indicator: string): 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' {
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

export function mapGitHubStatus(indicator: string): 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' {
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

export function mapCloudflareStatus(indicator: string): 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' {
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

export function mapAWSStatus(status: string): 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' {
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

export function extractComponents(data: any): Component[] {
  const components: Component[] = [];
  
  if (data.components) {
    Object.values(data.components).forEach((component: any) => {
      components.push({
        name: component.name,
        status: mapDiscordStatus(component.status),
        description: component.description
      });
    });
  }
  
  return components;
}

export function formatStatusResponse(statuses: StatusData[]): any {
  const platformStatuses: Record<string, any> = {};
  
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