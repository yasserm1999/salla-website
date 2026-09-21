import type { Metadata } from "next";
import BellView from "../../components/BellView";

export const metadata: Metadata = {
  title: "اطلب الخدمة — صلة",
  description: "ابقَ في سيارتك واضغط الجرس، وسيخرج إليك أحد موظفينا.",
};

export default function BellPageArabic() {
  return <BellView lang="ar" />;
}
