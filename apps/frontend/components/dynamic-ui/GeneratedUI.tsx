"use client";

import { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import { FallbackUI } from "./FallbackUI";

const componentRegistry: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  card: () => import("./CardWidget"),
  banner: () => import("./BannerWidget"),
};

export interface GeneratedUIProps {
  componentKey: string;
  componentProps?: Record<string, unknown>;
}

export function GeneratedUI({ componentKey, componentProps }: GeneratedUIProps) {
  const LoadedComponent = useMemo(() => {
    const loader = componentRegistry[componentKey];
    if (!loader) return null;

    return dynamic(loader, {
      ssr: false,
      loading: () => <FallbackUI variant="loading" />,
    });
  }, [componentKey]);

  if (!LoadedComponent) {
    return <FallbackUI variant="error" />;
  }

  return (
    <Suspense fallback={<FallbackUI variant="loading" />}>
      <LoadedComponent {...componentProps} />
    </Suspense>
  );
}

export default GeneratedUI;