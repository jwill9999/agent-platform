const productionBeadsPorts = new WeakSet<object>();

export function registerProductionBeadsPort<T extends object>(port: T): T {
  productionBeadsPorts.add(port);
  return port;
}

export function isProductionBeadsPort(port: object): boolean {
  return productionBeadsPorts.has(port);
}
