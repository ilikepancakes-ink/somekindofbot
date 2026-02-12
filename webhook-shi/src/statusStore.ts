import { StatusData } from './types';

class StatusStore {
  private statuses: Map<string, StatusData> = new Map();

  set(platform: string, data: StatusData): void {
    this.statuses.set(platform, data);
  }

  get(platform: string): StatusData | undefined {
    return this.statuses.get(platform);
  }

  getAll(): StatusData[] {
    return Array.from(this.statuses.values());
  }

  remove(platform: string): boolean {
    return this.statuses.delete(platform);
  }

  clear(): void {
    this.statuses.clear();
  }
}

export const statusStore = new StatusStore();