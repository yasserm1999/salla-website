import type { Metadata } from "next";
import InboxView from "./InboxView";

export const metadata: Metadata = {
  title: "Feedback inbox - Salla",
  // Keep this page out of search results — it is a staff screen.
  robots: { index: false, follow: false },
};

export default function FeedbackInboxPage() {
  return (
    <main
      className="min-h-screen px-4 py-14 md:px-6 md:py-20"
      style={{
        backgroundColor: "#c6c1bb",
        backgroundImage: "url('/pattern.png')",
        backgroundSize: "760px",
        backgroundRepeat: "repeat",
      }}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-[#26364d] md:text-5xl">
            Customer feedback
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#546d83]">
            Everything customers have sent through the feedback form.
          </p>
        </div>

        <InboxView />
      </div>
    </main>
  );
}
