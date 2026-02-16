"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

function resolveInitial<T>(initialValue: T | (() => T)): T {
  return typeof initialValue === "function"
    ? (initialValue as () => T)()
    : initialValue;
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const initialRef = useRef<T>(resolveInitial(initialValue));
  const [value, setValue] = useState<T>(initialRef.current);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fallbackValue = initialRef.current;

    try {
      const storedValue = window.localStorage.getItem(key);
      setValue(storedValue ? (JSON.parse(storedValue) as T) : fallbackValue);
    } catch {
      setValue(fallbackValue);
    } finally {
      setLoaded(true);
    }
  }, [key]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore write failures (private mode / quota / blocked storage).
    }
  }, [key, loaded, value]);

  return [value, setValue];
}

