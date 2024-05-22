import LaunchDarkly from "launchdarkly-node-server-sdk";
import { Config } from "sst/node/config";

async function initialize() {
  const client = LaunchDarkly.init(Config.LD_SDK_KEY);
  globalThis.LaunchDarklyServerClient = await client.waitForInitialization();

  return globalThis.LaunchDarklyServerClient;
}

async function getClient() {
  const ldClient = globalThis.LaunchDarklyServerClient;
  return ldClient ? ldClient : initialize();
}

async function getVariation(flagKey, context, defaultValue) {
  const ldClient = await getClient();
  return ldClient.variation(flagKey, context, defaultValue);
}
export default { getClient, getVariation };