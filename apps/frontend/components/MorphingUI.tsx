"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

interface MorphingUIProps {
  isGenerated: boolean;
  children: React.ReactNode;
}
export default function MorphingUI({
  isGenerated,
  children,
}: MorphingUIProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isGenerated ? "generated" : "static"}
        initial={{
          opacity: 0,
          y: 12,
          scale: 0.98,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
        exit={{
          opacity: 0,
          y: -12,
          scale: 0.98,
        }}
        transition={{
          duration: 0.35,
          ease: "easeInOut",
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}