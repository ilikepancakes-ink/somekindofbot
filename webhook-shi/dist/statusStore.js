"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusStore = void 0;
class StatusStore {
    constructor() {
        this.statuses = new Map();
    }
    set(platform, data) {
        this.statuses.set(platform, data);
    }
    get(platform) {
        return this.statuses.get(platform);
    }
    getAll() {
        return Array.from(this.statuses.values());
    }
    remove(platform) {
        return this.statuses.delete(platform);
    }
    clear() {
        this.statuses.clear();
    }
}
exports.statusStore = new StatusStore();
