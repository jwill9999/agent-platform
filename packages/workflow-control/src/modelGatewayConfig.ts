import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

export const modelGatewayConfigSchema = z
  .object({
    url: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === 'http:' &&
          !url.username &&
          !url.password &&
          url.pathname === '/' &&
          !url.search &&
          !url.hash
        );
      }, 'private HTTP gateway origin required'),
    model: z
      .string()
      .min(1)
      .max(200)
      .refine((value) => !/[\r\n\0]/u.test(value)),
  })
  .strict();
export type ModelGatewayConfig = z.infer<typeof modelGatewayConfigSchema>;

/** Trusted operator config only; worker/task text cannot choose the gateway or receive account auth. */
export async function configureModelGateway(codexHome: string, input: ModelGatewayConfig) {
  const config = modelGatewayConfigSchema.parse(input);
  const file = join(codexHome, 'config.toml');
  const existing = await readFile(file, 'utf8');
  await writeFile(
    file,
    `model = ${JSON.stringify(config.model)}\nmodel_provider = "local_lease"\n${existing}\n` +
      '[model_providers.local_lease]\nname="Local revocable credential gateway"\nwire_api="responses"\nrequires_openai_auth=true\nsupports_websockets=false\n' +
      `base_url=${JSON.stringify(config.url)}\n`,
    { mode: 0o600 },
  );
}
