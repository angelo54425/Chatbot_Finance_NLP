"use client";

import * as React from "react";
import { ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CreateMessage = {
  content: string;
  role: "user" | "assistant";
};

// --- new helpers ----------------
const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","your","what","when","how","why","are","you","not","but","has","have","was","were","a","an","in","on","of","to","is","it"
]);

// Known finance-ish keywords (extend as needed)
const KNOWN_KEYWORDS = new Set([
  "market","stock","stocks","price","prices","trade","trading","investment","invest","portfolio",
  "bond","bonds","dividend","earnings","inflation","rate","rates","interest","yield","cpi",
  "revenue","cashflow","valuation","pe","eps","forecast","analyst","sector","index",
  "crypto","cryptocurrency","bitcoin","ethereum","blockchain","nft","token",
  "economy","economic","gdp","unemployment","jobs","federal","fed","treasury",
  "risk","volatility","hedge","derivative","option","options","future","futures",
  "fund","funds","etf","etfs","mutual fund","mutual funds",
  "tax","taxes","irs",
  "loan","loans","mortgage","mortgages",
  "credit","debit",
  "bank","banks","banking",
  "financial","finance",
  "account","accounts",
  "transaction","transactions",
  "payment","payments",
  "budget","budgets",
  "expense","expenses",
  "savings",
  "retirement",
  "401k",
  "ira",
  "roth","roths",
  "social security","socials","ssi",
  "insurance","insurances",
  "real estate","realestate","property","properties",
  "loan","loans","mortgage","mortgages",
  "credit","debit",
  "bank","banks","banking",
  "financial","finance",
  "account","accounts",
  "transaction","transactions",
  "payment","payments",
  "budget","budgets",
  "expense","expenses",
  "savings",
  "retirement",
]);

// Forbidden / not-supported topics
const FORBIDDEN_TOPICS = new Set([
  "agriculture","farm","farmer","crop","crops","farming",
  "personal","ssn","password","address","private","name","birth","phone",
  "definition","definitions"
]);

function extractKeywords(text: string) {
  const words = (text || "")
    .toLowerCase()
    .match(/\b[a-z]{3,}\b/g) || [];
  const keywords = Array.from(new Set(words.filter(w => !STOPWORDS.has(w))));
  return keywords;
}

function humanizeResponse(text: string) {
  const intros = ["Sure —", "Okay,", "Here’s what I can say:", "I can help with that."];
  const intro = intros[Math.floor(Math.random() * intros.length)];
  // ensure punctuation and spacing
  const body = String(text).trim();
  return `${intro} ${body}`;
}

// persist keywords in localStorage
function loadTracked(): string[] {
  try { return JSON.parse(localStorage.getItem("chat_keywords") || "[]"); } catch { return []; }
}
function saveTracked(list: string[]) {
  try { localStorage.setItem("chat_keywords", JSON.stringify(list)); } catch {}
}
// --- end helpers ----------------

function useLocalChat() {
  const [messages, setMessages] = React.useState<CreateMessage[]>([]);
  const [input, setInput] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);

  // don't access localStorage during SSR — load tracked keywords on mount
  const [tracked, setTracked] = React.useState<string[]>([]);
  const [isMounted, setIsMounted] = React.useState(false);

  const [lastEndpoint, setLastEndpoint] = React.useState<string | null>(null);
  const [lastError, setLastError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsMounted(true);
    try {
      const raw = localStorage.getItem("chat_keywords");
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setTracked(parsed);
    } catch {
      setTracked([]);
    }
  }, []);
 
   const append = (m: CreateMessage) => setMessages((s) => [...s, m]);
 
   const addTracked = (newKeys: string[]) => {
    const merged = Array.from(new Set([...tracked, ...newKeys])).slice(-100);
    setTracked(merged);
    try {
      if (typeof window !== "undefined") localStorage.setItem("chat_keywords", JSON.stringify(merged));
    } catch {}
   };

  // try a list of possible endpoints and use first that responds OK
  const tryFetch = async (endpoints: string[], body: any) => {
    console.log("tryFetch endpoints:", endpoints);
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          console.warn("endpoint returned not ok:", url, res.status);
          continue;
        }
        const data = await res.json();
        setLastEndpoint(url);
        return { url, data };
      } catch (e: any) {
        console.warn("fetch failed for", url, e?.message || e);
        // try next
      }
    }
    throw new Error("All endpoints failed");
  };

  const sendPrompt = async (prompt: string) => {
    setLastError(null);
    // extract and track keywords (do not block on unknowns)
    const keywords = extractKeywords(prompt);
    addTracked(keywords);

    // check forbidden topics first (immediate hard fallback)
    const lower = prompt.toLowerCase();
    for (const f of FORBIDDEN_TOPICS) {
      if (lower.includes(f)) {
        append({ content: "Not familiar teritory", role: "assistant" }); // exact fallback
        return { ok: false, reason: "forbidden" };
      }
    }

    // append user locally then call backend (don't block on unknown keywords)
    append({ content: prompt, role: "user" });

    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const endpoints = [
      `${base}/generate`,
      `${base}/api/chat`,
      `${base}/chat`,
      `${base}/api/generate`,
    ];

    setLoading(true);
    try {
      const { data, url } = await tryFetch(endpoints, { prompt, keywords });

      // prefer common fields and coerce to string; include response for your API
      const assistantTextRaw =
        data?.text ??
        data?.response ??
        data?.generated_text ??
        data?.output ??
        data?.message ??
        data?.result ??
        (Array.isArray(data) && data[0]?.text) ??
        null;

      let assistantText =
        typeof assistantTextRaw === "string"
          ? assistantTextRaw
          : assistantTextRaw == null
          ? ""
          : String(assistantTextRaw);

      assistantText = assistantText.trim();

      const lowConfidence =
        !assistantText ||
        assistantText.length < 20 ||
        /don't know|do not know|not sure|can't|cannot|insufficient|no information|no idea|unknown|false/i.test(assistantText);

      if (lowConfidence) {
        append({
          content: humanizeResponse(
            `I might need a bit more context to answer that clearly. Could you give an example or clarify?`
          ),
          role: "assistant",
        });
        setLoading(false);
        return { ok: false, reason: "clarify", url };
      }

      append({ content: humanizeResponse(assistantText), role: "assistant" });
       setLoading(false);
       return { ok: true, url };
     } catch (err: any) {
       const msg = err?.message || String(err);
       setLastError(msg);
       append({
         content: humanizeResponse("Sorry — I couldn't reach the backend. Please try again in a moment."),
         role: "assistant",
       });
       setLoading(false);
       return { ok: false, reason: "network" };
     }
  };

  return { messages, input, setInput, append, sendPrompt, loading, tracked, isMounted, lastEndpoint, lastError };
}

export function ChatForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { messages, input, setInput, append, sendPrompt, loading, tracked, isMounted, lastEndpoint, lastError } = useLocalChat();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt) return;
    setInput("");
    await sendPrompt(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // submit form programmatically
      const form = (e.currentTarget as HTMLElement).closest("form");
      form?.dispatchEvent(
        new Event("submit", { cancelable: true, bubbles: true })
      );
    }
  };

  const messageList = (
    <div className="my-4 flex h-fit min-h-full flex-col gap-4">
      {messages.map((message, index) => (
        <div
          key={index}
          className={cn(
            "rounded-md px-3 py-2 max-w-[70%] break-words",
            message.role === "user" ? "bg-sky-500 text-white self-end" : "bg-gray-100 self-start"
          )}
        >
          {message.content}
        </div>
      ))}

      {loading && (
        <div className="text-sm text-gray-500 animate-pulse">Assistant is typing...</div>
      )}
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "ring-none mx-auto flex h-svh max-h-svh w-full max-w-[44rem] flex-col items-stretch border-none",
        className
      )}
      {...props}
    >
      {/* show tracked keywords */}
      <div className="px-4 pt-4">
        <div className="text-xs text-gray-500">
          Keywords tracked: {!isMounted ? "—" : tracked.length ? tracked.join(", ") : "—"}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Backend: {lastEndpoint ?? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")}
        </div>
        {lastError && <div className="text-xs text-red-500 mt-1">Last network error: {lastError}</div>}
      </div>

      {/* Centered hero when no messages */}
      {messages.length === 0 ? (
        <div className="flex-1 grid place-items-center p-8">
          <div className="text-center max-w-xl">
            <h1 className="text-2xl font-semibold mb-2">Finance AI Chatbot</h1>
            <p className="text-sm text-gray-500">
              This is an AI chatbot. feel free to ask me any finance related questions.
              <br />
              (e.g., "What is a stock?", "How does inflation affect the economy?", "Explain cryptocurrency.")
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">{messageList}</div>
      )}

      <div className="mt-4 p-4 flex gap-2 bg-white border-t">
        <AutoResizeTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a message"
        />
        <Button type="submit" aria-label="Send" disabled={loading}>
          <ArrowUpIcon />
        </Button>
      </div>
    </form>
  );
}

const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>((props, ref) => {
  const internalRef = React.useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(ref, () => internalRef.current!);

  React.useLayoutEffect(() => {
    const textarea = internalRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 400) + "px";
    }
  }, [props.value]);

  return <textarea {...props} ref={internalRef} rows={1} className="resize-none w-full rounded-lg border px-3 py-2" />;
});
AutoResizeTextarea.displayName = "AutoResizeTextarea";
