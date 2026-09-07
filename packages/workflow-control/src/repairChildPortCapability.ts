const productionRepairChildPorts = new WeakSet<object>();

export function registerProductionRepairChildPort<T extends object>(port: T): T {
  productionRepairChildPorts.add(port);
  return Object.freeze(port);
}

export function isProductionRepairChildPort(port: object): boolean {
  return productionRepairChildPorts.has(port) && Object.isFrozen(port);
}
