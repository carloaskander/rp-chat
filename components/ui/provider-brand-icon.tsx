"use client";

import { SiAnthropic, SiGoogle } from "@icons-pack/react-simple-icons";
import { Bot, MoonStar, Sparkles, Zap } from "lucide-react";

interface ProviderBrandIconProps {
  provider: string;
  className?: string;
}

function toCanonicalProvider(providerRaw: string): string {
  const provider = providerRaw.trim().toLowerCase();

  if (provider === "grok" || provider === "xai" || provider === "x.ai") {
    return "xai";
  }

  if (provider === "google" || provider === "gemini") {
    return "google";
  }

  if (provider === "kimi" || provider === "moonshot" || provider === "moonshot ai") {
    return "moonshot";
  }

  return provider;
}

export function ProviderBrandIcon({ provider, className }: ProviderBrandIconProps) {
  const canonicalProvider = toCanonicalProvider(provider);
  const baseClassName = className ?? "h-4 w-4";

  if (canonicalProvider === "anthropic") {
    return <SiAnthropic className={baseClassName} title="Anthropic" />;
  }

  if (canonicalProvider === "google") {
    return <SiGoogle className={baseClassName} title="Google" />;
  }

  if (canonicalProvider === "moonshot") {
    return <MoonStar className={baseClassName} aria-hidden="true" />;
  }

  if (canonicalProvider === "xai") {
    return <Zap className={baseClassName} aria-hidden="true" />;
  }

  if (canonicalProvider === "openai") {
    return <Sparkles className={baseClassName} aria-hidden="true" />;
  }

  return <Bot className={baseClassName} aria-hidden="true" />;
}
