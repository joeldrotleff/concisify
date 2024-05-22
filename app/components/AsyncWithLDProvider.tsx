'use client';

import { use } from "react";
import { asyncWithLDProvider } from "launchdarkly-react-client-sdk";

export default function AsyncLDProvider({ children }) {
 
  //  1. Call use() hook,
  //  2. Initialize LaunchDarkly SDK as usual

  const LDDynaProvider = use(
    asyncWithLDProvider({
      clientSideID: process.env.NEXT_PUBLIC_LD_CLIENT_SIDE_ID!,
      context: {
        kind: "user",
        key: "user-key-123abc",
        name: "Sandy Smith",
        email: "sandy@example.com",
      },
    })
  );
  return <LDDynaProvider>{children}</LDDynaProvider>;
}