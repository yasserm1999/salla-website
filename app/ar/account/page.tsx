import type { Metadata } from "next";
import AccountView from "../../components/AccountView";

export const metadata: Metadata = {
  title: "حسابي — صلة",
  description: "تابع طلباتك، واطلب استلام ملابسك أو توصيلها إليك.",
};

export default function AccountPageArabic() {
  return <AccountView lang="ar" />;
}
