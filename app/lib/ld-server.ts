import LaunchDarkly from "launchdarkly-node-server-sdk";
import { Config } from "sst/node/config";

let _client: LaunchDarkly.LDClient | undefined;

async function initialize() {
  const client = LaunchDarkly.init(Config.LD_SDK_KEY);
  _client = await client.waitForInitialization();

  return _client;
}

async function getClient() {
  return _client ? _client : initialize();
}

async function getVariation(flagKey: any, context: any, defaultValue: any) {
  const ldClient = await getClient();
  return ldClient.variation(flagKey, context, defaultValue);
}
// eslint-disable-next-line import/no-anonymous-default-export
export default { getClient, getVariation };