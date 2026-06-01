// Zone data model — the spatial knowledge database
// Each zone = a bounding box in the 3D space + metadata + content

export class ZoneStore {
  constructor() {
    this.zones = [];
    this.selectedId = null;
    this._listeners = [];
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  _notify() {
    this._listeners.forEach(fn => fn(this.zones));
  }

  load(zones) {
    this.zones = zones || [];
    this._notify();
  }

  toJSON() {
    return this.zones;
  }

  getById(id) {
    return this.zones.find(z => z.id === id);
  }

  getAll() {
    return this.zones;
  }

  add(zone) {
    this.zones.push(zone);
    this._notify();
    return zone;
  }

  update(id, patch) {
    const idx = this.zones.findIndex(z => z.id === id);
    if (idx === -1) return null;
    Object.assign(this.zones[idx], patch);
    this._notify();
    return this.zones[idx];
  }

  remove(id) {
    this.zones = this.zones.filter(z => z.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    this._notify();
  }

  select(id) {
    this.selectedId = id;
    this._notify();
  }

  deselect() {
    this.selectedId = null;
    this._notify();
  }

  getSelected() {
    return this.zones.find(z => z.id === this.selectedId);
  }

  // Find zone containing a 3D point
  findZoneAtPoint(point) {
    for (const zone of this.zones) {
      const b = zone.boundingBox;
      if (!b) continue;
      if (point.x >= b.min.x && point.x <= b.max.x &&
          point.y >= b.min.y && point.y <= b.max.y &&
          point.z >= b.min.z && point.z <= b.max.z) {
        return zone;
      }
    }
    return null;
  }

  // Get zones by category
  getByCategory(category) {
    return this.zones.filter(z => z.categories?.includes(category));
  }

  // Get zones by tag
  getByTag(tag) {
    return this.zones.filter(z => z.tags?.includes(tag));
  }
}

export function createDefaultZone(name = 'New Zone', cameraPos = null) {
  const id = 'zone-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const center = cameraPos ? { x: cameraPos.x, y: 0, z: cameraPos.z } : { x: 0, y: 0, z: 0 };
  return {
    id,
    name,
    description: '',
    tags: [],
    categories: [],
    boundingBox: {
      min: { x: center.x - 2, y: -0.5, z: center.z - 2 },
      max: { x: center.x + 2, y: 2.5, z: center.z + 2 },
    },
    cameraPosition: cameraPos || { x: center.x + 5, y: 3, z: center.z + 5 },
    cameraTarget: { x: center.x, y: 1, z: center.z },
    content: {
      images: [],
      videos: [],
      documents: [],
      urls: [],
    },
    aiInstructions: '',
    color: '#4fc3f7',
  };
}