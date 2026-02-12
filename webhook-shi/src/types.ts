export interface StatusData {
  platform: string;
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage';
  message?: string;
  timestamp: number;
  components?: Component[];
}

export interface Component {
  name: string;
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage';
  description?: string;
}

export interface DiscordStatus {
  page: {
    id: string;
    name: string;
    url: string;
    time_zone: string;
  };
  status: {
    indicator: 'none' | 'minor' | 'major' | 'critical' | 'maintenance';
    description: string;
  };
  components: Record<string, {
    id: string;
    name: string;
    status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'maintenance';
    description: string;
  }>;
}

export interface GitHubStatus {
  page: {
    id: string;
    name: string;
    url: string;
    time_zone: string;
  };
  status: {
    indicator: 'none' | 'minor' | 'major' | 'critical' | 'maintenance';
    description: string;
  };
  components: Record<string, {
    id: string;
    name: string;
    status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'maintenance';
    description: string;
  }>;
}

export interface CloudflareStatus {
  status: {
    description: string;
    indicator: 'none' | 'minor' | 'major' | 'critical' | 'maintenance';
  };
  components: Array<{
    id: string;
    name: string;
    status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'maintenance';
    description: string;
  }>;
}

export interface AWSStatus {
  service: string;
  region: string;
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'maintenance';
  message?: string;
  timestamp: string;
}