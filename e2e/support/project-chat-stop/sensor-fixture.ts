/** Only written into a uniquely owned disposable Project; no installs or dependencies. */
export const stopSensorPackage = JSON.stringify({
  name: 'owned-stop-sensor-fixture',
  private: true,
  // Corepack must select the already-prepared image version rather than latest.
  packageManager: 'pnpm@9.15.4',
  scripts: { typecheck: 'node stop-sensor.cjs' },
});
// Keep the fixed already-installed pnpm; never self-install a parent's declared version.
export const stopSensorNpmrc = 'manage-package-manager-versions=false\n';
export const stopSensorScript = `
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
// Deliberately uncooperative descendant demonstrates why killing the pnpm
// wrapper is not proof its already-admitted child had no later effects.
process.on('SIGTERM',()=>{});
fs.appendFileSync(path.join(root,'sensor-started.jsonl'),JSON.stringify({pid:process.pid})+'\\n');
const deadline=setTimeout(()=>{clearInterval(check);process.exitCode=2;},45000);
const check=setInterval(()=>{
  if(!fs.existsSync(path.join(root,'sensor-release')))return;
  fs.appendFileSync(path.join(root,'sensor-finished.jsonl'),JSON.stringify({lateEffect:true})+'\\n');
  clearTimeout(deadline);clearInterval(check);
},25);
`;
export type StopSensorMarker = { started: number; finished: number };
