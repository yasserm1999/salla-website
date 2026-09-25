import type { Metadata } from "next";
import AccountView from "../components/AccountView";

export const metadata: Metadata = {
  title: "My account — Salla",
  description: "See your orders, ask us to collect, or have your washing brought to you.",
};

export default function AccountPage() {
  return <AccountView lang="en" />;
}
