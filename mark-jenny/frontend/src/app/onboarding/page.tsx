"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { BrainCircuit, ArrowRight, ArrowLeft, Check, Sun, Moon, Monitor, Key, Loader2, Eye, EyeOff } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [themeChoice, setThemeChoice] = useState("dark");
  const [provider, setProvider] = useState("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const token = localStorage.getItem("access_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Save profile
      await fetch(`${API_BASE}/auth/me`, { method: "PATCH", headers, body: JSON.stringify({ full_name: fullName }) });

      // Save API key if provided
      if (apiKey.trim()) {
        await fetch(`${API_BASE}/ai/providers`, {
          method: "POST",
          headers,
          body: JSON.stringify({ provider, api_key: apiKey }),
        });
      }

      setTheme(themeChoice);
      localStorage.setItem("onboarded", "true");
      router.push("/chat");
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  // Leave onboarding without running the finish handler: no theme write, no
  // provider call, just mark it done and go to chat.
  const skipOnboarding = () => {
    localStorage.setItem("onboarded", "true");
    router.replace("/chat");
  };

  const STEPS = [
    {
      title: "What should I call you?",
      content: (
        <div className="space-y-4">
          <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your name" className="text-lg p-4" autoFocus />
          <p className="text-sm text-zinc-500">This is how I&apos;ll address you in conversations.</p>
        </div>
      ),
      canSkip: true,
    },
    {
      title: "Pick your style",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Monitor },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setThemeChoice(t.id)}
                className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${themeChoice === t.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"}`}
              >
                <t.icon className="h-6 w-6" />
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-zinc-500">You can change this anytime in Settings.</p>
        </div>
      ),
    },
    {
      title: "Connect an AI provider",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {["OPENAI", "ANTHROPIC", "GOOGLE", "DEEPSEEK", "OPENROUTER"].map(p => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`p-3 border-2 rounded-lg text-sm font-medium transition-all ${provider === p ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"}`}
              >
                {p === "OPENAI" ? "OpenAI (GPT-4)" : p === "ANTHROPIC" ? "Anthropic (Claude)" : p === "GOOGLE" ? "Google (Gemini)" : p === "DEEPSEEK" ? "DeepSeek" : "OpenRouter"}
              </button>
            ))}
          </div>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Paste your API key (or skip for now)"
              className="pr-10"
            />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-sm text-zinc-500">No key? No problem. You can add one later in Settings → AI Models. The system works with Ollama (free, local) out of the box.</p>
        </div>
      ),
      canSkip: true,
    },
    {
      title: "You're all set!",
      content: (
        <div className="text-center space-y-4 py-4">
          <BrainCircuit className="h-16 w-16 mx-auto text-blue-500" />
          <p className="text-lg">I&apos;m ready to help you build anything.</p>
          <p className="text-sm text-zinc-500">Just tell me what you need in the chat — I handle the rest.</p>
        </div>
      ),
    },
  ];

  const current = STEPS[step];

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <BrainCircuit className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl">{current.title}</CardTitle>
          <div className="flex justify-center gap-1 mt-3">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-blue-500" : i < step ? "w-4 bg-blue-300" : "w-4 bg-zinc-200 dark:bg-zinc-700"}`} />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {current.content}
          <div className="flex justify-between pt-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            ) : <div />}
            <div className="flex gap-2">
              {/* Skip used to advance one step and was hidden on the last step,
                  so there was no way out of onboarding. It now exits to chat. */}
              {current.canSkip && (
                <Button variant="ghost" onClick={skipOnboarding}>Skip</Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(step + 1)}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
              ) : (
                <Button onClick={handleFinish} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Start Using MARK
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

