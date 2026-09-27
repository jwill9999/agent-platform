import fs from 'node:fs';
import { setInterval } from 'node:timers';
const prompt = JSON.parse(fs.readFileSync(0, 'utf8'));
fs.appendFileSync('/evidence/lifecycle-marker.txt', prompt.input.binding.executionDigest + '\n');
setInterval(() => {}, 1000);
