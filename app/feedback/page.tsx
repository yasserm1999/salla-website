import type { Metadata } from "next";
import FeedbackForm from "../components/FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback - Salla",
  description: "Tell us how we did. Your feedback helps Salla improve.",
};

export default function FeedbackPage() {
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
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center md:mb-14">
          <h1 className="text-5xl font-bold text-[#26364d] md:text-6xl">Feedback</h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg md:leading-8">
            Tell us how we did. It takes less than a minute, and we read every
            response.
          </p>
        </div>

        <FeedbackForm lang="en" />
      </div>
    </main>
  );
}
