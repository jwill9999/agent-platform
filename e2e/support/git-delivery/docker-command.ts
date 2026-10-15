import { accessSync, constants } from 'node:fs';

/** Known host installations only; fixture commands never consult PATH or an override. */
export function dockerFixtureBinary(): string {
  let executable: string;
  if (process.platform === 'darwin')
    executable = '/Applications/Docker.app/Contents/Resources/bin/docker';
  else if (process.platform === 'linux') executable = '/usr/bin/docker';
  else throw new Error('Git delivery Docker fixtures require macOS or Linux');
  accessSync(executable, constants.X_OK);
  return executable;
}
