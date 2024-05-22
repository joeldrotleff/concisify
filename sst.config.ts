import { SSTConfig } from "sst";
import { NextjsSite, Config, Bucket } from "sst/constructs";

export default {
  config(_input) {
    return {
      name: "concisify",
      region: "us-east-1",
      profile: "concisify"
    };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      // secrets:
      const LD_SDK_KEY = new Config.Secret(stack, "LD_SDK_KEY");
      
      // storage buckets:
      const uploadedVideosBucket = new Bucket(stack, "UploadedVideos");

      const site = new NextjsSite(stack, "site", {
        bind: [LD_SDK_KEY, uploadedVideosBucket],
        dev: {
          url: "http://localhost:3000"
        },
        permissions: ["bedrock:InvokeModel"],
      });

      stack.addOutputs({
        SiteUrl: site.url,
      });
    });
  },
} satisfies SSTConfig;
