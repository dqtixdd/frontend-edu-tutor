import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import {
  BiPlus,
  BiUser,
  BiSend,
  BiSolidUserCircle,
  BiTrash,
  BiMessage,
  BiLogOut,
} from "react-icons/bi";
import {
  MdOutlineArrowLeft,
  MdOutlineArrowRight,
  MdSettings,
} from "react-icons/md";
import { SiOpenai } from "react-icons/si";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const GOOGLE_CLIENT_ID =
  "765477991622-t0v92rvh5oq82n2qoik8bs5a1mqu375g.apps.googleusercontent.com";

const makeChatId = () =>
  `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function ChatApp() {
  // --- AUTH STATE ---
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");

  // --- Delete chat/pdf thread ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetChatId, setConfirmTargetChatId] = useState(null);
  const [confirmPdfName, setConfirmPdfName] = useState(null);
  const [confirmKind, setConfirmKind] = useState(null);

  // Auth Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState("");

  // --- Uploading/delete pdf ---
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadFile, setUploadFile] = useState(null);

  const [showPdfPanel, setShowPdfPanel] = useState(false);
  const [pdfList, setPdfList] = useState([]);
  const [pdfListLoading, setPdfListLoading] = useState(false);

  // --- APP STATE ---
  const [cid, setCid] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [k, setK] = useState(6);
  const [isShowSidebar, setIsShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);

  // --- AUTH HANDLERS ---

  // 1. Google Login
  const handleGoogleSuccess = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    setUser({
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      token: credentialResponse.credential,
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem("educationalTutorUser");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // simple guard: must have a token
        if (parsed?.token) {
          setUser(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved user", e);
      }
    }
  }, []);

  // 2. Email/Pass Register
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Registration successful! Please log in.");
      setAuthMode("login");
    } catch (err) {
      setAuthError(err.message || "Registration failed");
    }
  };

  // 3. Email/Pass Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Invalid credentials");

      const data = await res.json();
      const userObj = {
        email: data.email,
        name: data.name,
        picture: data.picture,
        token: data.token,
      };
      setUser(userObj);
      localStorage.setItem("educationalTutorUser", JSON.stringify(userObj));
    } catch (err) {
      setAuthError("Invalid email or password");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setMsgs([]);
    setConversations([]);
    setCid(null);
    setEmail("");
    setPassword("");
    setUsername("");
    localStorage.removeItem("educationalTutorUser");
  };

  // --- API HELPERS ---
  const authFetch = async (endpoint, options = {}) => {
    if (!user?.token) return;
    const headers = {
      ...options.headers,
      "x-token": user.token,
      "Content-Type": "application/json",
    };
    return fetch(`${API_URL}${endpoint}`, { ...options, headers });
  };

  // --- DATA LOADING ---
  useEffect(() => {
    if (user) fetchConversations();
  }, [user]);
  useEffect(() => {
    if (!user) {
      setMsgs([]);
      return;
    }
    if (!cid) {
      setMsgs([]);
      return;
    }
    if (!busy) {
      loadChatHistory(cid);
    }
  }, [cid, user, busy]);

  const fetchConversations = async () => {
    try {
      const res = await authFetch(`/conversations`);
      if (res.ok) setConversations(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadChatHistory = async (id) => {
    try {
      const res = await authFetch(`/conversations/${id}`);
      if (res.ok) setMsgs(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  // --- UPLOAD PDF ---
  const handlePdfUpload = async (e) => {
    e.preventDefault();
    setUploadMsg("");
    setUploadError("");

    if (!uploadFile) {
      setUploadError("Please choose a PDF file first.");
      return;
    }
    if (!user?.token) {
      setUploadError("You must be logged in.");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch(`${API_URL}/upload_pdf`, {
        method: "POST",
        headers: {
          "x-token": user.token,
        },
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Upload failed");
      }

      const data = await res.json();
      const prettyName =
        data.filename && data.filename.includes("_")
          ? data.filename.split("_").slice(1).join("_")
          : data.filename;

      setUploadMsg(
        `Uploaded ${prettyName} (${data.pages} pages, ${data.chunks} chunks).`
      );
      setUploadFile(null);
      await loadPdfList();
    } catch (err) {
      console.error(err);
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const loadPdfList = async () => {
    if (!user?.token) return;
    try {
      setPdfListLoading(true);
      const res = await authFetch(`/pdfs`);
      if (res?.ok) {
        const data = await res.json();
        setPdfList(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPdfListLoading(false);
    }
  };

  const handleTogglePdfPanel = async () => {
    if (!showPdfPanel) {
      await loadPdfList(); // load when opening
    }
    setShowPdfPanel((prev) => !prev);
  };

  // --- CHAT ACTIONS ---
  const handleNewChat = () => {
    setCid(null);
    setMsgs([]);
    if (window.innerWidth <= 640) setIsShowSidebar(false);
  };

  const handleSelectChat = (id) => {
    if (id === cid) return;
    setCid(id);
    if (window.innerWidth <= 640) setIsShowSidebar(false);
  };

  const handleDeleteChat = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;
    await authFetch(`/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (cid === id) handleNewChat();
  };

  const deleteChatConfirmed = async () => {
    if (!confirmTargetChatId) return;
    const id = confirmTargetChatId;
    setConfirmOpen(false);
    setConfirmTargetChatId(null);

    await authFetch(`/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (cid === id) handleNewChat();
  };

  //--- DELETE PDF POPUP ---
  const askDeletePdf = (name) => {
    setConfirmPdfName(name);
    setConfirmTargetChatId(null);
    setConfirmKind("pdf");
    setConfirmOpen(true);
  };

  const deletePdfConfirmed = async () => {
    if (!confirmPdfName) return;
    const name = confirmPdfName;
    setConfirmOpen(false);
    setConfirmPdfName(null);

    await fetch(`${API_URL}/pdfs/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: { "x-token": user.token },
    });
    await loadPdfList(); // refresh list
  };

  // --- CHAT DELETE POPUP ---
  const askDeleteChat = (e, id) => {
    e.stopPropagation();
    setConfirmTargetChatId(id);
    setConfirmPdfName(null);
    setConfirmKind("chat");
    setConfirmOpen(true);
  };

  const send = async (e) => {
    if (e) e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;

    const newMsg = { role: "user", text: q };
    const thinkingMsg = { role: "assistant", text: "", thinking: true };
    setMsgs((prev) => [...prev, newMsg, thinkingMsg]);
    setInput("");
    setBusy(true);

    let activeCid = cid;
    let isNewChat = false;
    if (!activeCid) {
      activeCid = makeChatId();
      isNewChat = true;
      setCid(activeCid);
    }

    try {
      const res = await authFetch(`/chat`, {
        method: "POST",
        body: JSON.stringify({ question: q, k, conversation_id: activeCid }),
      });
      const data = await res.json();
      setMsgs((prev) => {
        const cleanHistory = prev.filter((m) => !m.thinking);
        return [
          ...cleanHistory,
          { role: "assistant", text: data.answer, sources: data.sources },
        ];
      });
      if (isNewChat) fetchConversations();
    } catch (err) {
      setMsgs((prev) => [
        ...prev.filter((m) => !m.thinking),
        { role: "assistant", text: "Error connecting." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);
  useLayoutEffect(() => {
    const handleResize = () => setIsShowSidebar(window.innerWidth > 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- RENDER: LOGIN/REGISTER SCREEN ---
  if (!user) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#343541] text-white">
        <div className="mb-6 rounded-full bg-white/10 p-6">
          <SiOpenai size={50} />
        </div>
        <h1 className="mb-6 text-3xl font-bold">Educational Tutor</h1>

        <div className="w-full max-w-sm rounded-lg bg-[#202123] p-6 shadow-lg">
          {/* Tabs */}
          <div className="mb-6 flex gap-4 border-b border-gray-600 pb-2 text-sm">
            <button
              className={`${
                authMode === "login"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-400"
              }`}
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
                setEmail("");
                setPassword("");
                setUsername("");
              }}
            >
              Login
            </button>

            <button
              className={`${
                authMode === "register"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-400"
              }`}
              onClick={() => {
                setAuthMode("register");
                setAuthError("");
                setEmail("");
                setPassword("");
                setUsername("");
              }}
            >
              Register
            </button>
          </div>

          {authError && (
            <div className="mb-4 text-xs text-red-400">{authError}</div>
          )}

          <form
            onSubmit={authMode === "login" ? handleLogin : handleRegister}
            className="flex flex-col gap-4"
            autoComplete="off"
          >
            {authMode === "register" && (
              <input
                className="rounded bg-gray-700 p-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            )}
            <input
              type="email"
              className="rounded bg-gray-700 p-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete={authMode === "login" ? "email" : "off"}
            />
            <input
              type="password"
              className="rounded bg-gray-700 p-2 text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={
                authMode === "login" ? "current-password" : "new-password"
              }
            />
            <button
              type="submit"
              className="rounded bg-indigo-600 py-2 font-medium hover:bg-indigo-700 transition"
            >
              {authMode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="my-4 flex items-center justify-center text-xs text-gray-500">
            OR
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setAuthError("Google Login Failed")}
              theme="filled_black"
            />
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: MAIN APP ---
  return (
    <div className="flex h-screen overflow-hidden bg-[#343541] text-white font-sans">
      <aside
        className={`flex flex-col bg-[#202123] h-full transition-all duration-300 ${
          isShowSidebar ? "w-[260px]" : "w-0 opacity-0"
        } absolute z-50 sm:relative border-r border-white/10 overflow-hidden`}
      >
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center gap-3 rounded-md border border-white/20 p-3 text-sm hover:bg-gray-900"
          >
            <BiPlus size={16} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li
                key={c.id}
                onClick={() => handleSelectChat(c.id)}
                className={`group flex cursor-pointer items-center justify-between rounded-md px-3 py-3 text-sm hover:bg-[#2A2B32] ${
                  cid === c.id ? "bg-[#343541]" : ""
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <BiMessage size={16} />
                  <span className="truncate">{c.title}</span>
                </div>
                <button
                  onClick={(e) => askDeleteChat(e, c.id)}
                  className="invisible group-hover:visible text-gray-400 hover:text-red-400"
                >
                  <BiTrash size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-white/20 p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-gray-300 mb-2">
            {user.picture ? (
              <img
                src={user.picture}
                alt="User"
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <BiSolidUserCircle size={24} />
            )}
            <div className="font-medium truncate">{user.name}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-gray-400 hover:bg-gray-700"
          >
            <BiLogOut /> Sign Out
          </button>
        </div>
      </aside>

      <main className="relative flex h-full flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center p-2 text-gray-300 sm:hidden bg-[#343541]">
          <button onClick={() => setIsShowSidebar(!isShowSidebar)}>
            {isShowSidebar ? (
              <MdOutlineArrowLeft size={28} />
            ) : (
              <MdOutlineArrowRight size={28} />
            )}
          </button>
          <span className="ml-2 font-medium">RatBot</span>
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth">
          {msgs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <SiOpenai size={40} />
              <h1 className="text-2xl font-semibold">
                Welcome, {user.name.split(" ")[0]}
              </h1>
              <p className="text-sm text-gray-400">
                Ask about what you want to learn.
              </p>
            </div>
          ) : (
            <div className="flex flex-col pb-32">
              {msgs.map((msg, idx) => (
                <div
                  key={idx}
                  className={`w-full border-b border-black/10 dark:border-gray-900/50 ${
                    msg.role === "user" ? "bg-[#343541]" : "bg-[#444654]"
                  }`}
                >
                  <div className="mx-auto flex max-w-3xl gap-4 p-4 text-base md:max-w-2xl">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${
                        msg.role === "user" ? "bg-indigo-500" : "bg-green-500"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <BiUser size={20} />
                      ) : (
                        <SiOpenai size={20} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white mb-1 opacity-90">
                        {msg.role === "user" ? "You" : "Tutor"}
                      </div>
                      {msg.thinking ? (
                        <div className="flex items-center gap-1 h-6">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
                        </div>
                      ) : (
                        <>
                          <div className="whitespace-pre-wrap leading-7 text-gray-100">
                            {msg.text}
                          </div>
                          {msg.sources && (
                            <div className="mt-4 rounded-md bg-black/20 p-3 text-xs text-gray-300">
                              <div className="font-semibold uppercase mb-1 text-gray-500">
                                Sources
                              </div>
                              {msg.sources.map((s, i) => (
                                <div
                                  key={i}
                                  className="truncate text-green-400"
                                >
                                  [{i + 1}] {s.source} p.{s.page}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} className="h-8" />
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#343541] via-[#343541] to-transparent pt-10">
          {/* Small popup for PDFs */}
          {showPdfPanel && (
            <div className="mx-auto max-w-3xl px-4 pb-3 text-xs text-gray-200">
              <div className="rounded-lg bg-[#202123] border border-white/10 p-3 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">Knowledge PDFs</div>
                  <button
                    type="button"
                    onClick={handleTogglePdfPanel}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    Close
                  </button>
                </div>

                {/* Current PDF list */}
                <div className="mb-3 max-h-32 overflow-y-auto border border-white/5 rounded-md p-2 bg-black/20">
                  {pdfListLoading ? (
                    <div className="text-gray-400">Loading...</div>
                  ) : pdfList.length === 0 ? (
                    <div className="text-gray-500">No PDFs uploaded yet.</div>
                  ) : (
                    <ul className="space-y-1">
                      {pdfList.map((name) => {
                        // strip the "<uuid>_" part if present
                        const displayName = name.includes("_")
                          ? name.split("_").slice(1).join("_")
                          : name;

                        return (
                          <li
                            key={name}
                            className="flex items-center justify-between truncate gap-2"
                          >
                            <span className="truncate">• {displayName}</span>
                            <button
                              type="button"
                              onClick={() => askDeletePdf(name)} // still send the full name with uuid
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Upload form */}
                <form
                  onSubmit={handlePdfUpload}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="text-xs text-gray-200"
                  />
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile}
                    className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {uploading ? "Uploading..." : "Upload PDF"}
                  </button>
                </form>

                {uploadMsg && (
                  <div className="mt-1 text-[11px] text-green-400">
                    {uploadMsg}
                  </div>
                )}
                {uploadError && (
                  <div className="mt-1 text-[11px] text-red-400">
                    {uploadError}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat input bar with "knowledge" button on the left */}
          <div className="mx-auto max-w-3xl px-4 pb-6">
            <form
              onSubmit={send}
              className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#40414F] shadow-md px-2 py-1"
            >
              {/* Button to open/close the PDF panel */}
              <button
                type="button"
                onClick={handleTogglePdfPanel}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#343541] text-gray-300 hover:text-white hover:bg-[#3f414e]"
                title="Manage knowledge PDFs"
              >
                <MdSettings size={18} />
              </button>

              <input
                className="flex-1 border-0 bg-transparent px-2 py-2 text-white placeholder-gray-400 focus:ring-0 outline-none"
                placeholder={busy ? "Thinking..." : "Send a message..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                autoFocus
              />

              <button
                type="submit"
                disabled={busy || !input}
                className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:text-white"
              >
                <BiSend size={20} />
              </button>
            </form>
          </div>
        </div>

        {confirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-sm rounded-lg bg-[#202123] border border-white/20 p-4 shadow-xl">
              <h2 className="text-sm font-semibold mb-2">
                {confirmKind === "pdf" ? "Delete PDF?" : "Delete chat?"}
              </h2>

              <p className="text-xs text-gray-300 mb-4">
                {confirmKind === "pdf"
                  ? `This will remove "${confirmPdfName}" from your knowledge base.`
                  : "This will permanently remove the conversation and its messages."}
              </p>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  className="rounded px-3 py-1 border border-white/20 text-gray-300 hover:bg-gray-700"
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmKind(null);
                    setConfirmTargetChatId(null);
                    setConfirmPdfName(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  className="rounded px-3 py-1 bg-red-600 text-white hover:bg-red-700"
                  onClick={
                    confirmKind === "pdf"
                      ? deletePdfConfirmed
                      : deleteChatConfirmed
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ChatApp />
    </GoogleOAuthProvider>
  );
}
