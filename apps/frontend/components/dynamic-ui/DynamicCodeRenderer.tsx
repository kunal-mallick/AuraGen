"use client";

import React, { useMemo } from "react";
import * as Babel from "@babel/standalone";
interface DynamicCodeRendererProps {
  code: string;
  componentProps?: Record<string, unknown>;
}

type DynamicComponent = React.ComponentType<Record<string, unknown>>;
export default function DynamicCodeRenderer({
  code,
  componentProps = {},
}: DynamicCodeRendererProps) {
  const Component = useMemo<DynamicComponent | null>(() => {
    if (!code.trim()) {
      return null;
    }

    try {
      const result = Babel.transform(code, {
        presets: ["react"],
      });

      const compiledCode = result.code ?? "";
      const createComponent = new Function(
        "React",
        `
        ${compiledCode}
        return GeneratedComponent;
        `,
      ) as (React: typeof import("react")) => DynamicComponent;

      return createComponent(React);
    } catch (error) {
      console.error("Dynamic component compilation failed:", error);
      return null;
    }
  }, [code]);
  if (!Component) {
    return <div>Unable to render generated component.</div>;
  }

  return <Component {...componentProps} />;
}