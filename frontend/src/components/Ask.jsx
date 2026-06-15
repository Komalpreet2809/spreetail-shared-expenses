import { useState, useEffect, useRef } from "react";
import api from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bot, Send, Trash2, HelpCircle, TrendingDown, Scale, Clipboard, Check,
  Database, Info, ShieldCheck, MessageSquare, ListFilter, Cpu
} from "lucide-react";

const SUGGESTIONS = [
  {
    title: "Check balances",
    desc: "Find out who is positive or negative.",
    query: "How much does Rohan owe in total?",
    icon: Scale,
  },
  {
    title: "Settle up steps",
    desc: "Optimized payments to clear all debts.",
    query: "Who should pay Aisha and how much?",
    icon: TrendingDown,
  },
  {
    title: "Highest debtor",
    desc: "Find out who owes the most money.",
    query: "Who owes the most money?",
    icon: HelpCircle,
  },
];

export default function Ask({ groupId }) {
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi! I am the BrokeTogether AI Copilot. Ask me questions about your flat group's expenses, debts, or settlement plans in plain English. Every calculation is validated against our deterministic database engine.",
      ai_used: true,
      model: "System Engine",
      facts: null,
    }
  ]);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState("welcome");
  const [factsTab, setFactsTab] = useState("structured");

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function handleSend(questionText) {
    const text = (questionText || q).trim();
    if (!text) return;

    // Append user message
    const userMsgId = Math.random().toString(36).substring(7);
    const newMessages = [...messages, { id: userMsgId, role: "user", text }];
    setMessages(newMessages);
    setQ("");
    setBusy(true);

    try {
      const { data } = await api.post(`/groups/${groupId}/ask`, { question: text });
      const assistantMsgId = Math.random().toString(36).substring(7);
      
      const responseMessage = {
        id: assistantMsgId,
        role: "assistant",
        text: data.answer,
        ai_used: data.ai_used,
        model: data.model,
        facts: data.facts,
      };

      setMessages((prev) => [...prev, responseMessage]);
      setActiveMessageId(assistantMsgId);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          role: "assistant",
          text: "Sorry, I had trouble communicating with the database parser. Please try again.",
          ai_used: false,
          model: "Error",
          facts: null,
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: "Hi! I am the BrokeTogether AI Copilot. Ask me questions about your flat group's expenses, debts, or settlement plans in plain English. Every calculation is validated against our deterministic database engine.",
        ai_used: true,
        model: "System Engine",
        facts: null,
      }
    ]);
    setActiveMessageId("welcome");
  }

  function copyToClipboard(id, text) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function formatResponseText(text) {
    if (!text) return "";
    
    // Split bold tags **text**
    const blocks = text.split(/(\*\*[^*]+\*\*)/g);
    
    return blocks.map((block, idx) => {
      if (block.startsWith("**") && block.endsWith("**")) {
        const inner = block.slice(2, -2);
        return <strong key={idx} className="font-extrabold text-foreground">{inner}</strong>;
      }
      
      // Highlight numbers and currencies
      const numParts = block.split(/((?:₹|\$)\d+(?:,\d{3})*(?:\.\d+)?|\b\d+(?:,\d{3})*(?:\.\d+)?\b)/g);
      return numParts.map((part, i) => {
        const isNumber = /^(?:₹|\$)?\d+(?:,\d{3})*(?:\.\d+)?$/.test(part) && part.trim().length > 0;
        if (isNumber) {
          return (
            <strong
              key={`${idx}-${i}`}
              className="font-extrabold text-foreground bg-muted-foreground/10 border border-border/20 px-1 py-0.2 rounded font-mono text-xs inline-block"
            >
              {part}
            </strong>
          );
        }
        return part;
      });
    });
  }

  // Find facts of selected or active message
  const activeMsg = messages.find(m => m.id === activeMessageId);
  const activeFacts = activeMsg?.facts;

  return (
    <div className="grid gap-6 lg:grid-cols-5 items-stretch min-h-[500px]">
      {/* Main Chat Area */}
      <Card className="lg:col-span-3 flex flex-col justify-between glow-card overflow-hidden">
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-foreground">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-1.5">
                AI Copilot <Bot className="h-4 w-4 text-muted-foreground animate-pulse" />
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Deterministic financial audit queries</p>
            </div>
          </div>
          {messages.length > 1 && (
            <Button variant="ghost" size="icon" onClick={clearChat} className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Clear chat history">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>

        {/* Message scroll list */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[380px] min-h-[300px]">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                onClick={() => m.facts && setActiveMessageId(m.id)}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"} ${
                  m.facts ? "cursor-pointer group/msg" : ""
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm transition-all ${
                    isUser
                      ? "bg-primary text-primary-foreground rounded-tr-sm shadow-sm"
                      : "bg-muted/40 rounded-tl-sm border border-border/40 text-foreground space-y-2"
                  } ${activeMessageId === m.id && !isUser ? "ring-2 ring-foreground/20 bg-muted/70" : ""}`}
                >
                  <div className="whitespace-pre-line leading-relaxed">
                    {isUser ? m.text : formatResponseText(m.text)}
                  </div>
                  
                  {!isUser && (
                    <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-border/20 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="h-3 w-3" />
                        <span className="font-semibold">{m.model || "Engine"}</span>
                        {m.facts && (
                          <Badge variant="secondary" className="text-[9px] py-0 px-1 hover:bg-muted font-bold transition-all">
                            Click to inspect facts
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(m.id, m.text);
                        }}
                      >
                        {copiedId === m.id ? <Check className="h-3 w-3 text-pos" /> : <Clipboard className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex flex-col items-start mr-auto">
              <div className="flex items-center gap-2.5 bg-muted/20 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3">
                <Bot className="h-4 w-4 animate-bounce text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium animate-pulse">Copilot is querying the engine...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </CardContent>

        {/* Suggestion Grid (shown only when thread has only the welcome message) */}
        {messages.length === 1 && !busy && (
          <div className="px-4 pb-4 grid gap-3 sm:grid-cols-3">
            {SUGGESTIONS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(item.query)}
                  className="text-left border border-border bg-card/50 hover:bg-muted/40 p-3 rounded-xl transition-all duration-200 hover:scale-102 cursor-pointer shadow-sm group"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="p-1.5 bg-muted rounded-lg text-muted-foreground group-hover:text-foreground transition-all">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold text-foreground">{item.title}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">{item.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 border-t border-border flex gap-2 bg-muted/10">
          <Input
            placeholder="Ask AI e.g. Who owes Aisha money?"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={busy}
            className="flex-1 bg-card border-border shadow-inner"
          />
          <Button disabled={busy || !q.trim()} onClick={() => handleSend()} className="shadow-sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Facts Side Inspector Panel */}
      <Card className="lg:col-span-2 glow-card flex flex-col justify-between overflow-hidden">
        <CardHeader className="pb-2 border-b border-border">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" /> Deterministic Engine Context
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">
            Raw ledger parameters audited to generate AI responses.
          </p>
        </CardHeader>
        
        <CardContent className="flex-1 p-3 overflow-y-auto max-h-[360px] min-h-[200px] text-xs">
          {activeFacts ? (
            <div className="space-y-4">
              <div className="flex border-b border-border pb-1 justify-between items-center">
                <span className="font-semibold text-muted-foreground uppercase text-[9px] tracking-wider">Facts Inspector</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFactsTab("structured")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      factsTab === "structured" ? "bg-muted text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Structured
                  </button>
                  <button
                    onClick={() => setFactsTab("json")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      factsTab === "json" ? "bg-muted text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>
              </div>

              {factsTab === "structured" ? (
                <div className="space-y-3">
                  {/* Group Meta Info */}
                  <div className="grid grid-cols-2 gap-2 border border-border/60 rounded-xl p-2.5 bg-muted/15 font-mono text-[10px]">
                    <div>
                      <span className="text-muted-foreground block text-[9px]">Base Currency</span>
                      <span className="font-bold">{activeFacts.currency || "INR"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[9px]">Total Members</span>
                      <span className="font-bold">{activeFacts.net_balances?.length || 0}</span>
                    </div>
                  </div>

                  {/* Balances Audit Trail Table */}
                  {activeFacts.net_balances && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <ListFilter className="h-3 w-3" /> Group Balances Array
                      </div>
                      <div className="border border-border/80 rounded-xl overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/20">
                            <TableRow className="h-7">
                              <TableHead className="py-1 h-7 text-[10px]">Member</TableHead>
                              <TableHead className="py-1 h-7 text-right text-[10px]">Net Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeFacts.net_balances.map((b, idx) => {
                              const isOwed = b.status === "is owed" || Number(b.net) > 0;
                              return (
                                <TableRow key={idx} className="h-7 hover:bg-muted/10">
                                  <TableCell className="py-1 h-7 font-bold font-mono text-[10px]">{b.name}</TableCell>
                                  <TableCell className={`py-1 h-7 text-right font-mono text-[10px] font-semibold ${
                                    isOwed ? "text-pos" : "text-neg"
                                  }`}>
                                    {isOwed ? "+" : ""}{b.net}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Settle Up Directives */}
                  {activeFacts.who_pays_whom && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <Cpu className="h-3 w-3" /> Simplified Settle Up
                      </div>
                      <div className="space-y-1">
                        {activeFacts.who_pays_whom.length === 0 ? (
                          <div className="text-[10px] text-muted-foreground italic p-2 border border-dashed rounded-lg text-center">
                            Everyone fully cleared.
                          </div>
                        ) : (
                          activeFacts.who_pays_whom.map((s, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 rounded-lg border border-border/40 bg-muted/10 font-mono text-[10px]">
                              <div>
                                <span className="font-bold">{s.from}</span>
                                <span className="text-[9px] text-muted-foreground px-1.5">pays</span>
                                <span className="font-bold">{s.to}</span>
                              </div>
                              <span className="font-black">{s.amount}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="overflow-x-auto rounded-lg border border-border bg-background p-2.5 text-[9px] font-mono leading-tight">
                  {JSON.stringify(activeFacts, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl bg-muted/5 min-h-[240px]">
              <Database className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <span className="font-bold text-foreground text-xs block">No audited facts loaded</span>
              <p className="text-[10px] text-muted-foreground max-w-[180px] mt-1">
                Click a response bubble with a database facts badge to inspect its raw relational metadata.
              </p>
            </div>
          )}
        </CardContent>

        {/* Accuracy and constraints compliance footer */}
        <div className="p-3 border-t border-border bg-muted/10 text-[9px] text-muted-foreground flex items-start gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-foreground shrink-0 mt-0.5" />
          <span>
            <strong>Deterministic Core Compliance</strong>: All numbers queried by this agent are retrieved directly from SQLite via minor integer calculation. Hallucinations are physically blocked by local engine checks.
          </span>
        </div>
      </Card>
    </div>
  );
}
