import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui";

/** "How your score is calculated": the "Your PMS score, simply explained" note, word for word */
const EXAMPLES: [string, string, string, string, string][] = [
  ["Person A", "70%", "70%", "70%", "Level on both, so the score is the same number."],
  ["Person B", "100%", "20%", "about 62%", "Goal is done, so it counts more. The low Target still holds the score back."],
  ["Person C", "10%", "200%", "about 39%", "Lots of activity, but almost no result. A very high Target can't hide a very low Goal."],
];

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-6 text-lg font-bold text-ink-900 first:mt-0 dark:text-white">{children}</h3>;
}

/** The explainer video with a large play button in the middle (hidden while it plays) */
function ExplainerVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative mb-2 aspect-video w-full max-w-full bg-black">
      <video ref={ref} src="/videos/pms-score-explained.mp4" controls={playing} playsInline preload="metadata" className="h-full w-full"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}>
        Your browser can't play this video.
      </video>
      {!playing && (
        <button type="button" aria-label="Play video" onClick={() => { void ref.current?.play(); }}
          className="group absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/35 focus-ring">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-white/20 transition-transform group-hover:scale-110">
            <Play size={28} className="ml-1" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}

export function ScoreGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="border-b border-ink-200 text-2xl font-extrabold dark:border-white/10">Your PMS score, simply explained</ModalHeader>
        <ModalBody className="py-5 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
          <ExplainerVideo />
          <p>Your PMS score shows how well you did on two things together: your <b>Goal</b> (the result you deliver) and your <b>Target</b> (the work that gets you there).</p>

          <H>Three things to remember</H>
          <ol className="list-decimal space-y-1 pl-5">
            <li><b>You need both.</b> Like the two wheels of a bicycle, a strong Goal and a strong Target together give the best score.</li>
            <li><b>Your weaker side matters most.</b> If one is low, it pulls your score down, however high the other one is.</li>
            <li><b>Goal comes first.</b> If your Goal is ahead, it counts for more, because it is the main result of your job.</li>
          </ol>

          <H>Quick examples</H>
          <div className="overflow-x-auto border border-ink-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-800"><tr className="text-left">{["", "Goal", "Target", "Score", "Why"].map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {EXAMPLES.map(([who, g, t, sc, why]) => (
                  <tr key={who} className="border-t border-ink-100 align-top dark:border-white/5">
                    <td className="whitespace-nowrap px-3 py-2">{who}</td>
                    <td className="px-3 py-2 tabular-nums">{g}</td>
                    <td className="px-3 py-2 tabular-nums">{t}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{sc}</td>
                    <td className="px-3 py-2">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H>How to raise your score</H>
          <p>Work on your weaker side first. It gives you the biggest jump.</p>
          <p>Your score card shows this for you under <b>What would raise it most</b>. For example, with 83% Goal and 25% Target, lifting Target by 10 points takes the score from about 58% to about 64%. Lifting Goal by the same amount only takes it to about 63%.</p>

          <H>Good to know</H>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>No zero scores.</b> Anything below 5% counts as 5%, so one bad result never wipes out the rest.</li>
            <li><b>You can go above 100%.</b> Beat both your Goal and your Target, and your score goes above 100% (up to 150%).</li>
            <li><b>Your manager can adjust the balance slightly.</b> They can shift up to 5% between Goal and Target. If they do, your score card tells you.</li>
            <li><b>Something looks wrong?</b> Check your daily entries first, then talk to your manager.</li>
          </ul>
        </ModalBody>
        <ModalFooter className="border-t border-ink-200 dark:border-white/10"><Button color="primary" onPress={onClose}>Got it</Button></ModalFooter>
      </ModalContent>
    </Modal>
  );
}
