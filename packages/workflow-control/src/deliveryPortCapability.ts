const productionDeliveryPorts = new WeakSet<object>();

export function registerProductionDeliveryPort<T extends object>(port: T): T {
  productionDeliveryPorts.add(port);
  return Object.freeze(port);
}

export function isProductionDeliveryPort(port: object): boolean {
  return productionDeliveryPorts.has(port) && Object.isFrozen(port);
}
