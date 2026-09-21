import type { Metadata } from "next";
import BellView from "../components/BellView";

export const metadata: Metadata = {
  title: "Ring the Bell — Salla",
  description: "Waiting outside? Ring the bell and a member of staff will come out to your car.",
};

export default function BellPage() {
  return <BellView lang="en" />;
}
