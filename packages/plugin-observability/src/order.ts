import type { PluginHooks } from '@agent-platform/plugin-sdk';

/**
 * Resolution order for composing plugins: **global → user → agent**.
 * Pass the result to {@link createPluginDispatcher} from `@agent-platform/plugin-sdk`.
 */
export function mergeOrderedPluginLayers(layers: {
  global?: PluginHooks;
  user?: PluginHooks;
  agent?: PluginHooks;
}): PluginHooks[] {
  return [layers.global, layers.user, layers.agent].filter((p): p is PluginHooks => p != null);
}
