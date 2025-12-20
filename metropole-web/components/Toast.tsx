"use client";

import { AnimatePresence, motion } from "framer-motion";

export default function Toast({
  open,
  title,
  text,
  type = "ok",
  onClose,
}: {
  open: boolean;
  title: string;
  text: string;
  type?: "ok" | "err";
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed right-4 top-24 z-[9999]"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <div
            className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-2xl p-4 w-[320px]"
            style={{ borderColor: type === "err" ? "rgba(255,105,180,.45)" : "rgba(183,255,26,.45)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-black">{title}</div>
                <div className="text-sm text-white/75 mt-1">{text}</div>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
