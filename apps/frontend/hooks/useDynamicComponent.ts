"use client";

import { useState, useCallback } from "react";

export interface DynamicComponentState {
  componentKey: string | null;
  componentProps: Record<string, unknown>;
}

export function useDynamicComponent(initialKey: string | null = null) {
  const [state, setState] = useState<DynamicComponentState>({
    componentKey: initialKey,
    componentProps: {},
  });

  const setComponent = useCallback(
    (componentKey: string, componentProps: Record<string, unknown> = {}) => {
      setState({ componentKey, componentProps });
    },
    []
  );

  const clearComponent = useCallback(() => {
    setState({ componentKey: null, componentProps: {} });
  }, []);

  return {
    componentKey: state.componentKey,
    componentProps: state.componentProps,
    setComponent,
    clearComponent,
  };
}