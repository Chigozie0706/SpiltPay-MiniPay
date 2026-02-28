import { Metadata } from "next";
import { env } from "@/lib/env";
import HomeClient from "./HomeClient";

const appUrl = env.NEXT_PUBLIC_URL;

const frame = {
  version: "next",
  imageUrl: `${appUrl}/images/feed.png`,
  button: {
    title: "Open SplitPay",
    action: {
      type: "launch_frame",
      name: "SplitPay",
      url: appUrl,
      splashImageUrl: `${appUrl}/images/splash.png`,
      splashBackgroundColor: "#10b981",
    },
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "SplitPay",
    openGraph: {
      title: "SplitPay",
      description: "Split bills with Mento stablecoins on Celo",
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default function Page() {
  return <HomeClient />;
}
