import { Feed } from "@/components/Feed";
import { MOCK_CARDS } from "@/data/mockCards";

export default function HomePage() {
  return <Feed cards={MOCK_CARDS} />;
}
