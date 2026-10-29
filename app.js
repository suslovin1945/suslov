(() => {
  "use strict";

  const STORAGE_KEY = "sunny-farm-planner-v1";
  const DATE_MARKER_KEY = "time-plan-last-seen-date";
  const SYNC_ENDPOINT = "/api/state";
  const SUPABASE_URL = "https://rfdomwrugsgkkclflucz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_7OkfpeKBiBOHQc77uDRv4A_0TCFXB10";
  const CLOUD_SESSION_KEY = "suslov-cloud-session-v1";
  const GITHUB_SYNC_OWNER = "suslovin1945";
  const GITHUB_SYNC_REPO = "suslov-sync";
  const GITHUB_SYNC_PATH = "state.json";
  const GITHUB_TOKEN_KEY = "suslov-github-sync-token-v1";
  const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const DAY_FULL = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
  const DAY_SHORT = ["一", "二", "三", "四", "五", "六", "日"];
  const TIMETABLE_START = 7 * 60;
  const TIMETABLE_END = 23 * 60;
  const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=31.2304&longitude=121.4737&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=3";
  const WEATHER_FALLBACK = [
    { code: 1, max: 22, min: 15 },
    { code: 2, max: 21, min: 14 },
    { code: 61, max: 19, min: 13 }
  ];
  const now = () => new Date();
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function dateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function parseLocalDate(key, time = "00:00") {
    return new Date(`${key}T${time.length === 5 ? time : "00:00"}:00`);
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function startOfWeek(date = now()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const jsDay = d.getDay();
    const diff = jsDay === 0 ? -6 : 1 - jsDay;
    return addDays(d, diff);
  }

  function isoDay(date = now()) {
    const jsDay = new Date(date).getDay();
    return jsDay === 0 ? 7 : jsDay;
  }

  function minutesFromTime(time = "00:00") {
    const [h, m] = time.split(":").map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }

  function formatDateCN(date, withYear = false) {
    const d = new Date(date);
    return `${withYear ? `${d.getFullYear()}年` : ""}${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function chineseWeekday(date) {
    return `星期${"日一二三四五六"[new Date(date).getDay()]}`;
  }

  function relativeDateText(target) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(target);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return "今天";
    if (diff === 1) return "明天";
    if (diff === -1) return "昨天";
    if (diff > 1) return `${diff} 天后`;
    return `已过 ${Math.abs(diff)} 天`;
  }

  function countdownText(targetDate) {
    const diff = targetDate.getTime() - Date.now();
    if (diff <= 0) {
      const late = Math.abs(diff);
      if (late < 3600000) return `已过期 ${Math.max(1, Math.floor(late / 60000))} 分钟`;
      if (late < 86400000) return `已过期 ${Math.floor(late / 3600000)} 小时`;
      return `已过期 ${Math.floor(late / 86400000)} 天`;
    }
    if (diff < 3600000) return `还剩 ${Math.max(1, Math.ceil(diff / 60000))} 分钟`;
    if (diff < 86400000) return `还剩 ${Math.floor(diff / 3600000)} 小时`;
    return `还剩 ${Math.ceil(diff / 86400000)} 天`;
  }

  function timeGreeting() {
    const hour = now().getHours();
    if (hour < 6) return "夜深了";
    if (hour < 11) return "早上好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }

  function createDefaultState() {
    const today = new Date();
    const todayKey = dateKey(today);
    const tomorrowKey = dateKey(addDays(today, 1));
    const afterKey = dateKey(addDays(today, 3));
    const yesterdayKey = dateKey(addDays(today, -1));
    const daysAgo = (n) => dateKey(addDays(today, -n));
    const semesterStart = "2026-10-19";
    const semesterEnd = "2026-12-25";
    const course = (day, start, end, title, location, parity = "all", note = "") => ({
      id: uid("evt"),
      day,
      start,
      end,
      title,
      location,
      type: "lecture",
      parity,
      validFrom: semesterStart,
      validTo: semesterEnd,
      note
    });

    return {
      version: 7,
      profileName: "suslov",
      selectedDay: isoDay(today),
      weekOffset: 0,
      scheduleStartDate: semesterStart,
      scheduleEndDate: semesterEnd,
      locations: [
        { name: "相辉堂", x: 43, y: 28, icon: "", color: "#e20b1d" },
        { name: "六号楼", x: 53, y: 33, icon: "", color: "#e20b1d" },
        { name: "三号楼", x: 68, y: 36, icon: "", color: "#e20b1d" },
        { name: "二号楼", x: 35, y: 45, icon: "", color: "#e20b1d" },
        { name: "物理楼", x: 80, y: 72, icon: "", color: "#e20b1d" },
        { name: "HGX楼", x: 75, y: 53, icon: "", color: "#e20b1d" },
        { name: "五号楼", x: 48, y: 62, icon: "", color: "#e20b1d" },
        { name: "南区篮球场", x: 17, y: 49, icon: "", color: "#e20b1d" },
        { name: "宿舍", x: 50, y: 52, icon: "", color: "#e20b1d" }
      ],
      transports: {
        "三号楼|二号楼": 4,
        "五号楼|六号楼": 5,
        "六号楼|二号楼": 5,
        "六号楼|相辉堂": 7,
        "六号楼|物理楼": 6,
        "HGX楼|二号楼": 8,
        "南区篮球场|二号楼": 9,
        "HGX楼|五号楼": 10
      },
      events: [
        course(1, "09:55", "11:35", "微积分 A1", "H6112", "all", "周一第 3–4 节"),
        course(1, "12:45", "15:10", "物理楼分组课程（课名未显示）", "H物理楼 209/213/221/225/234", "all", "每周一 12:45 开始，请按所在组别前往"),
        course(2, "08:00", "09:40", "线性代数 A", "H2220", "all", "周二第 1–2 节"),
        course(2, "09:55", "11:35", "大学物理 A", "H2220", "all", "周二第 3–4 节"),
        course(2, "13:30", "15:10", "新时代实践", "H相辉堂北堂", "odd", "单周 · 周二第 6–7 节"),
        course(2, "15:25", "17:05", "新时代实践", "H2218", "even", "双周 · 周二第 8–9 节"),
        course(2, "18:30", "21:05", "物理实验技能（I）", "H物理楼 113", "odd", "单周 · 周二第 11–13 节"),
        course(3, "08:00", "09:40", "龙狮运动（一）", "H南区篮球场", "all", "周三第 1–2 节"),
        course(3, "09:55", "11:35", "微积分 A1", "H6112", "all", "周三第 3–4 节"),
        course(3, "18:30", "20:10", "幸福心理学", "H5301", "all", "周三第 11–12 节"),
        course(4, "08:00", "09:40", "大学物理 A", "H2220", "all", "周四第 1–2 节"),
        course(4, "09:55", "11:35", "线性代数 A", "H2115", "all", "周四第 3–4 节"),
        course(4, "15:25", "18:00", "大学物理 A（研讨/实验）", "H2220", "odd", "单周 · 周四第 8–10 节"),
        course(4, "15:25", "18:00", "大学物理 A（研讨/实验）", "H2220 / H3404 / H3405", "even", "双周 · 周四第 8–10 节"),
        course(4, "18:30", "20:10", "《第一哲学沉思集》", "H3306", "all", "周四第 11–12 节"),
        course(5, "09:55", "11:35", "微积分 A1", "H6112", "all", "周五第 3–4 节"),
        course(5, "13:30", "15:10", "高级英语", "H2112B", "all", "周五第 6–7 节"),
        course(5, "18:30", "21:05", "习近平新时代中国特色社会主义思想概论", "HGX408", "all", "周五第 11–13 节"),
        course(5, "21:15", "22:00", "国家安全教育在线", "在线", "all", "周五第 14 节")
      ],
      chores: [
        { id: uid("chore"), name: "洗衣服", icon: "👕", cycleDays: 3, lastDone: new Date(Date.now() - 2.25 * 86400000).toISOString(), createdAt: daysAgo(14) },
        { id: uid("chore"), name: "给绿植浇水", icon: "🪴", cycleDays: 2, lastDone: new Date(Date.now() - 0.6 * 86400000).toISOString(), createdAt: daysAgo(8) },
        { id: uid("chore"), name: "整理书桌", icon: "🗂️", cycleDays: 5, lastDone: new Date(Date.now() - 5.1 * 86400000).toISOString(), createdAt: daysAgo(20) },
        { id: uid("chore"), name: "换床单", icon: "🛏️", cycleDays: 7, lastDone: new Date(Date.now() - 10.3 * 86400000).toISOString(), createdAt: daysAgo(30) }
      ],
      urgent: [
        {
          id: uid("urgent"),
          title: "社团海报初稿",
          category: "deadline",
          date: todayKey,
          dueTime: "18:30",
          start: "",
          end: "",
          location: "",
          priority: "high",
          note: "先发一版主视觉给社长确认",
          completed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: uid("urgent"),
          title: "归还借阅资料",
          category: "time",
          date: tomorrowKey,
          dueTime: "17:00",
          start: "16:00",
          end: "17:00",
          location: "图书馆",
          priority: "medium",
          note: "两本画册，记得检查贴纸",
          completed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: uid("urgent"),
          title: "提交宿舍报修单",
          category: "deadline",
          date: afterKey,
          dueTime: "20:00",
          start: "",
          end: "",
          location: "宿舍",
          priority: "low",
          note: "台灯插座接触不良",
          completed: false,
          createdAt: new Date().toISOString()
        }
      ],
      habits: [
        {
          id: uid("habit"),
          name: "阅读 20 分钟",
          icon: "📖",
          reminder: "20:30",
          color: "#719d61",
          records: [0, 1, 2, 3, 5, 6, 7, 9].map(daysAgo)
        },
        {
          id: uid("habit"),
          name: "背 30 个单词",
          icon: "🔤",
          reminder: "08:10",
          color: "#d99a58",
          records: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11].map(daysAgo)
        },
        {
          id: uid("habit"),
          name: "喝够 6 杯水",
          icon: "💧",
          reminder: "18:00",
          color: "#6e9d9d",
          records: [1, 2, 4, 6, 7].map(daysAgo)
        },
        {
          id: uid("habit"),
          name: "睡前伸展",
          icon: "🌙",
          reminder: "22:30",
          color: "#9b8bb3",
          records: [0, 2, 3, 4, 5, 6, 8, 9].map(daysAgo)
        }
      ],
      settings: {
        notifications: false
      }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      const fallback = createDefaultState();
      if (!parsed) return fallback;
      let migrated = parsed;
      if (migrated.version === 1) {
        migrated = {
          ...parsed,
          version: 2,
          events: fallback.events,
          scheduleStartDate: fallback.scheduleStartDate,
          scheduleEndDate: fallback.scheduleEndDate,
          selectedDay: isoDay(now()),
          weekOffset: 0
        };
      }
      if (migrated.version === 2) {
        const currentEvents = Array.isArray(migrated.events) ? migrated.events : fallback.events;
        migrated = {
          ...migrated,
          version: 3,
          events: currentEvents.map((event) => {
            const isMondayLab = Number(event.day) === 1
              && event.start === "13:30"
              && String(event.title || "").includes("物理楼分组课程");
            return isMondayLab
              ? {
                  ...event,
                  start: "12:45",
                  note: "每周一 12:45 开始，请按所在组别前往"
                }
              : event;
          })
        };
      }
      if (migrated.version === 3) {
        migrated = {
          ...migrated,
          version: 4,
          profileName: migrated.profileName === "小穗" || !migrated.profileName ? "suslov" : migrated.profileName
        };
      }
      if (migrated.version === 4) {
        migrated = {
          ...migrated,
          version: 5,
          urgent: Array.isArray(migrated.urgent)
            ? migrated.urgent.map((item) => (
                item.title === "社团海报初稿" && item.location === "设计楼"
                  ? { ...item, location: "" }
                  : item
              ))
            : fallback.urgent
        };
      }
      if (migrated.version === 5) {
        const relevantEvents = Array.isArray(migrated.events) ? migrated.events : [];
        const relevantUrgent = Array.isArray(migrated.urgent) ? migrated.urgent : [];
        const normalizedUrgent = relevantUrgent.map((item) => (
          item.title === "社团海报初稿" && item.location === "设计楼"
            ? { ...item, location: "" }
            : item
        ));
        const relevantNames = new Set([
          ...relevantEvents.map((event) => mapLocationName(event.location)),
          ...normalizedUrgent.map((item) => mapLocationName(item.location)),
          "宿舍"
        ].filter(Boolean));
        migrated = {
          ...migrated,
          version: 6,
          urgent: normalizedUrgent,
          locations: (Array.isArray(migrated.locations) ? migrated.locations : fallback.locations)
            .filter((location) => relevantNames.has(location.name)),
          transports: Object.fromEntries(
            Object.entries(migrated.transports || {}).filter(([key]) => {
              const [from, to] = key.split("|");
              return relevantNames.has(from) && relevantNames.has(to);
            })
          )
        };
      }
      if (migrated.version === 6) {
        const relevantEvents = Array.isArray(migrated.events) ? migrated.events : [];
        const relevantUrgent = Array.isArray(migrated.urgent)
          ? migrated.urgent.map((item) => (
              item.title === "社团海报初稿" && item.location === "H楼"
                ? { ...item, location: "" }
                : item
            ))
          : [];
        const relevantNames = new Set([
          ...relevantEvents.map((event) => mapLocationName(event.location)),
          ...relevantUrgent.map((item) => mapLocationName(item.location)),
          "宿舍"
        ].filter(Boolean));
        migrated = {
          ...migrated,
          version: 7,
          urgent: relevantUrgent,
          locations: (Array.isArray(migrated.locations) ? migrated.locations : fallback.locations)
            .filter((location) => relevantNames.has(location.name)),
          transports: Object.fromEntries(
            Object.entries(migrated.transports || {}).filter(([key]) => {
              const [from, to] = key.split("|");
              return relevantNames.has(from) && relevantNames.has(to);
            })
          )
        };
      }
      if (migrated.version !== 7) return fallback;
      return {
        ...fallback,
        ...migrated,
        settings: { ...fallback.settings, ...(migrated.settings || {}) },
        locations: Array.isArray(migrated.locations) && migrated.locations.length ? migrated.locations : fallback.locations,
        transports: migrated.transports && typeof migrated.transports === "object" ? migrated.transports : fallback.transports,
        events: Array.isArray(migrated.events) ? migrated.events : fallback.events,
        chores: Array.isArray(migrated.chores) ? migrated.chores : fallback.chores,
        urgent: Array.isArray(migrated.urgent) ? migrated.urgent : fallback.urgent,
        habits: Array.isArray(migrated.habits) ? migrated.habits : fallback.habits
      };
    } catch {
      return createDefaultState();
    }
  }

  let state = loadState();
  let currentPage = "schedule";
  let modalSubmitHandler = null;
  let fallAnimationShown = false;
  let weatherDays = WEATHER_FALLBACK;
  let weatherIsLive = false;
  let dateTransitionBusy = false;
  let observedDateKey = dateKey(now());
  let syncReady = false;
  let syncInFlight = false;
  let syncPending = false;
  let remoteRevision = 0;
  let syncTimer = null;
  let cloudRevision = 0;
  let cloudSession = (() => {
    try {
      return JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY) || "null");
    } catch {
      return null;
    }
  })();
  let githubToken = localStorage.getItem(GITHUB_TOKEN_KEY) || "";
  let githubFileSha = "";
  let githubRevision = 0;
  const notifiedKeys = new Set();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (syncReady) scheduleSync();
    } catch {
      showToast("暂时无法保存", "浏览器本地存储空间可能已满。", "sprout");
    }
  }

  function setSyncStatus(status, text) {
    const stateElement = $("#syncState");
    if (!stateElement) return;
    stateElement.dataset.status = status;
    $("#syncStatusText").textContent = text;
  }

  function scheduleSync() {
    syncPending = true;
    setSyncStatus("syncing", "同步中");
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncActive(), 300);
  }

  function applySyncedState(remoteState) {
    if (!remoteState || typeof remoteState !== "object") return;
    state = {
      ...state,
      ...remoteState,
      settings: { ...state.settings, ...(remoteState.settings || {}) },
      locations: Array.isArray(remoteState.locations) ? remoteState.locations : state.locations,
      transports: remoteState.transports && typeof remoteState.transports === "object" ? remoteState.transports : state.transports,
      events: Array.isArray(remoteState.events) ? remoteState.events : state.events,
      chores: Array.isArray(remoteState.chores) ? remoteState.chores : state.chores,
      urgent: Array.isArray(remoteState.urgent) ? remoteState.urgent : state.urgent,
      habits: Array.isArray(remoteState.habits) ? remoteState.habits : state.habits
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    ensureAllEventLocations();
    renderAll();
  }

  function persistCloudSession(session) {
    cloudSession = session;
    if (session) {
      localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(CLOUD_SESSION_KEY);
    }
  }

  function cloudHeaders(accessToken = cloudSession?.access_token) {
    return {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    };
  }

  async function cloudAuth(path, body, accessToken = SUPABASE_KEY) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.msg || payload.error_description || payload.message || "Supabase authentication failed");
      error.status = response.status;
      error.code = payload.error_code || payload.code;
      throw error;
    }
    return payload;
  }

  function normalizeCloudSession(payload) {
    if (!payload?.access_token || !payload?.refresh_token || !payload?.user?.id) return null;
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: Date.now() + (Number(payload.expires_in) || 3600) * 1000,
      user_id: payload.user.id
    };
  }

  async function refreshCloudSession() {
    if (!cloudSession?.refresh_token) throw new Error("Cloud session missing");
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: cloudSession.refresh_token }),
      signal: AbortSignal.timeout(12000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      persistCloudSession(null);
      throw new Error(payload.msg || "Cloud session expired");
    }
    const normalized = normalizeCloudSession(payload);
    if (!normalized) throw new Error("Cloud refresh response invalid");
    persistCloudSession(normalized);
  }

  async function ensureCloudSession() {
    if (!cloudSession?.access_token) throw new Error("Cloud sync is not connected");
    if (Number(cloudSession.expires_at || 0) - Date.now() < 60000) {
      await refreshCloudSession();
    }
    return cloudSession;
  }

  async function deriveCloudCredentials(code) {
    const normalized = String(code || "").trim();
    if (normalized.length < 12) throw new Error("同步码至少需要 12 个字符");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`suslov-cloud:${normalized}`));
    const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return {
      email: `sync-${hex.slice(0, 40)}@example.com`,
      password: `${hex.slice(40, 64)}Aa1!`
    };
  }

  async function connectCloudWithCode(code) {
    const credentials = await deriveCloudCredentials(code);
    let payload;
    try {
      payload = await cloudAuth("token?grant_type=password", {
        email: credentials.email,
        password: credentials.password
      });
    } catch (signInError) {
      try {
        payload = await cloudAuth("signup", {
          email: credentials.email,
          password: credentials.password
        });
      } catch (signUpError) {
        throw new Error(signUpError.message || signInError.message);
      }
    }
    const session = normalizeCloudSession(payload);
    if (!session) throw new Error("云端账号已创建，但未返回登录会话。请检查 Supabase Email 自动确认设置。");
    persistCloudSession(session);
    cloudRevision = 0;
    syncPending = false;
    await syncWithSupabase();
  }

  async function syncWithSupabase() {
    if (!cloudSession?.access_token || syncInFlight) return;
    syncInFlight = true;
    try {
      setSyncStatus("syncing", "同步中");
      const session = await ensureCloudSession();
      const userId = session.user_id;
      let currentRevision = cloudRevision;

      if (syncPending) {
        const nextRevision = Math.max(currentRevision + 1, Date.now());
        const pushResponse = await fetch(`${SUPABASE_URL}/rest/v1/planner_states?on_conflict=user_id`, {
          method: "POST",
          headers: {
            ...cloudHeaders(session.access_token),
            "Prefer": "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify([{
            user_id: userId,
            state,
            revision: nextRevision,
            updated_at: new Date().toISOString()
          }]),
          signal: AbortSignal.timeout(12000)
        });
        if (!pushResponse.ok) throw new Error("Cloud push failed");
        cloudRevision = nextRevision;
        currentRevision = nextRevision;
        syncPending = false;
      }

      const pullResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/planner_states?select=state,revision&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
        {
          headers: cloudHeaders(session.access_token),
          cache: "no-store",
          signal: AbortSignal.timeout(12000)
        }
      );
      if (!pullResponse.ok) throw new Error("Cloud pull failed");
      const rows = await pullResponse.json();
      if (!rows.length) {
        syncPending = true;
        setSyncStatus("syncing", "同步中");
        syncInFlight = false;
        await syncWithSupabase();
        return;
      }
      const remoteRevisionValue = Number(rows[0].revision) || 0;
      if (remoteRevisionValue > currentRevision && !syncPending) {
        cloudRevision = remoteRevisionValue;
        applySyncedState(rows[0].state);
      } else if (!cloudRevision) {
        cloudRevision = remoteRevisionValue;
      }
      setSyncStatus("synced", "云端已同步");
    } catch (error) {
      setSyncStatus("offline", syncPending ? "云端待同步" : "云端不可用");
      console.warn("Cloud sync unavailable:", error.message);
    } finally {
      syncInFlight = false;
    }
  }

  function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function decodeBase64Utf8(value) {
    const binary = atob(String(value || "").replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function githubHeaders() {
    return {
      "Authorization": `Bearer ${githubToken}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };
  }

  async function syncWithGitHub() {
    if (!githubToken || syncInFlight) return false;
    syncInFlight = true;
    let succeeded = false;
    try {
      setSyncStatus("syncing", "同步中");
      const contentUrl = `https://api.github.com/repos/${GITHUB_SYNC_OWNER}/${GITHUB_SYNC_REPO}/contents/${GITHUB_SYNC_PATH}`;
      let remote = null;
      const pullResponse = await fetch(`${contentUrl}?ref=main&t=${Date.now()}`, {
        headers: githubHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      });
      if (pullResponse.ok) {
        const file = await pullResponse.json();
        githubFileSha = file.sha;
        const parsed = JSON.parse(decodeBase64Utf8(file.content));
        remote = parsed;
      } else if (pullResponse.status !== 404) {
        throw new Error(pullResponse.status === 401 ? "GitHub 令牌无效或没有仓库权限" : "GitHub 读取失败");
      } else {
        syncPending = true;
      }

      if (syncPending) {
        const nextRevision = Math.max(githubRevision + 1, Date.now());
        const payload = {
          revision: nextRevision,
          updatedAt: new Date().toISOString(),
          state
        };
        const body = {
          message: `Sync planner data ${new Date().toISOString()}`,
          content: encodeBase64Utf8(JSON.stringify(payload)),
          branch: "main"
        };
        if (githubFileSha) body.sha = githubFileSha;
        const pushResponse = await fetch(contentUrl, {
          method: "PUT",
          headers: githubHeaders(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000)
        });
        if (!pushResponse.ok) throw new Error("GitHub 写入失败");
        const pushed = await pushResponse.json();
        githubFileSha = pushed.content?.sha || githubFileSha;
        githubRevision = nextRevision;
        syncPending = false;
        setSyncStatus("synced", "云端已同步");
        succeeded = true;
        return true;
      }

      const remoteRevisionValue = Number(remote?.revision) || 0;
      if (remote?.state && remoteRevisionValue > githubRevision && !syncPending) {
        githubRevision = remoteRevisionValue;
        applySyncedState(remote.state);
      } else if (!githubRevision) {
        githubRevision = remoteRevisionValue;
      }
      setSyncStatus("synced", "云端已同步");
      succeeded = true;
    } catch (error) {
      setSyncStatus("offline", syncPending ? "云端待同步" : "云同步失败");
      console.warn("GitHub sync unavailable:", error.message);
    } finally {
      syncInFlight = false;
    }
    return succeeded;
  }

  async function syncActive() {
    if (githubToken) {
      await syncWithGitHub();
    } else if (cloudSession?.access_token) {
      await syncWithSupabase();
    } else {
      await syncWithServer();
    }
  }

  async function syncWithServer() {
    if (!/^https?:$/.test(window.location.protocol) || syncInFlight) return;
    syncInFlight = true;
    try {
      if (syncPending) {
        setSyncStatus("syncing", "同步中");
        const pushResponse = await fetch(SYNC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
          signal: AbortSignal.timeout(6000)
        });
        if (!pushResponse.ok) throw new Error("sync push failed");
        const pushed = await pushResponse.json();
        remoteRevision = Number(pushed.revision) || remoteRevision;
        syncPending = false;
      }
      const pullResponse = await fetch(SYNC_ENDPOINT, {
        cache: "no-store",
        signal: AbortSignal.timeout(6000)
      });
      if (!pullResponse.ok) throw new Error("sync pull failed");
      const remote = await pullResponse.json();
      if (!remote?.state) {
        const seedResponse = await fetch(SYNC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
          signal: AbortSignal.timeout(6000)
        });
        if (!seedResponse.ok) throw new Error("sync seed failed");
        const seeded = await seedResponse.json();
        remoteRevision = Number(seeded.revision) || 1;
        setSyncStatus("synced", "已同步");
        return;
      }
      if (remote?.state && Number(remote.revision) > remoteRevision && !syncPending) {
        remoteRevision = Number(remote.revision);
        applySyncedState(remote.state);
      }
      setSyncStatus("synced", "已同步");
    } catch {
      setSyncStatus("offline", syncPending ? "离线·待同步" : "同步不可用");
    } finally {
      syncInFlight = false;
    }
  }

  async function initializeSync() {
    if (!/^https?:$/.test(window.location.protocol)) {
      setSyncStatus("local", "离线版");
      return;
    }
    setSyncStatus("syncing", "同步中");
    syncReady = true;
    if (githubToken) {
      await syncWithGitHub();
    } else if (cloudSession?.access_token) {
      await syncWithSupabase();
    } else {
      await syncWithServer();
    }
    setInterval(syncActive, 8000);
  }

  function showToast(title, message = "", iconName = "check") {
    const region = $("#toastRegion");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span class="toast-icon">${icon(iconName)}</span><div><b>${escapeHtml(title)}</b><small>${escapeHtml(message)}</small></div>`;
    region.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("leaving");
      setTimeout(() => toast.remove(), 270);
    }, 3000);
  }

  function weatherVisual(code) {
    if (code === 0 || code === 1) return { icon: "sun", label: "晴间多云" };
    if (code >= 51 && code <= 82) return { icon: "rain", label: "有雨" };
    if (code >= 95) return { icon: "rain", label: "雷雨" };
    return { icon: "cloud", label: "多云" };
  }

  function renderWeather() {
    const labels = ["今天", "明天", "后天"];
    if (!$("#weatherDays")) return;
    $("#weatherDays").innerHTML = weatherDays.slice(0, 3).map((item, index) => {
      const date = item.time ? parseLocalDate(item.time) : addDays(now(), index);
      const visual = weatherVisual(Number(item.code));
      return `
        <div class="weather-day ${index === 0 ? "today" : ""}">
          <span class="weather-day-name">${labels[index]}</span>
          <small>${date.getMonth() + 1}/${date.getDate()}</small>
          <span class="weather-mini-icon" aria-label="${visual.label}">${icon(visual.icon)}</span>
          <b>${Math.round(item.max)}°</b>
          <em>${Math.round(item.min)}°</em>
        </div>`;
    }).join("");
    $("#weatherSource").textContent = weatherIsLive ? "联网预报 · 上海" : "示例预报 · 当前无法联网";
    $("#weatherSource").classList.toggle("live", weatherIsLive);
  }

  async function loadWeather() {
    try {
      const response = await fetch(WEATHER_URL, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("weather request failed");
      const data = await response.json();
      const daily = data?.daily;
      if (!daily || !Array.isArray(daily.time) || daily.time.length < 3) throw new Error("weather data incomplete");
      weatherDays = daily.time.slice(0, 3).map((time, index) => ({
        time,
        code: Number(daily.weather_code[index]),
        max: Number(daily.temperature_2m_max[index]),
        min: Number(daily.temperature_2m_min[index])
      }));
      weatherIsLive = true;
    } catch {
      weatherDays = WEATHER_FALLBACK;
      weatherIsLive = false;
    }
    renderWeather();
  }

  function weekdayEnglish(date) {
    return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(date).getDay()];
  }

  function playDateTransition(fromDate = addDays(now(), -1), toDate = now()) {
    const overlay = $("#p5DateTransition");
    if (!overlay || dateTransitionBusy) return;
    dateTransitionBusy = true;
    const target = new Date(toDate);
    const previous = new Date(fromDate);
    $("#dtOld").textContent = `FROM ${String(previous.getMonth() + 1).padStart(2, "0")}.${String(previous.getDate()).padStart(2, "0")} ${weekdayEnglish(previous)}`;
    $("#dtWeekEn").textContent = weekdayEnglish(target);
    $("#dtWeekCn").textContent = chineseWeekday(target);
    $("#dtMonth").textContent = String(target.getMonth() + 1).padStart(2, "0");
    $("#dtDay").textContent = String(target.getDate()).padStart(2, "0");
    $("#dtYear").textContent = String(target.getFullYear());
    $("#dtAnnouncement").textContent = `日期已切换到 ${formatDateCN(target)}，${chineseWeekday(target)}。`;
    overlay.classList.remove("active");
    void overlay.offsetWidth;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    setTimeout(() => {
      overlay.classList.remove("active");
      overlay.setAttribute("aria-hidden", "true");
      dateTransitionBusy = false;
    }, 3100);
  }

  function confetti(count = 24) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#e20b1d", "#111111", "#ffe45b", "#f7f0e3", "#ef3f68"];
    const layer = $("#confettiLayer");
    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti";
      piece.style.left = `${10 + Math.random() * 80}%`;
      piece.style.top = "-20px";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.35}s`;
      piece.style.transform = `rotate(${Math.random() * 90}deg)`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 2600);
    }
  }

  function getEventDay(event) {
    const n = Number(event.day);
    return n === 0 ? 7 : n;
  }

  function selectedWeekStart() {
    return addDays(startOfWeek(now()), state.weekOffset * 7);
  }

  function selectedDate() {
    return addDays(selectedWeekStart(), state.selectedDay - 1);
  }

  function weekParityForDate(date) {
    const reference = startOfWeek(parseLocalDate(state.scheduleStartDate || "2026-10-19"));
    const target = startOfWeek(date);
    const weeks = Math.round((target - reference) / (7 * 86400000));
    return ((weeks % 2) + 2) % 2 === 0 ? "odd" : "even";
  }

  function eventAppliesToDate(event, date) {
    const key = dateKey(date);
    if (event.validFrom && key < event.validFrom) return false;
    if (event.validTo && key > event.validTo) return false;
    if (event.parity && event.parity !== "all" && event.parity !== weekParityForDate(date)) return false;
    return true;
  }

  const MAP_LAYOUT = {
    "一号楼": { x: 27, y: 34, icon: "", color: "#e20b1d" },
    "二号楼": { x: 35, y: 45, icon: "", color: "#e20b1d" },
    "三号楼": { x: 68, y: 36, icon: "", color: "#e20b1d" },
    "四号楼": { x: 61, y: 49, icon: "", color: "#e20b1d" },
    "五号楼": { x: 48, y: 62, icon: "", color: "#e20b1d" },
    "六号楼": { x: 53, y: 33, icon: "", color: "#e20b1d" },
    "七号楼": { x: 37, y: 26, icon: "", color: "#e20b1d" },
    "八号楼": { x: 31, y: 55, icon: "", color: "#e20b1d" },
    "九号楼": { x: 58, y: 65, icon: "", color: "#e20b1d" },
    "物理楼": { x: 80, y: 72, icon: "", color: "#e20b1d" },
    "相辉堂": { x: 43, y: 28, icon: "", color: "#e20b1d" },
    "南区篮球场": { x: 17, y: 49, icon: "", color: "#e20b1d" },
    "HGX楼": { x: 75, y: 53, icon: "", color: "#e20b1d" },
    "宿舍": { x: 50, y: 52, icon: "", color: "#e20b1d" }
  };

  function ensureLocation(name) {
    const clean = mapLocationName(String(name || "").trim());
    if (!clean) return;
    const existing = state.locations.find((loc) => loc.name === clean);
    if (existing) {
      if (MAP_LAYOUT[clean]) Object.assign(existing, MAP_LAYOUT[clean]);
      return;
    }
    const known = [
      { test: /图书|阅览/, icon: "📚", color: "#6f8f8d" },
      { test: /设计|艺术|画室/, icon: "🎨", color: "#c57b55" },
      { test: /食堂|餐|咖啡/, icon: "🥣", color: "#c98b53" },
      { test: /宿舍|寝室|家/, icon: "🏠", color: "#a55f4a" },
      { test: /楼|教室|学院|实验/, icon: "🏫", color: "#6f9364" }
    ];
    const found = known.find((entry) => entry.test.test(clean)) || { icon: "📍", color: "#728c69" };
    const hash = hashString(clean);
    const occupied = state.locations.length;
    const mapped = MAP_LAYOUT[clean];
    state.locations.push({
      name: clean,
      x: mapped?.x ?? 18 + ((hash % 64) + occupied * 3) % 65,
      y: mapped?.y ?? 30 + (((hash >> 4) % 44) + occupied * 5) % 47,
      icon: mapped?.icon || found.icon,
      color: mapped?.color || found.color
    });
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function findLocation(name) {
    return state.locations.find((loc) => loc.name === name) ||
      { name: name || "农场里", x: 50, y: 75, icon: "📍", color: "#6f9364" };
  }

  function transportKey(from, to) {
    return [from, to].sort((a, b) => a.localeCompare(b, "zh-CN")).join("|");
  }

  function transportMinutes(from, to) {
    if (!from || !to || from === to) return 0;
    const value = Number(state.transports[transportKey(from, to)]);
    return Number.isFinite(value) && value > 0 ? value : 8;
  }

  function activeUrgent() {
    return state.urgent.filter((item) => !item.completed);
  }

  function urgentDeadlineDate(item) {
    return parseLocalDate(item.date || dateKey(now()), item.dueTime || item.end || "23:59");
  }

  function urgentScheduleEventsForDate(key) {
    return activeUrgent()
      .filter((item) => item.date === key)
      .map((item) => {
        if (item.category === "time" && item.start && item.end) {
          return {
            id: item.id,
            source: "urgent",
            title: item.title,
            start: item.start,
            end: item.end,
            location: item.location || "",
            type: "urgent-event",
            note: "突发占用"
          };
        }
        const due = item.dueTime || "23:59";
        return {
          id: item.id,
          source: "urgent",
          title: `截止 · ${item.title}`,
          start: due,
          end: addMinutesToTime(due, 20),
          location: item.location || "",
          type: "deadline-event",
          note: "突发截止"
        };
      });
  }

  function addMinutesToTime(time, minutes) {
    const total = Math.min(23 * 60 + 59, minutesFromTime(time) + minutes);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function scheduleEventsForDate(date) {
    const key = dateKey(date);
    const recurring = state.events
      .filter((event) => getEventDay(event) === isoDay(date) && eventAppliesToDate(event, date))
      .map((event) => ({ ...event, source: "event", type: event.type || "lecture" }));
    return [...recurring, ...urgentScheduleEventsForDate(key)].sort((a, b) => minutesFromTime(a.start) - minutesFromTime(b.start));
  }

  function mapLocationName(location) {
    const name = String(location || "").trim();
    if (!name) return "";
    if (/^(在线|线上|网课)$/.test(name)) return "";
    if (name.includes("物理楼")) return "物理楼";
    if (name.includes("篮球场")) return "南区篮球场";
    if (name.includes("相辉堂")) return "相辉堂";
    if (/^HGX/i.test(name)) return "HGX楼";
    const buildingMatch = name.match(/^H(\d)/i);
    if (buildingMatch) {
      const buildingNames = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
      return `${buildingNames[Number(buildingMatch[1])] || buildingMatch[1]}号楼`;
    }
    return name;
  }

  function currentOrNextScheduleInfo() {
    const today = now();
    const isToday = dateKey(selectedDate()) === dateKey(today);
    const events = scheduleEventsForDate(selectedDate());
    if (!events.length) {
      const dorm = findLocation("宿舍");
      return { location: dorm, state: "free", current: null, next: null, isToday };
    }
    if (!isToday) {
      const first = events[0];
      return { location: findLocation(mapLocationName(first.location) || "宿舍"), state: "future", current: null, next: first, isToday };
    }
    const minute = today.getHours() * 60 + today.getMinutes();
    const current = events.find((event) => minutesFromTime(event.start) <= minute && minutesFromTime(event.end) > minute);
    if (current) {
      return { location: findLocation(mapLocationName(current.location) || "宿舍"), state: "current", current, next: null, isToday };
    }
    const next = events.find((event) => minutesFromTime(event.start) > minute);
    const previous = [...events].reverse().find((event) => minutesFromTime(event.end) <= minute);
    const locationName = mapLocationName(previous?.location) || "宿舍";
    return { location: findLocation(locationName), state: "between", current: previous || null, next: next || null, isToday };
  }

  function choreStatus(chore) {
    const cycle = Math.max(0.05, Number(chore.cycleDays) || 1);
    const elapsed = Math.max(0, (Date.now() - new Date(chore.lastDone).getTime()) / 86400000);
    const ratio = elapsed / cycle;
    let status = "fresh";
    if (ratio >= 1.35) status = "overdue";
    else if (ratio >= 0.9) status = "ready";
    else if (ratio >= 0.55) status = "ripening";
    return { status, ratio, elapsed, left: Math.max(0, cycle - elapsed) };
  }

  const CHORE_LABELS = {
    fresh: "冷却中",
    ripening: "警戒中",
    ready: "可下手",
    overdue: "已失控"
  };

  function habitDoneToday(habit) {
    return Array.isArray(habit.records) && habit.records.includes(dateKey(now()));
  }

  function habitStreak(habit) {
    const set = new Set(habit.records || []);
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!set.has(dateKey(cursor))) cursor = addDays(cursor, -1);
    while (set.has(dateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function longestHabitStreak(habit) {
    const dates = [...new Set(habit.records || [])].sort();
    let best = 0;
    let run = 0;
    let prev = null;
    for (const key of dates) {
      const d = parseLocalDate(key);
      if (prev && Math.round((d - prev) / 86400000) === 1) run += 1;
      else run = 1;
      best = Math.max(best, run);
      prev = d;
    }
    return best;
  }

  function renderHeader() {
    const today = now();
    $("#topDate").textContent = `${formatDateCN(today)} · ${chineseWeekday(today)}`;
    $("#liveClock").textContent = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
    $("#greetingText").textContent = `${timeGreeting()}，${state.profileName || "suslov"}`;
    $("#profileNameLabel").textContent = state.profileName || "suslov";
    const todayEvents = scheduleEventsForDate(today);
    $("#scheduleCount").textContent = todayEvents.length;
    $("#choreCount").textContent = state.chores.filter((chore) => ["ready", "overdue"].includes(choreStatus(chore).status)).length;
    $("#urgentCount").textContent = activeUrgent().length;
    $("#habitCount").textContent = state.habits.filter((habit) => !habitDoneToday(habit)).length;

    const labels = {
      schedule: "HEIST CONTROL",
      chores: "COGNITIVE JOBS",
      urgent: "SHADOW ALERT",
      habits: "TARGET RANGE"
    };
    $("#topKicker").textContent = labels[currentPage];
    const notifyActive = state.settings.notifications && "Notification" in window && Notification.permission === "granted";
    $("#notifyState").classList.toggle("active", Boolean(notifyActive));
    $("#notificationBtn").setAttribute(
      "data-tooltip",
      notifyActive ? "浏览器提醒已开启" : "开启浏览器提醒"
    );
  }

  function renderSchedule() {
    const today = now();
    const selected = selectedDate();
    const weekStart = selectedWeekStart();
    const events = scheduleEventsForDate(selected);
    const info = currentOrNextScheduleInfo();

    const parityLabel = weekParityForDate(weekStart) === "odd" ? "单周" : "双周";
    const weekPrefix = state.weekOffset === 0
      ? "本周"
      : `${weekStart.getMonth() + 1}.${weekStart.getDate()}-${addDays(weekStart, 6).getMonth() + 1}.${addDays(weekStart, 6).getDate()}`;
    $("#weekLabel").textContent = `${weekPrefix} · ${parityLabel}`;

    $("#weekStrip").innerHTML = Array.from({ length: 7 }, (_, i) => {
      const dayIndex = i + 1;
      const date = addDays(weekStart, i);
      const isToday = dateKey(date) === dateKey(today);
      const hasEvents = scheduleEventsForDate(date).length > 0;
      return `
        <button class="day-btn ${state.selectedDay === dayIndex ? "active" : ""} ${isToday ? "today" : ""}" type="button" data-action="select-day" data-day="${dayIndex}" aria-label="${formatDateCN(date)} ${chineseWeekday(date)}">
          <small>${DAY_NAMES[i]}</small>
          <b>${date.getDate()}</b>
          <em style="opacity:${hasEvents ? 1 : 0}"></em>
        </button>`;
    }).join("");

    renderTimeline(events, selected);
    renderTodayRibbon(events, info, selected);
    renderMap(info);
    renderTodayList(events);
    renderDeparture(info);
  }

  function renderTodayRibbon(events, info, selected) {
    const next = info.next || events.find((event) => minutesFromTime(event.start) > now().getHours() * 60 + now().getMinutes());
    const title = info.state === "current" && info.current
      ? `正在进行：${info.current.title}`
      : next
        ? `下一站：${next.title}`
        : `今天共 ${events.length} 项安排`;
    const meta = info.state === "current" && info.current
      ? `${info.current.start} - ${info.current.end} · ${info.current.location || "农场里"}`
      : next
        ? `${next.start} - ${next.end} · ${next.location || "农场里"}`
        : "当前没有进行中的安排";
    const context = dateKey(selected) === dateKey(now()) ? "今日" : `${formatDateCN(selected)} ${chineseWeekday(selected)}`;
    $("#todayRibbon").innerHTML = `
      <span class="ribbon-icon">${icon(info.state === "current" ? "pin" : "sun")}</span>
      <div class="ribbon-copy">
        <small>${escapeHtml(context)} · 行动路线上的下一站</small>
        <b>${escapeHtml(title)}</b>
      </div>
      <div class="ribbon-meta">
        <span>${icon("clock")} ${escapeHtml(meta)}</span>
      </div>
      <span class="ribbon-stamp">${dateKey(selected) === dateKey(now()) ? "今日<br>ROUTE" : `${selected.getMonth() + 1}月<br>${selected.getDate()}日`}</span>`;
  }

  function computeEventLanes(events) {
    const enriched = events.map((event) => ({
      ...event,
      startMin: minutesFromTime(event.start),
      endMin: Math.max(minutesFromTime(event.start) + 20, minutesFromTime(event.end))
    }));
    const clusters = [];
    let cluster = [];
    let clusterEnd = -1;
    for (const event of enriched) {
      if (!cluster.length || event.startMin < clusterEnd) {
        cluster.push(event);
        clusterEnd = Math.max(clusterEnd, event.endMin);
      } else {
        clusters.push(cluster);
        cluster = [event];
        clusterEnd = event.endMin;
      }
    }
    if (cluster.length) clusters.push(cluster);
    clusters.forEach((group) => {
      const laneEnds = [];
      group.forEach((event) => {
        let lane = laneEnds.findIndex((end) => end <= event.startMin);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(event.endMin);
        } else {
          laneEnds[lane] = event.endMin;
        }
        event.lane = lane;
        event.laneCount = laneEnds.length;
      });
      const maxLanes = Math.max(...group.map((event) => event.lane + 1));
      group.forEach((event) => { event.laneCount = maxLanes; });
    });
    return enriched;
  }

  function renderTimeline(events, selected) {
    const duration = TIMETABLE_END - TIMETABLE_START;
    const trackHeight = $("#timeline").clientHeight || 535;
    const hourMarks = [];
    for (let minute = 8 * 60; minute <= TIMETABLE_END; minute += 60) {
      const top = ((minute - TIMETABLE_START) / duration) * trackHeight;
      hourMarks.push(`<div class="timeline-hour" style="top:${top}px"><span>${String(minute / 60).padStart(2, "0")}:00</span></div>`);
    }
    const lanes = computeEventLanes(events);
    const blocks = lanes.map((event) => {
      const top = Math.max(0, ((event.startMin - TIMETABLE_START) / duration) * trackHeight);
      const rawHeight = ((event.endMin - event.startMin) / duration) * trackHeight;
      const height = Math.max(event.type === "deadline-event" ? 28 : 42, rawHeight - 3);
      const available = "calc(100% - 84px)";
      const left = `calc(72px + ${available} * ${event.lane} / ${event.laneCount})`;
      const right = `calc(12px + ${available} * ${event.laneCount - event.lane - 1} / ${event.laneCount})`;
      const detailId = `time-detail-${event.source}-${event.id}`;
      const parity = event.parity && event.parity !== "all"
        ? `<span>${event.parity === "odd" ? "单周" : "双周"}</span>`
        : "";
      return `
        <div class="time-block ${escapeHtml(event.type || "lecture")}"
          style="top:${top}px;height:${height}px;left:${left};right:${right}"
          data-event-id="${escapeHtml(event.id)}">
          <button class="time-block-main" type="button"
            data-action="toggle-time-details" data-id="${escapeHtml(event.id)}"
            aria-expanded="false" aria-controls="${escapeHtml(detailId)}"
            aria-label="${escapeHtml(`${event.title}，点击查看时间和地点`)}">
            <span class="time-block-title">${escapeHtml(event.title)}</span>
          </button>
          <div class="time-block-meta" id="${escapeHtml(detailId)}">
            <span>${event.start}–${event.end}</span>
            ${event.location ? `<span>${icon("pin")}${escapeHtml(event.location)}</span>` : ""}
            ${parity}
            <button class="time-block-edit" type="button"
              data-action="${event.source === "urgent" ? "edit-urgent" : "edit-event"}"
              data-id="${escapeHtml(event.id)}">编辑</button>
          </div>
        </div>`;
    }).join("");

    const isToday = dateKey(selected) === dateKey(now());
    const nowMinute = now().getHours() * 60 + now().getMinutes();
    const showNow = isToday && nowMinute >= TIMETABLE_START && nowMinute <= TIMETABLE_END;
    const nowTop = ((nowMinute - TIMETABLE_START) / duration) * trackHeight;
    const empty = events.length ? "" : `
      <div class="empty-day">
        <b>今天是一片空地</b>
        <span>当前没有安排，可以点击“添加日程”。</span>
      </div>`;

    $("#timeline").innerHTML = `
      ${hourMarks.join("")}
      ${showNow ? `<div class="timeline-now" style="top:${nowTop}px"></div>` : ""}
      ${blocks}
      ${empty}`;
  }

  function renderMap(info) {
    const selected = selectedDate();
    const dateEvents = scheduleEventsForDate(selected).filter((event) => event.location && event.source !== "urgent");
    const scheduledPlaces = [...state.events]
      .sort((a, b) => getEventDay(a) - getEventDay(b) || minutesFromTime(a.start) - minutesFromTime(b.start))
      .map((event) => mapLocationName(event.location))
      .filter(Boolean);
    const locationNames = new Set([
      ...dateEvents.map((event) => mapLocationName(event.location)),
      ...scheduledPlaces,
      info.location?.name,
      "宿舍"
    ].filter(Boolean));
    const nextMapName = mapLocationName(info.next?.location);
    const locationList = [...locationNames].slice(0, 10);
    locationList.forEach((name) => ensureLocation(name));
    const pins = locationList.map((name) => findLocation(name));
    const placementFor = (loc, index) => {
      if (loc.name === "宿舍") return "label-below";
      if (loc.x < 30) return "label-right";
      if (loc.x > 67) return "label-left";
      if (loc.name === "六号楼") return "label-left";
      if (loc.name === "五号楼") return "label-right";
      if (loc.name === "HGX楼") return "label-above";
      if (loc.name === "相辉堂") return "label-left";
      if (loc.name === "二号楼") return "label-left";
      if (loc.y > 72) return "label-above";
      return index % 2 ? "label-below" : "label-left";
    };
    $("#mapLocations").innerHTML = pins.map((loc, index) => {
      const isCurrent = loc.name === info.location.name;
      const isNext = loc.name === nextMapName;
      const isHub = loc.name === "宿舍";
      return `
        <div class="location-pin ${isCurrent ? "current" : ""} ${isNext ? "is-next" : ""} ${isHub ? "is-hub" : ""} ${placementFor(loc, index)}" style="left:${loc.x}%;top:${loc.y}%;--pin-color:${loc.color}">
          <span class="pin-dot"><span>${escapeHtml(loc.icon || "📍")}</span></span>
          <span class="pin-copy"><b>${escapeHtml(loc.name)}</b>${isCurrent ? "<small>你在这里</small>" : ""}</span>
        </div>`;
    }).join("");

    const routeColors = ["#ffe45b", "#55ded4", "#ff4a8c", "#b7e53c", "#f19436", "#f8f2e7"];
    const routePoints = [...new Set([
      ...scheduledPlaces,
      ...locationList,
      info.location.name
    ])].filter((name) => name && name !== "在线" && name !== "宿舍");
    const activeFrom = info.location.name;
    const activeTo = nextMapName;
    const routePairs = routePoints.slice(0, 10).map((name) => ["宿舍", name]);
    const courtToSix = ["南区篮球场", "六号楼"];
    if (!routePairs.some(([from, to]) => (
      (from === courtToSix[0] && to === courtToSix[1])
      || (from === courtToSix[1] && to === courtToSix[0])
    ))) {
      routePairs.push(courtToSix);
    }
    const lines = [];
    routePairs.forEach(([name, nextName], index) => {
      const loc = findLocation(name);
      const next = findLocation(nextName);
      if (!loc || !next) return;
      const x1 = loc.x * 7;
      const y1 = loc.y * 4.3;
      const x2 = next.x * 7;
      const y2 = next.y * 4.3;
      const active = name === "宿舍" && (nextName === activeFrom || nextName === activeTo);
      const color = routeColors[index % routeColors.length];
      lines.push(`
        <line class="route-outline ${active ? "active" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>
        <line class="route-color ${active ? "active" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:${color}"></line>
        <circle class="route-stop" cx="${x2}" cy="${y2}" r="8"></circle>
      `);
    });
    $("#mapRouteLines").innerHTML = lines.join("");

    const avatar = $("#mapAvatar");
    avatar.style.left = `${info.location.x}%`;
    avatar.style.top = `${info.location.y + 4}%`;
    const bubbleText = info.state === "current"
      ? `正在 ${info.location.name}`
      : info.state === "future" || info.state === "between"
        ? `应在 ${info.location.name}`
        : `回到 ${info.location.name}`;
    $("#avatarBubble").textContent = bubbleText;

    let status;
    if (info.state === "current" && info.current) {
      status = `<i></i><span>现在应该在 <b>${escapeHtml(info.current.location || info.location.name)}</b>，${escapeHtml(info.current.title)}进行中</span>`;
    } else if (info.next) {
      status = `<i></i><span>下一站是 <b>${escapeHtml(mapLocationName(info.next.location) || "农场里")}</b>，${escapeHtml(info.next.start)} 开始 ${escapeHtml(info.next.title)}</span>`;
    } else {
      status = `<i></i><span>当前没有必须前往的地点，当前位置：<b>${escapeHtml(info.location.name)}</b></span>`;
    }
    $("#mapStatus").innerHTML = status;

    if (info.next) {
      const from = info.location.name;
      const to = mapLocationName(info.next.location) || "宿舍";
      const commute = transportMinutes(from, to);
      const departure = addMinutesToTime(info.next.start, -commute);
      $("#nextTrip").innerHTML = `
        <span class="trip-icon">${icon("route")}</span>
        <div><b>${escapeHtml(from)} → ${escapeHtml(to)}</b><small>步行约 ${commute} 分钟 · 建议 ${departure} 前出发</small></div>
        <span class="trip-time">${commute}′</span>`;
    } else {
      $("#nextTrip").innerHTML = `
        <span class="trip-icon">${icon("sun")}</span>
        <div><b>今日路线已经走完</b><small>收起今天的行动记录，等待下一次潜入</small></div>
        <span class="trip-time">收工</span>`;
    }
  }

  function renderTodayList(events) {
    if (!events.length) {
      $("#todayList").innerHTML = `<div class="empty-state"><span class="empty-state-emoji">○</span><b>今天没有安排</b><p>当前没有课程或任务。</p></div>`;
      return;
    }
    $("#todayList").innerHTML = events.slice(0, 5).map((event) => {
      const color = event.type === "urgent-event" || event.type === "deadline-event" ? "#ca6550" : event.type === "personal" ? "#d89a61" : "#7b9e63";
      return `
        <div class="today-row" style="--row-color:${color}">
          <i></i>
          <div><b>${escapeHtml(event.title)}</b><small>${escapeHtml(event.location || "农场里")}</small></div>
          <time>${event.start}</time>
        </div>`;
    }).join("");
  }

  function renderDeparture(info) {
    if (!info.next) {
      $("#departureCard").innerHTML = `<b>暂无下一项安排</b><p>今天的日程已经结束，或当前没有可计算的出发时间。</p>`;
      return;
    }
    const from = info.location.name;
    const to = mapLocationName(info.next.location) || "宿舍";
    const commute = transportMinutes(from, to);
    const departure = addMinutesToTime(info.next.start, -commute);
    $("#departureCard").innerHTML = `
      <b>${escapeHtml(info.next.title)} · ${info.next.start}</b>
      <p>从 ${escapeHtml(from)} 到 ${escapeHtml(to)} 约 ${commute} 分钟。<br>建议在 <span class="time">${departure}</span> 前出发，预留通勤时间。</p>`;
  }

  function renderChores() {
    const statuses = state.chores.map((chore) => ({ chore, ...choreStatus(chore) }));
    const ready = statuses.filter((s) => ["ready", "overdue"].includes(s.status)).length;
    $("#readyChores").textContent = ready;
    $("#orchardDate").textContent = DAY_NAMES[isoDay(now()) - 1];

    const positions = [
      { x: 43, y: 31 }, { x: 56, y: 36 }, { x: 65, y: 28 }, { x: 35, y: 41 },
      { x: 51, y: 45 }, { x: 70, y: 45 }, { x: 40, y: 27 }, { x: 61, y: 48 }
    ];
    const fallen = [{ x: 24 }, { x: 34 }, { x: 66 }, { x: 75 }];
    let fallenIndex = 0;
    $("#treeFruits").innerHTML = statuses.slice(0, 8).map((item, i) => {
      const pos = positions[i % positions.length];
      const isFallen = item.status === "overdue";
      const fallPos = fallen[fallenIndex++ % fallen.length];
      return `
        <button class="tree-fruit-item ${item.status}" type="button"
          style="left:${isFallen ? fallPos.x : pos.x}%;top:${isFallen ? 87 : pos.y}%;${isFallen ? `--fallen-x:${fallPos.x}%` : ""}"
          data-action="edit-chore" data-id="${escapeHtml(item.chore.id)}"
          aria-label="${escapeHtml(`${item.chore.name}，${CHORE_LABELS[item.status]}`)}">
          <span class="fruit-shape"></span>
          <span class="fruit-label">${escapeHtml(item.chore.name)}</span>
        </button>`;
    }).join("");

    $("#choreList").innerHTML = statuses.length
      ? statuses.map((item) => `
        <div class="chore-item">
          <span class="chore-fruit" style="--status-color:${choreStatusColor(item.status)}">${escapeHtml(item.chore.icon || "🍎")}</span>
          <div class="chore-main">
            <b>${escapeHtml(item.chore.name)}</b>
            <small>周期 ${Number(item.chore.cycleDays)} 天 · ${item.status === "overdue" ? `已超时 ${Math.max(1, Math.ceil(item.elapsed - Number(item.chore.cycleDays)))} 天` : `约 ${Math.max(1, Math.ceil(item.left))} 天后成熟`}</small>
          </div>
          <div>
            <span class="chore-state ${item.status}">${CHORE_LABELS[item.status]}</span>
            <button class="chore-pick" type="button" data-action="pick-chore" data-id="${escapeHtml(item.chore.id)}" aria-label="完成 ${escapeHtml(item.chore.name)}" data-tooltip="完成并重新开始生长">${icon("check")}</button>
          </div>
        </div>`).join("")
      : `<div class="empty-state"><span class="empty-state-emoji">◎</span><b>认知区暂时没有目标</b><p>添加第一件日常事务，并设置它的冷却周期。</p></div>`;

    const overdueCount = statuses.filter((s) => s.status === "overdue").length;
    const readyCount = statuses.filter((s) => s.status === "ready").length;
    $("#choreAdvice").textContent = overdueCount
      ? `有 ${overdueCount} 个目标已经失控。完成它就能重新压回警戒线以下。`
      : readyCount
        ? `有 ${readyCount} 个目标已经进入可下手阶段，优先清理它们。`
        : "认知区域正在保持安静，目标会在接近冷却终点时发出警报。";

    const englishStatus = {
      fresh: "COOLDOWN",
      ripening: "ALERT",
      ready: "TAKE DOWN",
      overdue: "DANGER"
    };
    $("#p5HeistBoard").innerHTML = `
      <div class="p5-heist-heading">
        <span><i></i> COGNITIVE JOB LIST</span>
        <b>${ready} TARGET${ready === 1 ? "" : "S"} READY</b>
      </div>
      <div class="p5-heist-grid">
        ${statuses.length ? statuses.slice(0, 8).map((item, index) => `
          <button class="p5-heist-card ${item.status}" type="button" data-action="edit-chore" data-id="${escapeHtml(item.chore.id)}">
            <span class="heist-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="heist-icon">${escapeHtml(item.chore.icon || "★")}</span>
            <span class="heist-copy">
              <small>${englishStatus[item.status] || "JOB"}</small>
              <b>${escapeHtml(item.chore.name)}</b>
              <em>${item.status === "overdue" ? `失控 ${Math.max(1, Math.ceil(item.elapsed - Number(item.chore.cycleDays)))} 天` : `约 ${Math.max(1, Math.ceil(item.left))} 天后到期`}</em>
            </span>
            <span class="heist-progress"><i style="width:${Math.min(100, Math.round(item.ratio * 100))}%"></i></span>
            <span class="heist-stamp">${englishStatus[item.status] || "JOB"}</span>
          </button>`).join("") : `
          <div class="p5-empty-job">
            <span>NO TARGETS</span>
            <b>这片认知区域暂时很安静</b>
            <small>添加第一件日常事务，生成潜入目标。</small>
          </div>`}
      </div>
      <div class="p5-heist-footer">
        <span>点击目标卡片可修改周期</span>
      </div>`;

    if (!fallAnimationShown && overdueCount) {
      fallAnimationShown = true;
      setTimeout(() => {
        const falling = $("#fallingFruit");
        falling.classList.remove("animate");
        void falling.offsetWidth;
        falling.style.left = `${fallen[Math.floor(Math.random() * fallen.length)].x}%`;
        falling.classList.add("animate");
        setTimeout(() => falling.classList.remove("animate"), 1400);
      }, 550);
    }
  }

  function choreStatusColor(status) {
    return {
      fresh: "#9fbd66",
      ripening: "#e3c25b",
      ready: "#d86445",
      overdue: "#a76748"
    }[status] || "#789b62";
  }

  function renderUrgent() {
    const items = activeUrgent().sort((a, b) => urgentDeadlineDate(a) - urgentDeadlineDate(b));
    const overdueCount = items.filter((item) => urgentDeadlineDate(item) < now()).length;
    const todayCount = items.filter((item) => item.date === dateKey(now())).length;
    const occupiedMinutes = items.filter((item) => item.category === "time" && item.start && item.end).reduce((sum, item) => sum + Math.max(0, minutesFromTime(item.end) - minutesFromTime(item.start)), 0);

    $("#weedSummary").innerHTML = `
      <div class="weed-stat">
        <span class="weed-stat-icon">${icon("sprout")}</span>
        <div><b>${items.length}</b><span>只阴影仍在游荡</span></div>
      </div>
      <div class="weed-stat">
        <span class="weed-stat-icon">${icon("bell")}</span>
        <div><b>${todayCount}</b><span>只今天进入警戒</span></div>
      </div>
      <div class="weed-stat">
        <span class="weed-stat-icon">${icon("clock")}</span>
        <div><b>${Math.round(occupiedMinutes / 60 * 10) / 10}<small>h</small></b><span>认知空间被占据</span></div>
      </div>`;

    $("#overdueWeeds").textContent = `${overdueCount} 项过期`;

    const placements = [
      { x: 18, bottom: 27, scale: 0.85 }, { x: 35, bottom: 55, scale: 1.1 },
      { x: 51, bottom: 26, scale: 0.95 }, { x: 67, bottom: 48, scale: 1.06 },
      { x: 82, bottom: 22, scale: 0.8 }, { x: 27, bottom: 77, scale: 0.72 }
    ];
    $("#weeds").innerHTML = items.slice(0, 6).map((item, i) => {
      const placement = placements[i % placements.length];
      const due = urgentDeadlineDate(item);
      return `
        <button class="weed-item p5-monster ${escapeHtml(item.priority)}" type="button"
          style="--weed-x:${placement.x}%;--weed-bottom:${placement.bottom}px;--weed-scale:${placement.scale};--weed-color:${weedColor(item.priority, 0)};--weed-color-2:${weedColor(item.priority, 1)}"
          data-action="edit-urgent" data-id="${escapeHtml(item.id)}"
          aria-label="${escapeHtml(item.title)}，${escapeHtml(countdownText(due))}">
          <span class="monster-shadow"></span>
          <span class="monster-figure">
            <span class="monster-horn horn-l"></span><span class="monster-horn horn-r"></span>
            <span class="monster-eye eye-l"></span><span class="monster-eye eye-r"></span>
            <span class="monster-mouth"></span>
            <span class="monster-claw claw-l"></span><span class="monster-claw claw-r"></span>
          </span>
          <span class="monster-tag">${item.priority === "high" ? "DANGER" : item.priority === "medium" ? "ALERT" : "SHADOW"}</span>
          <span class="weed-tip">
            <b>${escapeHtml(item.title)}</b>
            <small>${escapeHtml(item.category === "time" ? `${item.start}–${item.end}` : `${item.date} ${item.dueTime} 截止`)}</small>
          </span>
        </button>`;
    }).join("") + (items.length > 6 ? `<div class="weed-more">还有 ${items.length - 6} 项，见右侧清单</div>` : "");

    const noWeed = !items.length
      ? `<div class="empty-state" style="position:absolute;inset:0;place-content:center;pointer-events:none"><span class="empty-state-emoji">✦</span><b>认知区域一片安静</b><p>暂时没有阴影怪物在游荡。</p></div>`
      : "";
    $("#weeds").insertAdjacentHTML("beforeend", noWeed);

    $("#weedList").innerHTML = items.length
      ? items.map((item) => {
        const due = urgentDeadlineDate(item);
        const overdue = due < now();
        return `
          <div class="weed-task ${escapeHtml(item.priority)}">
            <div class="weed-task-head"><b>${escapeHtml(item.title)}</b><span>${overdue ? "已过期" : priorityLabel(item.priority)}</span></div>
            <div class="weed-task-meta">
              <span>${icon("calendar")} ${escapeHtml(relativeDateText(parseLocalDate(item.date)))}</span>
              <span>${icon("clock")} ${escapeHtml(item.category === "time" ? `${item.start}–${item.end}` : `${item.dueTime} 截止`)}</span>
              ${item.location ? `<span>${icon("pin")} ${escapeHtml(item.location)}</span>` : ""}
            </div>
            <div class="weed-actions">
              <span class="countdown ${overdue ? "overdue" : ""}">${escapeHtml(countdownText(due))}</span>
              <button class="small-action" type="button" data-action="complete-urgent" data-id="${escapeHtml(item.id)}">${icon("broom")} 割掉</button>
            </div>
          </div>`;
      }).join("")
      : `<div class="empty-state"><span class="empty-state-emoji">✦</span><b>没有待处理的阴影</b><p>突然出现的事情，也可以随时化为警报。</p></div>`;
  }

  function weedColor(priority, variant) {
    const colors = {
      high: variant ? "#7d9d55" : "#537b41",
      medium: variant ? "#82a15d" : "#5c8244",
      low: variant ? "#98b16e" : "#6b8e51"
    };
    return colors[priority] || colors.medium;
  }

  function priorityLabel(priority) {
    return { high: "很着急", medium: "有点急", low: "不急" }[priority] || "普通";
  }

  function renderHabits() {
    const doneToday = state.habits.filter(habitDoneToday).length;
    const totalCheckins = state.habits.reduce((sum, habit) => sum + (habit.records?.length || 0), 0);
    const bestStreak = state.habits.reduce((best, habit) => Math.max(best, habitStreak(habit)), 0);
    $("#habitStats").innerHTML = `
      <div class="habit-stat">
        <span class="habit-stat-icon">${icon("pin")}</span>
        <div><b>${state.habits.length}</b><span>个每日目标已布置</span></div>
      </div>
      <div class="habit-stat">
        <span class="habit-stat-icon">${icon("check")}</span>
        <div><b>${doneToday}/${state.habits.length}</b><span>今日已经命中的靶心</span></div>
      </div>
      <div class="habit-stat">
        <span class="habit-stat-icon">${icon("sun")}</span>
        <div><b>${bestStreak}</b><span>最长连续命中天数</span></div>
      </div>`;

    $("#habitGrid").innerHTML = state.habits.length
      ? state.habits.map((habit) => {
        const done = habitDoneToday(habit);
        const streak = habitStreak(habit);
        const history = Array.from({ length: 7 }, (_, i) => {
          const date = addDays(now(), i - 6);
          return {
            key: dateKey(date),
            label: ["日", "一", "二", "三", "四", "五", "六"][date.getDay()],
            done: habit.records?.includes(dateKey(date))
          };
        });
        const today = now();
        const datePlate = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;
        return `
          <article class="habit-card ${done ? "hit" : ""}" style="--habit-color:${escapeHtml(habit.color || "#6f9b5c")}" data-habit-id="${escapeHtml(habit.id)}">
            <div class="habit-visual">
              <span class="p5-target" aria-hidden="true">
                <i class="target-ring ring-outer"></i>
                <i class="target-ring ring-middle"></i>
                <i class="target-ring ring-inner"></i>
                <b>${escapeHtml(habit.icon || "★")}</b>
              </span>
              <span class="p5-knife" aria-hidden="true"><i></i></span>
              <div class="p5-date-burst" aria-hidden="true">
                <small>DAY CLEARED</small>
                <strong>${datePlate}</strong>
              </div>
              <span class="habit-stem"></span>
              <span class="habit-leaf l1"></span><span class="habit-leaf l2"></span>
              <span class="habit-flower"></span>
              <span class="water-drop"></span>
              <span class="habit-pot"></span>
            </div>
            <div class="habit-content">
              <div class="habit-topline">
                <h3>${escapeHtml(habit.icon || "🌱")} ${escapeHtml(habit.name)}</h3>
                <span class="habit-time">${icon("bell")}${escapeHtml(habit.reminder || "20:00")}</span>
              </div>
              <p class="habit-sub">累计完成 ${habit.records?.length || 0} 天 · 最长连续 ${longestHabitStreak(habit)} 天</p>
              <div class="habit-history" aria-label="最近七天打卡记录">
                ${history.map((day) => `<span class="history-day"><i class="history-leaf ${day.done ? "done" : ""}"></i><span>${day.label}</span></span>`).join("")}
              </div>
              <div class="habit-bottomline">
                <span class="habit-streak"><b>${streak}</b> 天连续</span>
                <button class="habit-check ${done ? "done" : ""}" type="button" data-action="check-habit" data-id="${escapeHtml(habit.id)}" ${done ? "disabled" : ""}>
                  ${icon(done ? "check" : "water")} ${done ? "今日已命中" : "掷出飞刀"}
                </button>
              </div>
            </div>
            <div class="habit-card-actions">
              <button class="micro-btn" type="button" data-action="edit-habit" data-id="${escapeHtml(habit.id)}" aria-label="编辑 ${escapeHtml(habit.name)}">${icon("edit")}</button>
              <button class="micro-btn" type="button" data-action="delete-habit" data-id="${escapeHtml(habit.id)}" aria-label="删除 ${escapeHtml(habit.name)}">${icon("trash")}</button>
            </div>
          </article>`;
      }).join("")
      : `<div class="empty-state panel"><span class="empty-state-emoji">◎</span><b>靶场里还没有目标</b><p>阅读、背单词或早睡，挑一件想每天命中的小事。</p></div>`;

    renderMonthGrid();
    $("#reminderStatusText").textContent = notificationActive() ? "浏览器提醒已开启" : "页面内提醒已开启";
  }

  function renderMonthGrid() {
    const days = [];
    for (let i = 27; i >= 0; i -= 1) {
      const date = addDays(now(), -i);
      const key = dateKey(date);
      const count = state.habits.filter((habit) => habit.records?.includes(key)).length;
      let level = 0;
      if (count > 0) level = 1;
      if (count >= 2) level = 2;
      if (count >= Math.max(3, state.habits.length * 0.6)) level = 3;
      if (state.habits.length && count === state.habits.length) level = 4;
      days.push(`<span class="month-cell lvl${level} ${key === dateKey(now()) ? "today" : ""}" data-tooltip="${formatDateCN(date)} · 完成 ${count} 项"></span>`);
    }
    $("#monthGrid").innerHTML = days.join("");
  }

  function renderAll() {
    renderHeader();
    renderWeather();
    renderSchedule();
    renderChores();
    renderUrgent();
    renderHabits();
  }

  function switchPage(page) {
    if (!["schedule", "chores", "urgent", "habits"].includes(page)) page = "schedule";
    currentPage = page;
    if (window.location.hash !== `#${page}`) {
      history.replaceState(null, "", `#${page}`);
    }
    $$(".page").forEach((panel) => panel.classList.toggle("active", panel.dataset.pagePanel === page));
    $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
    $("#sidebar").classList.remove("mobile-open");
    renderHeader();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (page === "schedule") renderSchedule();
    if (page === "chores") renderChores();
    if (page === "urgent") renderUrgent();
    if (page === "habits") renderHabits();
  }

  function openModal({ title, kicker = "PLAN NOTE", html, wide = false, onSubmit = null }) {
    $("#modalTitle").textContent = title;
    $("#modalKicker").textContent = kicker;
    $("#modalBody").innerHTML = html;
    $("#modal").classList.remove("map-zoom-modal");
    $("#modal").classList.toggle("wide", wide);
    $("#modalBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
    modalSubmitHandler = onSubmit;
    setTimeout(() => {
      const focusable = $("#modalBody input, #modalBody select, #modalBody textarea, #modalBody button");
      focusable?.focus();
    }, 40);
  }

  function closeModal() {
    $("#modalBackdrop").hidden = true;
    $("#modal").classList.remove("map-zoom-modal");
    $("#modalBody").innerHTML = "";
    document.body.style.overflow = "";
    modalSubmitHandler = null;
  }

  function openMapZoom() {
    const source = $("#farmMap");
    if (!source) return;
    const clone = source.cloneNode(true);
    clone.removeAttribute("id");
    clone.className = "farm-map p5-map map-zoom-scene";
    clone.setAttribute("aria-label", "放大的校园路线图");
    $$("[id]", clone).forEach((element) => element.removeAttribute("id"));
    $(".map-zoom-trigger", clone)?.remove();
    openModal({
      title: "校园路线图",
      kicker: "认知校园",
      wide: true,
      html: `
        <div class="map-zoom-shell">
          ${clone.outerHTML}
          <p class="map-zoom-note">直线颜色表示不同地点之间的行动路线，红色标记为当前或下一站。</p>
        </div>`
    });
    $("#modal").classList.add("map-zoom-modal");
  }

  function eventForm(event = null) {
    ensureAllEventLocations();
    const selectedDay = event ? getEventDay(event) : state.selectedDay;
    return `
      <form data-form="event" data-id="${event ? escapeHtml(event.id) : ""}">
        <div class="form-grid">
          <div class="form-field full">
            <label for="eventTitle">日程名称</label>
            <input class="input" id="eventTitle" name="title" required maxlength="40" value="${escapeHtml(event?.title || "")}" placeholder="例如：设计史、午餐、项目讨论">
          </div>
          <div class="form-field">
            <label for="eventDay">星期</label>
            <select class="select" id="eventDay" name="day" required>
              ${DAY_FULL.map((name, i) => `<option value="${i + 1}" ${selectedDay === i + 1 ? "selected" : ""}>${name}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label for="eventType">日程类型</label>
            <select class="select" id="eventType" name="type">
              <option value="lecture" ${event?.type === "lecture" ? "selected" : ""}>课程</option>
              <option value="personal" ${event?.type === "personal" ? "selected" : ""}>个人安排</option>
            </select>
          </div>
          <div class="form-field">
            <label for="eventParity">上课周次</label>
            <select class="select" id="eventParity" name="parity">
              <option value="all" ${!event?.parity || event?.parity === "all" ? "selected" : ""}>每周</option>
              <option value="odd" ${event?.parity === "odd" ? "selected" : ""}>仅单周</option>
              <option value="even" ${event?.parity === "even" ? "selected" : ""}>仅双周</option>
            </select>
          </div>
          <div class="form-field">
            <label for="eventStart">开始时间</label>
            <input class="input" id="eventStart" name="start" type="time" required value="${escapeHtml(event?.start || "08:00")}">
          </div>
          <div class="form-field">
            <label for="eventEnd">结束时间</label>
            <input class="input" id="eventEnd" name="end" type="time" required value="${escapeHtml(event?.end || "09:30")}">
          </div>
          <div class="form-field full">
            <label for="eventLocation">地点 <small>输入新地点会自动加入地图</small></label>
            <input class="input" id="eventLocation" name="location" list="locationOptions" value="${escapeHtml(event?.location || "")}" placeholder="例如：教学楼、图书馆">
            <datalist id="locationOptions">
              ${state.locations.map((loc) => `<option value="${escapeHtml(loc.name)}"></option>`).join("")}
            </datalist>
          </div>
          <div class="form-field">
            <label for="eventFrom">开始生效日期 <small>选填</small></label>
            <input class="input" id="eventFrom" name="validFrom" type="date" value="${escapeHtml(event?.validFrom || "")}">
          </div>
          <div class="form-field">
            <label for="eventTo">结束生效日期 <small>选填</small></label>
            <input class="input" id="eventTo" name="validTo" type="date" value="${escapeHtml(event?.validTo || "")}">
          </div>
          <div class="form-field full">
            <label for="eventNote">备注 <small>选填</small></label>
            <input class="input" id="eventNote" name="note" maxlength="100" value="${escapeHtml(event?.note || "")}" placeholder="教室、要带的东西或一句提醒">
          </div>
        </div>
        <div class="form-actions">
          ${event ? `<button class="danger-link" type="button" data-action="delete-event" data-id="${escapeHtml(event.id)}">删除这项日程</button>` : ""}
          <button class="btn secondary" type="button" data-action="close-modal">取消</button>
          <button class="btn primary" type="submit">${event ? "保存修改" : "放到日程里"}</button>
        </div>
      </form>`;
  }

  function openEventModal(event = null) {
    openModal({
      title: event ? "编辑日程" : "添加一项日程",
      kicker: "SCHEDULE SEED",
      html: eventForm(event),
      onSubmit: handleEventSubmit
    });
  }

  function handleEventSubmit(form) {
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const start = String(data.get("start") || "");
    const end = String(data.get("end") || "");
    if (!title) return;
    if (minutesFromTime(end) <= minutesFromTime(start)) {
      showToast("结束时间需要晚一些", "请让结束时间晚于开始时间。", "clock");
      return;
    }
    const location = String(data.get("location") || "").trim();
    ensureLocation(location);
    const payload = {
      id: form.dataset.id || uid("evt"),
      day: Number(data.get("day")),
      start,
      end,
      title,
      location,
      type: String(data.get("type") || "lecture"),
      parity: String(data.get("parity") || "all"),
      validFrom: String(data.get("validFrom") || ""),
      validTo: String(data.get("validTo") || ""),
      note: String(data.get("note") || "").trim()
    };
    if (payload.validFrom && payload.validTo && payload.validTo < payload.validFrom) {
      showToast("生效日期需要调整", "结束日期不能早于开始日期。", "calendar");
      return;
    }
    const index = state.events.findIndex((event) => event.id === payload.id);
    if (index >= 0) state.events[index] = payload;
    else state.events.push(payload);
    saveState();
    closeModal();
    renderAll();
    showToast(index >= 0 ? "日程已更新" : "日程已种下", `${title} · ${DAY_FULL[payload.day - 1]} ${start}`, "calendar");
  }

  function ensureAllEventLocations() {
    state.events.forEach((event) => ensureLocation(event.location));
    state.urgent.forEach((item) => ensureLocation(item.location));
  }

  function openChoreModal(chore = null) {
    const lastDoneValue = chore
      ? dateKey(new Date(chore.lastDone))
      : dateKey(now());
    openModal({
      title: chore ? "调整这个认知目标" : "新增认知目标",
      kicker: "FRUIT ORCHARD",
      html: `
        <form data-form="chore" data-id="${chore ? escapeHtml(chore.id) : ""}">
          <div class="form-grid">
            <div class="form-field full">
              <label for="choreName">事务名称</label>
              <input class="input" id="choreName" name="name" required maxlength="30" value="${escapeHtml(chore?.name || "")}" placeholder="例如：洗衣服、浇花、整理桌面">
            </div>
            <div class="form-field">
              <label for="choreIcon">目标图标 <small>一个 emoji</small></label>
              <input class="input" id="choreIcon" name="icon" maxlength="4" value="${escapeHtml(chore?.icon || "🍎")}" placeholder="🍎">
            </div>
            <div class="form-field">
              <label for="choreCycle">大概多久做一次</label>
              <select class="select" id="choreCycle" name="cycleDays">
                ${[0.5, 1, 2, 3, 5, 7, 14, 30].map((days) => `<option value="${days}" ${Number(chore?.cycleDays) === days ? "selected" : ""}>${days === 0.5 ? "半天" : days === 1 ? "每天" : `${days} 天`}</option>`).join("")}
              </select>
            </div>
            <div class="form-field full">
              <label for="choreLast">最近一次完成日期</label>
              <input class="input" id="choreLast" name="lastDone" type="date" required value="${lastDoneValue}">
              <span class="form-help">目标会根据“上次完成时间 + 设定周期”进入冷却、警戒和失控阶段。</span>
            </div>
          </div>
          <div class="form-actions">
            ${chore ? `<button class="danger-link" type="button" data-action="delete-chore" data-id="${escapeHtml(chore.id)}">移除这项事务</button>` : ""}
            <button class="btn secondary" type="button" data-action="close-modal">取消</button>
            <button class="btn primary" type="submit">${chore ? "保存照料方式" : "把它种下"}</button>
          </div>
        </form>`,
      onSubmit: handleChoreSubmit
    });
  }

  function handleChoreSubmit(form) {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const lastDoneDate = String(data.get("lastDone") || dateKey(now()));
    const payload = {
      id: form.dataset.id || uid("chore"),
      name,
      icon: String(data.get("icon") || "🍎").trim().slice(0, 4) || "🍎",
      cycleDays: Number(data.get("cycleDays")),
      lastDone: parseLocalDate(lastDoneDate, "12:00").toISOString(),
      createdAt: form.dataset.id
        ? state.chores.find((item) => item.id === form.dataset.id)?.createdAt || new Date().toISOString()
        : new Date().toISOString()
    };
    const index = state.chores.findIndex((chore) => chore.id === payload.id);
    if (index >= 0) state.chores[index] = payload;
    else state.chores.push(payload);
    saveState();
    closeModal();
    renderAll();
    showToast(index >= 0 ? "目标参数已更新" : "新目标已锁定", `${name} · 约 ${payload.cycleDays} 天一个周期`, "tree");
  }

  function openUrgentModal(item = null) {
    const selectedKey = item?.date || dateKey(now());
    openModal({
      title: item ? "处理这只阴影" : "生成突发阴影",
      kicker: "SUDDEN WEEDS",
      html: `
        <form data-form="urgent" data-id="${item ? escapeHtml(item.id) : ""}">
          <div class="form-grid">
            <div class="form-field full">
              <label for="urgentTitle">突然出现的事项</label>
              <input class="input" id="urgentTitle" name="title" required maxlength="50" value="${escapeHtml(item?.title || "")}" placeholder="例如：交材料、临时会议、取快递">
            </div>
            <div class="form-field full">
              <label>记录方式</label>
              <div class="type-switch">
                <label><input type="radio" name="category" value="deadline" ${item?.category !== "time" ? "checked" : ""}><span>只有截止时间</span></label>
                <label><input type="radio" name="category" value="time" ${item?.category === "time" ? "checked" : ""}><span>占用一段时间</span></label>
              </div>
            </div>
            <div class="form-field">
              <label for="urgentDate">发生日期</label>
              <input class="input" id="urgentDate" name="date" type="date" required value="${selectedKey}">
            </div>
            <div class="form-field">
              <label for="urgentDue">截止时间</label>
              <input class="input" id="urgentDue" name="dueTime" type="time" required value="${escapeHtml(item?.dueTime || "18:00")}">
            </div>
            <div class="form-field" data-time-field>
              <label for="urgentStart">占用开始</label>
              <input class="input" id="urgentStart" name="start" type="time" value="${escapeHtml(item?.start || "14:00")}">
            </div>
            <div class="form-field" data-time-field>
              <label for="urgentEnd">占用结束</label>
              <input class="input" id="urgentEnd" name="end" type="time" value="${escapeHtml(item?.end || "15:00")}">
            </div>
            <div class="form-field">
              <label for="urgentLocation">地点 <small>选填</small></label>
              <input class="input" id="urgentLocation" name="location" list="locationOptionsUrgent" value="${escapeHtml(item?.location || "")}" placeholder="会在小地图上出现">
              <datalist id="locationOptionsUrgent">
                ${state.locations.map((loc) => `<option value="${escapeHtml(loc.name)}"></option>`).join("")}
              </datalist>
            </div>
            <div class="form-field">
              <label for="urgentPriority">紧急程度</label>
              <select class="select" id="urgentPriority" name="priority">
                <option value="high" ${item?.priority === "high" ? "selected" : ""}>高危 · 尖角阴影</option>
                <option value="medium" ${item?.priority === "medium" || !item ? "selected" : ""}>警戒 · 黄色眼睛</option>
                <option value="low" ${item?.priority === "low" ? "selected" : ""}>低危 · 游荡阴影</option>
              </select>
            </div>
            <div class="form-field full">
              <label for="urgentNote">备注 <small>选填</small></label>
              <input class="input" id="urgentNote" name="note" maxlength="120" value="${escapeHtml(item?.note || "")}" placeholder="交付方式、联系人或者一句提醒">
            </div>
          </div>
          <div class="form-help" style="margin-top:12px">占用时间的事项会同步出现在对应日期的课表里；只有截止时间的事项会以虚线标记截止点。</div>
          <div class="form-actions">
            ${item ? `<button class="danger-link" type="button" data-action="delete-urgent" data-id="${escapeHtml(item.id)}">移除这只阴影</button>` : ""}
            <button class="btn secondary" type="button" data-action="close-modal">取消</button>
            <button class="btn coral-btn" type="submit">${item ? "保存修改" : "让它长出来"}</button>
          </div>
        </form>`,
      onSubmit: handleUrgentSubmit
    });
    syncUrgentTimeFields();
  }

  function syncUrgentTimeFields() {
    const category = $('input[name="category"]:checked', $("#modalBody"))?.value || "deadline";
    $$("[data-time-field]", $("#modalBody")).forEach((field) => {
      field.style.display = category === "time" ? "grid" : "none";
      $$("input", field).forEach((input) => { input.required = category === "time"; });
    });
  }

  function handleUrgentSubmit(form) {
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const category = String(data.get("category") || "deadline");
    const start = category === "time" ? String(data.get("start") || "") : "";
    const end = category === "time" ? String(data.get("end") || "") : "";
    if (category === "time" && minutesFromTime(end) <= minutesFromTime(start)) {
      showToast("占用时间不完整", "结束时间需要晚于开始时间。", "clock");
      return;
    }
    const location = String(data.get("location") || "").trim();
    ensureLocation(location);
    const payload = {
      id: form.dataset.id || uid("urgent"),
      title,
      category,
      date: String(data.get("date")),
      dueTime: String(data.get("dueTime") || "23:59"),
      start,
      end,
      location,
      priority: String(data.get("priority") || "medium"),
      note: String(data.get("note") || "").trim(),
      completed: false,
      createdAt: form.dataset.id
        ? state.urgent.find((item) => item.id === form.dataset.id)?.createdAt || new Date().toISOString()
        : new Date().toISOString()
    };
    const index = state.urgent.findIndex((item) => item.id === payload.id);
    if (index >= 0) state.urgent[index] = payload;
    else state.urgent.push(payload);
    saveState();
    closeModal();
    renderAll();
    showToast(index >= 0 ? "阴影信息已更新" : "一只阴影出现了", `${title} · 已同步到 ${formatDateCN(parseLocalDate(payload.date))}`, "sprout");
  }

  function openHabitModal(habit = null) {
    openModal({
      title: habit ? "照料这株每日幼苗" : "种下一件每日小事",
      kicker: "DAILY GARDEN",
      html: `
        <form data-form="habit" data-id="${habit ? escapeHtml(habit.id) : ""}">
          <div class="form-grid">
            <div class="form-field full">
              <label for="habitName">每日事项</label>
              <input class="input" id="habitName" name="name" required maxlength="30" value="${escapeHtml(habit?.name || "")}" placeholder="例如：阅读 20 分钟、背 30 个单词">
            </div>
            <div class="form-field">
              <label for="habitIcon">幼苗图标</label>
              <input class="input" id="habitIcon" name="icon" maxlength="4" value="${escapeHtml(habit?.icon || "🌱")}" placeholder="🌱">
            </div>
            <div class="form-field">
              <label for="habitReminder">每日提醒时间</label>
              <input class="input" id="habitReminder" name="reminder" type="time" required value="${escapeHtml(habit?.reminder || "20:00")}">
            </div>
            <div class="form-field full">
              <label for="habitColor">花朵颜色</label>
              <select class="select" id="habitColor" name="color">
                ${[
                  ["#719d61", "青草绿"], ["#d99a58", "落日橙"], ["#6e9d9d", "湖水蓝"], ["#9b8bb3", "暮色紫"], ["#d37c79", "花瓣粉"]
                ].map(([value, label]) => `<option value="${value}" ${habit?.color === value ? "selected" : ""}>${label}</option>`).join("")}
              </select>
            </div>
          </div>
          <p class="mini-modal-copy" style="margin-top:14px">每天只能打一次卡。完成记录会变成叶片，连续完成的天数会累计在花盆旁。</p>
          <div class="form-actions">
            ${habit ? `<button class="danger-link" type="button" data-action="delete-habit" data-id="${escapeHtml(habit.id)}">移除这株幼苗</button>` : ""}
            <button class="btn secondary" type="button" data-action="close-modal">取消</button>
            <button class="btn primary" type="submit">${habit ? "保存照料方式" : "把它种下"}</button>
          </div>
        </form>`,
      onSubmit: handleHabitSubmit
    });
  }

  function handleHabitSubmit(form) {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const old = state.habits.find((habit) => habit.id === form.dataset.id);
    const payload = {
      id: form.dataset.id || uid("habit"),
      name,
      icon: String(data.get("icon") || "🌱").trim().slice(0, 4) || "🌱",
      reminder: String(data.get("reminder") || "20:00"),
      color: String(data.get("color") || "#719d61"),
      records: old?.records || []
    };
    const index = state.habits.findIndex((habit) => habit.id === payload.id);
    if (index >= 0) state.habits[index] = payload;
    else state.habits.push(payload);
    saveState();
    closeModal();
    renderAll();
    showToast(index >= 0 ? "幼苗照料方式已更新" : "幼苗已经种下", `${name} · 每日 ${payload.reminder} 提醒`, "sprout");
  }

  function openImportModal() {
    openModal({
      title: "导入课表",
      kicker: "IMPORT TIMETABLE",
      wide: true,
      html: `
        <form data-form="import">
          <p class="mini-modal-copy">支持 CSV、TSV 或 JSON 文本。每一行是一门每周重复的课程；地点会自动加入卡通地图。</p>
          <div class="import-box">
            <b>示例 CSV（可以直接复制修改）</b>
            <code>day,start,end,title,location,type
周一,08:30,10:05,高等数学,教学楼,lecture
周三,14:00,15:30,项目讨论,图书馆,personal</code>
          </div>
          <div class="file-row">
            <input type="file" id="timetableFile" accept=".csv,.tsv,.txt,.json">
            <label class="file-label" for="timetableFile">${icon("upload")} 选择文件</label>
            <span class="file-name" id="importFileName">或直接粘贴到下方</span>
            <button class="small-action" type="button" data-action="fill-sample">填入示例</button>
          </div>
          <div class="form-field full" style="margin-top:13px">
            <label for="importText">课表内容</label>
            <textarea class="textarea" id="importText" name="content" placeholder="day,start,end,title,location,type&#10;周一,08:30,10:05,高等数学,教学楼,lecture"></textarea>
          </div>
          <div class="form-grid" style="margin-top:13px">
            <div class="form-field">
              <label for="importMode">导入方式</label>
              <select class="select" id="importMode" name="mode">
                <option value="merge">追加到现有课表</option>
                <option value="replace">替换现有课表</option>
              </select>
            </div>
            <div class="form-field">
              <label>支持的时间格式</label>
              <div class="form-help" style="padding-top:10px">08:30、8:30、0830 均可。</div>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn secondary" type="button" data-action="close-modal">取消</button>
            <button class="btn primary" type="submit">${icon("upload")} 导入课表</button>
          </div>
        </form>`,
      onSubmit: handleImportSubmit
    });
  }

  function parseDelimitedLine(line, delimiter) {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === delimiter && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  function normalizeTime(value) {
    const text = String(value || "").trim().replace(/[：.]/g, ":");
    if (/^\d{4}$/.test(text)) return `${text.slice(0, 2)}:${text.slice(2)}`;
    const match = text.match(/^(\d{1,2}):(\d{1,2})/);
    if (!match) return "";
    const hour = Math.min(23, Number(match[1]));
    const minute = Math.min(59, Number(match[2]));
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function normalizeDay(value) {
    const text = String(value || "").trim().toLowerCase();
    const map = {
      "1": 1, "周一": 1, "星期一": 1, "monday": 1, "mon": 1, "一": 1,
      "2": 2, "周二": 2, "星期二": 2, "tuesday": 2, "tue": 2, "二": 2,
      "3": 3, "周三": 3, "星期三": 3, "wednesday": 3, "wed": 3, "三": 3,
      "4": 4, "周四": 4, "星期四": 4, "thursday": 4, "thu": 4, "四": 4,
      "5": 5, "周五": 5, "星期五": 5, "friday": 5, "fri": 5, "五": 5,
      "6": 6, "周六": 6, "星期六": 6, "saturday": 6, "sat": 6, "六": 6,
      "7": 7, "7": 7, "周日": 7, "周天": 7, "星期日": 7, "星期天": 7, "sunday": 7, "sun": 7, "日": 7, "天": 7
    };
    return map[text] || 0;
  }

  function normalizeParity(value) {
    const text = String(value || "").trim().toLowerCase();
    if (["odd", "单", "单周", "1"].includes(text)) return "odd";
    if (["even", "双", "双周", "2"].includes(text)) return "even";
    return "all";
  }

  function parseTimetable(text) {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("没有找到可导入的内容");
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed);
      const rows = Array.isArray(parsed) ? parsed : parsed.events;
      if (!Array.isArray(rows)) throw new Error("JSON 需要是数组，或包含 events 数组");
      return rows.map((row) => normalizeImportedEvent(row)).filter(Boolean);
    }
    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = parseDelimitedLine(lines[0], delimiter).map((cell) => cell.toLowerCase().trim());
    const indexOf = (...names) => headers.findIndex((header) => names.includes(header));
    const dayIndex = indexOf("day", "weekday", "星期", "周几");
    const startIndex = indexOf("start", "starttime", "开始", "开始时间");
    const endIndex = indexOf("end", "endtime", "结束", "结束时间");
    const titleIndex = indexOf("title", "name", "course", "课程", "名称");
    const locationIndex = indexOf("location", "place", "room", "地点", "教室");
    const typeIndex = indexOf("type", "类型");
    const parityIndex = indexOf("parity", "week", "周次", "单双周");
    const fromIndex = indexOf("validfrom", "from", "开始日期", "生效开始");
    const toIndex = indexOf("validto", "to", "结束日期", "生效结束");
    if (dayIndex < 0 || startIndex < 0 || endIndex < 0 || titleIndex < 0) {
      throw new Error("表头需要包含 day、start、end、title（也支持中文表头）");
    }
    return lines.slice(1).map((line) => {
      const cells = parseDelimitedLine(line, delimiter);
      const row = {
        day: cells[dayIndex],
        start: cells[startIndex],
        end: cells[endIndex],
        title: cells[titleIndex],
        location: locationIndex >= 0 ? cells[locationIndex] : "",
        type: typeIndex >= 0 ? cells[typeIndex] : "lecture",
        parity: parityIndex >= 0 ? cells[parityIndex] : "all",
        validFrom: fromIndex >= 0 ? cells[fromIndex] : "",
        validTo: toIndex >= 0 ? cells[toIndex] : ""
      };
      return normalizeImportedEvent(row);
    }).filter(Boolean);
  }

  function normalizeImportedEvent(row) {
    const day = normalizeDay(row.day);
    const start = normalizeTime(row.start);
    const end = normalizeTime(row.end);
    const title = String(row.title || row.name || row.course || "").trim();
    if (!day || !start || !end || !title) return null;
    const typeRaw = String(row.type || "").toLowerCase();
    return {
      id: uid("evt"),
      day,
      start,
      end,
      title,
      location: String(row.location || row.place || row.room || "").trim(),
      type: ["personal", "个人", "生活", "other"].includes(typeRaw) ? "personal" : "lecture",
      parity: normalizeParity(row.parity || row.week || row.weekParity),
      validFrom: String(row.validFrom || row.valid_from || row.from || "").trim(),
      validTo: String(row.validTo || row.valid_to || row.to || "").trim(),
      note: String(row.note || "导入日程").trim()
    };
  }

  function handleImportSubmit(form) {
    const data = new FormData(form);
    const text = String(data.get("content") || "").trim();
    try {
      const imported = parseTimetable(text);
      if (!imported.length) throw new Error("没有解析出有效课程，请检查星期和时间");
      imported.forEach((event) => ensureLocation(event.location));
      if (data.get("mode") === "replace") state.events = imported;
      else state.events.push(...imported);
      saveState();
      closeModal();
      state.selectedDay = imported[0].day;
      state.weekOffset = 0;
      renderAll();
      showToast("课表导入完成", `成功加入 ${imported.length} 项日程与 ${new Set(imported.map((event) => event.location).filter(Boolean)).size} 个地点。`, "calendar");
    } catch (error) {
      let message = $("#importError");
      if (!message) {
        message = document.createElement("div");
        message.id = "importError";
        message.setAttribute("role", "alert");
        message.className = "form-help";
        message.style.color = "#b14f3d";
        message.style.marginTop = "10px";
        form.querySelector(".form-field:last-of-type")?.after(message);
      }
      message.textContent = `导入失败：${error.message}`;
    }
  }

  function openCommuteModal() {
    ensureAllEventLocations();
    const locations = state.locations.slice(0, 10);
    const pairs = [];
    for (let i = 0; i < locations.length; i += 1) {
      for (let j = i + 1; j < locations.length; j += 1) {
        pairs.push([locations[i], locations[j]]);
      }
    }
    openModal({
      title: "编辑步行通勤时间",
      kicker: "COGNITIVE MAP",
      wide: true,
      html: `
        <form data-form="commute">
          <p class="mini-modal-copy">填写地点之间的步行分钟数。地图会根据下一项日程，自动计算建议出发时间。</p>
          <div class="commute-matrix">
            ${pairs.length ? pairs.map(([a, b]) => {
              const key = transportKey(a.name, b.name);
              const current = state.transports[key] ?? 8;
              return `<div class="commute-row"><span>${escapeHtml(a.icon)} ${escapeHtml(a.name)}</span><i>↔</i><span>${escapeHtml(b.icon)} ${escapeHtml(b.name)}</span><input type="number" min="0" max="180" step="1" value="${Number(current)}" data-pair="${escapeHtml(key)}" aria-label="${escapeHtml(`${a.name}到${b.name}的通勤时间`)}"></div>`;
            }).join("") : `<div class="empty-state"><b>还没有两个地点</b><p>先在日程里添加带地点的安排。</p></div>`}
          </div>
          <div class="form-actions">
            <button class="btn secondary" type="button" data-action="close-modal">取消</button>
            <button class="btn primary" type="submit">保存通勤时间</button>
          </div>
        </form>`,
      onSubmit: (form) => {
        $$("input[data-pair]", form).forEach((input) => {
          const value = Math.max(0, Math.min(180, Number(input.value) || 0));
          state.transports[input.dataset.pair] = value;
        });
        saveState();
        closeModal();
        renderSchedule();
        showToast("通勤时间已更新", "地图和出发提醒已按新的步行时间计算。", "route");
      }
    });
  }

  function openProfileModal() {
    openModal({
      title: "农场设置",
      kicker: "PLAN PROFILE",
      html: `
        <form data-form="profile">
          <div class="form-grid">
            <div class="form-field full">
              <label for="profileName">你的称呼</label>
              <input class="input" id="profileName" name="name" maxlength="20" value="${escapeHtml(state.profileName || "suslov")}">
            </div>
            <div class="form-field full">
              <label>浏览器提醒</label>
              <div class="form-help">${notificationActive() ? "已开启。日程或每日事项到达提醒时间时会发送通知。" : "尚未开启。点击页面右上角的铃铛即可申请权限。"}</div>
            </div>
          </div>
          <div class="form-actions">
            <button class="danger-link" type="button" data-action="reset-demo">恢复示例数据</button>
            <button class="btn secondary" type="button" data-action="close-modal">取消</button>
            <button class="btn primary" type="submit">保存设置</button>
          </div>
        </form>`,
      onSubmit: (form) => {
        const data = new FormData(form);
        state.profileName = String(data.get("name") || "suslov").trim() || "suslov";
        saveState();
        closeModal();
        renderAll();
        showToast("设置已保存", `你好，${state.profileName}。`, "sun");
      }
    });
  }

  function generateCloudCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(15));
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const raw = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
    return `SLV-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}`;
  }

  function openCloudSyncModal() {
    const connected = Boolean(githubToken);
    openModal({
      title: "云端同步",
      kicker: "GITHUB PRIVATE CLOUD",
      html: `
        <form data-form="cloud-sync">
          <p class="mini-modal-copy">${connected
            ? "这台设备已连接 GitHub 私有云仓库。其他设备使用自己的 GitHub 令牌即可读取相同数据。"
            : "云端数据保存在私有 GitHub 仓库中。请创建一个仅限该仓库 Contents 读写权限的 fine-grained token。"}</p>
          ${connected ? `
            <div class="cloud-connected-panel">
              <span>私有云仓库</span>
              <b>${GITHUB_SYNC_OWNER}/${GITHUB_SYNC_REPO}</b>
              <small>状态：${escapeHtml($("#syncStatusText")?.textContent || "已连接")}</small>
            </div>
          ` : `
            <div class="form-grid">
              <div class="form-field full">
                <label for="githubSyncToken">GitHub fine-grained token</label>
                <input class="input" id="githubSyncToken" name="githubToken" type="password" required autocomplete="off" spellcheck="false" placeholder="github_pat_...">
              </div>
            </div>
            <p class="form-help">
              在 GitHub 的 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Fine-grained tokens</a>
              页面创建令牌，只选择私有仓库 <b>${GITHUB_SYNC_OWNER}/${GITHUB_SYNC_REPO}</b>，
              并将 Repository permissions → Contents 设为 Read and write。
            </p>
            <p class="form-help">令牌只保存在当前设备浏览器中，不会写入网页代码。</p>
          `}
          <div class="form-actions">
            ${connected ? `
              <button class="danger-link" type="button" data-action="disconnect-cloud">断开此设备</button>
              <button class="btn secondary" type="button" data-action="sync-cloud-now">立即同步</button>
            ` : `<button class="btn secondary" type="button" data-action="close-modal">取消</button>`}
            ${connected ? "" : `<button class="btn primary" type="submit">连接云同步</button>`}
          </div>
        </form>`
      , onSubmit: handleCloudSyncSubmit
    });
  }

  async function handleCloudSyncSubmit(form) {
    const data = new FormData(form);
    const token = String(data.get("githubToken") || "").trim();
    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = true;
      submit.textContent = "正在连接…";
    }
    try {
      if (!["github_pat_", "ghp_", "gho_"].some((prefix) => token.startsWith(prefix))) {
        throw new Error("请输入有效 GitHub 访问令牌");
      }
      const previousToken = githubToken;
      githubToken = token;
      const ok = await syncWithGitHub();
      if (!ok) {
        githubToken = previousToken;
        throw new Error("无法读取私有云仓库，请检查仓库和 Contents 权限");
      }
      localStorage.setItem(GITHUB_TOKEN_KEY, githubToken);
      closeModal();
      renderAll();
      showToast("云同步已连接", "已连接到 GitHub 私有云仓库。", "check");
    } catch (error) {
      showToast("云同步连接失败", error.message, "bell");
      if (submit) {
        submit.disabled = false;
        submit.textContent = "连接云同步";
      }
    }
  }

  function notificationActive() {
    return Boolean(state.settings.notifications && "Notification" in window && Notification.permission === "granted");
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      showToast("当前浏览器不支持通知", "页面内的到达提醒仍然会正常工作。", "bell");
      return;
    }
    if (Notification.permission === "denied") {
      showToast("通知权限已被关闭", "请在浏览器地址栏的站点设置里重新允许通知。", "bell");
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      state.settings.notifications = true;
      saveState();
      renderHeader();
      renderHabits();
      showToast("浏览器提醒已开启", "到达提醒时间时，我会来敲敲你的窗。", "bell");
      sendNotification("时间管理计划提醒已连接", "今天的行动路线会按时提醒你。");
    } else {
      showToast("暂未开启浏览器提醒", "你仍会看到页面内的提醒与变化。", "bell");
    }
  }

  function sendNotification(title, body) {
    if (!notificationActive()) return;
    try {
      const notice = new Notification(title, {
        body,
        tag: `${title}-${dateKey(now())}`,
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%23214f3b'/%3E%3Ccircle cx='42' cy='20' r='9' fill='%23edc35c'/%3E%3Cpath d='M4 50Q32 24 60 50Z' fill='%236f9f61'/%3E%3C/svg%3E"
      });
      setTimeout(() => notice.close(), 9000);
    } catch {
      // Browser notifications can fail when the document is not visible.
    }
  }

  function checkReminders() {
    const today = now();
    const key = dateKey(today);
    const time = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
    scheduleEventsForDate(today).forEach((event) => {
      if (event.start !== time) return;
      const noticeKey = `event:${key}:${event.id}:${time}`;
      if (notifiedKeys.has(noticeKey)) return;
      notifiedKeys.add(noticeKey);
      showToast(`该去 ${event.location || "下一站"} 了`, `${event.title} 将在 ${event.start} 开始。`, "pin");
      sendNotification(`该去 ${event.location || "下一站"} 了`, `${event.title} 将在 ${event.start} 开始。`);
    });
    state.habits.forEach((habit) => {
      if (habit.reminder !== time || habitDoneToday(habit)) return;
      const noticeKey = `habit:${key}:${habit.id}:${time}`;
      if (notifiedKeys.has(noticeKey)) return;
      notifiedKeys.add(noticeKey);
      showToast(`给「${habit.name}」浇点水`, "今天的每日事项还在等你，完成一个小格子就好。", "water");
      sendNotification(`给「${habit.name}」浇点水`, "今天的每日事项还在等你，完成一个小格子就好。");
    });
    activeUrgent()
      .filter((item) => item.date === key && item.dueTime === time)
      .forEach((item) => {
        const noticeKey = `urgent:${key}:${item.id}:${time}`;
        if (notifiedKeys.has(noticeKey)) return;
        notifiedKeys.add(noticeKey);
        showToast("阴影进入警戒", `${item.title} 到了 ${time} 的截止时间。`, "sprout");
        sendNotification("阴影进入警戒", `${item.title} 到了 ${time} 的截止时间。`);
      });
    const routeInfo = currentOrNextScheduleInfo();
    if (routeInfo.isToday && routeInfo.next) {
      const commute = transportMinutes(routeInfo.location.name, mapLocationName(routeInfo.next.location) || "宿舍");
      const departure = addMinutesToTime(routeInfo.next.start, -commute);
      if (departure === time) {
        const noticeKey = `depart:${key}:${routeInfo.next.id}:${time}`;
        if (!notifiedKeys.has(noticeKey)) {
          notifiedKeys.add(noticeKey);
          showToast("可以出发啦", `从 ${routeInfo.location.name} 到 ${routeInfo.next.location || "宿舍"} 约 ${commute} 分钟。`, "route");
          sendNotification("可以出发啦", `${routeInfo.next.title} 在 ${routeInfo.next.start} 开始。`);
        }
      }
    }
  }

  function completeChore(id) {
    const chore = state.chores.find((item) => item.id === id);
    if (!chore) return;
    chore.lastDone = new Date().toISOString();
    saveState();
    renderAll();
    confetti(18);
    showToast("目标已攻破", `${chore.name} 已完成，新的冷却周期从现在开始。`, "tree");
  }

  function completeUrgent(id) {
    const item = state.urgent.find((entry) => entry.id === id);
    if (!item) return;
    const soil = $("#mowingDebris");
    const weed = $(`.weed-item[data-id="${CSS.escape(id)}"]`);
    const rect = weed?.getBoundingClientRect();
    if (soil && rect) {
      const parentRect = soil.getBoundingClientRect();
      for (let i = 0; i < 11; i += 1) {
        const clipping = document.createElement("i");
        clipping.className = "grass-clipping";
        clipping.style.left = `${rect.left - parentRect.left + Math.random() * 70}px`;
        clipping.style.top = `${rect.top - parentRect.top + 50 + Math.random() * 45}px`;
        clipping.style.transform = `rotate(${Math.random() * 180}deg)`;
        clipping.style.background = i % 2 ? "#d50b1d" : "#111111";
        soil.appendChild(clipping);
        setTimeout(() => clipping.remove(), 900);
      }
    }
    weed?.classList.add("mowing");
    item.completed = true;
    item.completedAt = new Date().toISOString();
    saveState();
    setTimeout(() => {
      renderAll();
      showToast("阴影已击破", `${item.title} 已从认知空间和行动时刻表中移除。`, "broom");
    }, 620);
  }

  function checkHabit(id) {
    const habit = state.habits.find((item) => item.id === id);
    if (!habit || habitDoneToday(habit)) return;
    habit.records = Array.isArray(habit.records) ? habit.records : [];
    habit.records.push(dateKey(now()));
    saveState();
    renderAll();
    const card = $(`.habit-card[data-habit-id="${CSS.escape(id)}"]`);
    card?.classList.add("watering");
    confetti(14);
    showToast("飞刀命中靶心", `${habit.name} 已连续命中 ${habitStreak(habit)} 天。`, "check");
  }

  function deleteItem(collection, id, label) {
    const item = state[collection].find((entry) => entry.id === id);
    if (!item) return;
    if (!window.confirm(`确定要移除「${item.title || item.name}」吗？`)) return;
    state[collection] = state[collection].filter((entry) => entry.id !== id);
    saveState();
    closeModal();
    renderAll();
    showToast(`${label}已移除`, `${item.title || item.name} 已从农场里删除。`, "trash");
  }

  function openHabitHistory() {
    const days = Array.from({ length: 14 }, (_, i) => addDays(now(), -13 + i));
    openModal({
      title: "最近的每日记录",
      kicker: "GARDEN JOURNAL",
      wide: true,
      html: `
        <p class="mini-modal-copy">这里汇总了所有每日事项的完成情况。叶子越绿，代表当天完成的事项越多。</p>
        <div style="overflow-x:auto">
          <table class="history-table">
            <thead><tr><th>日期</th>${state.habits.map((habit) => `<th>${escapeHtml(habit.icon)} ${escapeHtml(habit.name)}</th>`).join("")}<th>小计</th></tr></thead>
            <tbody>
              ${days.reverse().map((date) => {
                const key = dateKey(date);
                const done = state.habits.map((habit) => habit.records?.includes(key));
                return `<tr><td>${formatDateCN(date)} ${chineseWeekday(date)}</td>${done.map((flag) => `<td class="${flag ? "status-ok" : "status-no"}">${flag ? "已命中" : "—"}</td>`).join("")}<td>${done.filter(Boolean).length}/${state.habits.length}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        <div class="form-actions"><button class="btn primary" type="button" data-action="close-modal">收好记录</button></div>`
    });
  }

  function openCompletedUrgent() {
    const items = state.urgent.filter((item) => item.completed).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    openModal({
      title: "已经击破的阴影",
      kicker: "CLEARED PATCHES",
      html: items.length ? `
        <div class="weed-list">
          ${items.slice(0, 20).map((item) => `
            <div class="weed-task ${escapeHtml(item.priority)}">
              <div class="weed-task-head"><b>${escapeHtml(item.title)}</b><span>已清理</span></div>
              <div class="weed-task-meta"><span>${icon("check")} ${formatDateCN(new Date(item.completedAt))} 完成</span>${item.location ? `<span>${icon("pin")} ${escapeHtml(item.location)}</span>` : ""}</div>
              <button class="small-action" type="button" data-action="restore-urgent" data-id="${escapeHtml(item.id)}">重新种回去</button>
            </div>`).join("")}
        </div>
        <div class="form-actions"><button class="btn primary" type="button" data-action="close-modal">完成</button></div>`
      : `<div class="empty-state"><span class="empty-state-emoji">✦</span><b>还没有击破过阴影</b><p>完成突发事项后，会在这里留下战斗记录。</p></div>
         <div class="form-actions"><button class="btn primary" type="button" data-action="close-modal">完成</button></div>`
    });
  }

  function openChoreHelp() {
    openModal({
      title: "认知目标如何警戒？",
      kicker: "ORCHARD GUIDE",
      html: `
        <p class="mini-modal-copy">每件日常事务都是一个潜入目标。警戒程度由上次完成时间和设定周期共同决定。</p>
        <div class="form-grid">
          <div class="form-field"><label>冷却阶段</label><div class="form-help">完成时间不到周期的 55%，目标暂时安全。</div></div>
          <div class="form-field"><label>警戒阶段</label><div class="form-help">到达周期的 55% 后开始闪烁，提醒你准备处理。</div></div>
          <div class="form-field"><label>可下手</label><div class="form-help">到达周期的 90% 后变成红色，就是最佳行动时机。</div></div>
          <div class="form-field"><label>失控阶段</label><div class="form-help">超过周期约 35%，目标会占据认知区并持续报警。</div></div>
        </div>
        <div class="form-actions"><button class="btn primary" type="button" data-action="close-modal">前往认知目标板</button></div>`
    });
  }

  function openWeedHelp() {
    openModal({
      title: "突发事项怎么长进课表？",
      kicker: "WEED GUIDE",
      html: `
        <p class="mini-modal-copy">突发事项有两种记录方式，都会自动出现在对应星期的课表里。</p>
        <div class="form-grid">
          <div class="form-field"><label>只有截止时间</label><div class="form-help">课表上会出现一条红色虚线，只占一小段，提醒你截止时刻。</div></div>
          <div class="form-field"><label>占用一段时间</label><div class="form-help">就像课程一样占据完整时间块，便于看到冲突和剩余空地。</div></div>
          <div class="form-field"><label>击破 · 清除</label><div class="form-help">点击“击破”后，阴影怪物和行动时刻表中的时间块会一起消失。</div></div>
          <div class="form-field"><label>危险等级</label><div class="form-help">红色、黄色、粉色分别代表高危、警戒和普通阴影。</div></div>
        </div>
        <div class="form-actions"><button class="btn primary" type="button" data-action="close-modal">明白了</button></div>`
    });
  }

  function resetDemoData() {
    if (!window.confirm("恢复示例数据会清空当前所有日程、事务和打卡记录，确定继续吗？")) return;
    state = createDefaultState();
    saveState();
    closeModal();
    renderAll();
    showToast("示例认知域已恢复", "可以从一张完整的行动路线重新开始。", "sprout");
  }

  function handleAction(button) {
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (!action) return;
    if (action === "add-event") openEventModal();
    if (action === "edit-event") openEventModal(state.events.find((event) => event.id === id));
    if (action === "delete-event") deleteItem("events", id, "日程");
    if (action === "open-import") openImportModal();
    if (action === "prev-week" || action === "next-week") {
      state.weekOffset += action === "next-week" ? 1 : -1;
      saveState();
      renderSchedule();
    }
    if (action === "this-week") {
      state.weekOffset = 0;
      state.selectedDay = isoDay(now());
      saveState();
      renderSchedule();
    }
    if (action === "select-day") {
      state.selectedDay = Number(button.dataset.day);
      saveState();
      renderSchedule();
    }
    if (action === "toggle-time-details") {
      const block = button.closest(".time-block");
      if (!block) return;
      const willOpen = !block.classList.contains("expanded");
      $$(".time-block.expanded").forEach((item) => {
        item.classList.remove("expanded");
        const toggle = $(".time-block-main", item);
        toggle?.setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        block.classList.add("expanded");
        button.setAttribute("aria-expanded", "true");
      }
    }
    if (action === "edit-commute") openCommuteModal();
    if (action === "zoom-map") openMapZoom();
    if (action === "add-chore") openChoreModal();
    if (action === "edit-chore") openChoreModal(state.chores.find((chore) => chore.id === id));
    if (action === "pick-chore") completeChore(id);
    if (action === "delete-chore") deleteItem("chores", id, "日常事务");
    if (action === "chore-help") openChoreHelp();
    if (action === "add-urgent") openUrgentModal();
    if (action === "edit-urgent") openUrgentModal(state.urgent.find((item) => item.id === id));
    if (action === "complete-urgent") completeUrgent(id);
    if (action === "delete-urgent") deleteItem("urgent", id, "突发事项");
    if (action === "weed-help") openWeedHelp();
    if (action === "show-completed") openCompletedUrgent();
    if (action === "restore-urgent") {
      const item = state.urgent.find((entry) => entry.id === id);
      if (item) {
        item.completed = false;
        item.completedAt = null;
        saveState();
        closeModal();
        renderAll();
        showToast("阴影再次出现", `${item.title} 已重新加入警报清单。`, "sprout");
      }
    }
    if (action === "add-habit") openHabitModal();
    if (action === "edit-habit") openHabitModal(state.habits.find((habit) => habit.id === id));
    if (action === "delete-habit") deleteItem("habits", id, "每日事项");
    if (action === "check-habit") checkHabit(id);
    if (action === "habit-history") openHabitHistory();
    if (action === "close-modal") closeModal();
    if (action === "reset-demo") resetDemoData();
    if (action === "cloud-settings") openCloudSyncModal();
    if (action === "generate-cloud-code") {
      const code = generateCloudCode();
      const input = $("#cloudSyncCode");
      if (input) input.value = code;
      navigator.clipboard?.writeText(code).catch(() => {});
      showToast("同步码已生成", "已复制到剪贴板，请妥善保存。", "check");
    }
    if (action === "sync-cloud-now") {
      syncWithGitHub().then((ok) => showToast(ok ? "云端同步完成" : "云同步失败", $("#syncStatusText")?.textContent || "", "check"));
    }
    if (action === "disconnect-cloud") {
      if (window.confirm("断开后，此设备会保留本地数据，但不再与其他设备同步。确定继续吗？")) {
        githubToken = "";
        localStorage.removeItem(GITHUB_TOKEN_KEY);
        persistCloudSession(null);
        syncPending = false;
        closeModal();
        setSyncStatus("local", "仅本机");
        showToast("已断开云同步", "本地数据仍然保留。", "bell");
      }
    }
    if (action === "replay-date-transition") playDateTransition(addDays(now(), -1), now());
    if (action === "fill-sample") {
      $("#importText").value = "day,start,end,title,location,type\n周一,09:55,11:35,微积分 A1,H6112,lecture\n周二,08:00,09:40,线性代数 A,H2220,lecture\n周三,08:00,09:40,龙狮运动,H南区篮球场,lecture\n周四,18:30,20:10,第一哲学沉思集,H3306,lecture\n周五,13:30,15:10,高级英语,H2112B,lecture";
      $("#importFileName").textContent = "示例内容已填入";
    }
  }

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-page]");
    if (nav) {
      switchPage(nav.dataset.page);
      return;
    }
    const actionElement = event.target.closest("[data-action]");
    if (actionElement) {
      event.preventDefault();
      event.stopPropagation();
      handleAction(actionElement);
      return;
    }
    if (event.target === $("#modalBackdrop")) closeModal();
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    if (modalSubmitHandler) modalSubmitHandler(form);
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches('input[name="category"]')) syncUrgentTimeFields();
    if (event.target.id === "timetableFile") {
      const file = event.target.files?.[0];
      if (!file) return;
      $("#importFileName").textContent = file.name;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const textarea = $("#importText");
        if (textarea) textarea.value = String(reader.result || "");
      });
      reader.readAsText(file, "UTF-8");
    }
  });

  $("#mobileMenu").addEventListener("click", () => {
    $("#sidebar").classList.toggle("mobile-open");
  });
  $("#farmMap").addEventListener("click", (event) => {
    if (event.target.closest("[data-action]")) return;
    openMapZoom();
  });
  $("#notificationBtn").addEventListener("click", enableNotifications);
  $("#enableNotifyHabit").addEventListener("click", enableNotifications);
  $("#profileBtn").addEventListener("click", openProfileModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#modalBackdrop").hidden) closeModal();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openEventModal();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      renderAll();
      checkReminders();
      syncActive();
    }
  });
  window.addEventListener("online", syncActive);

  ensureAllEventLocations();
  saveState();
  renderAll();
  initializeSync();
  const storedDateMarker = localStorage.getItem(DATE_MARKER_KEY);
  if (storedDateMarker && storedDateMarker !== observedDateKey) {
    setTimeout(() => playDateTransition(parseLocalDate(storedDateMarker), now()), 500);
  }
  localStorage.setItem(DATE_MARKER_KEY, observedDateKey);
  if (new URLSearchParams(window.location.search).get("dateDemo") === "1") {
    setTimeout(() => playDateTransition(addDays(now(), -1), now()), 900);
  }
  loadWeather();
  const initialPage = window.location.hash.replace("#", "");
  if (initialPage && initialPage !== "schedule") switchPage(initialPage);
  checkReminders();
  setInterval(() => {
    const liveDateKey = dateKey(now());
    if (liveDateKey !== observedDateKey) {
      const previousDate = parseLocalDate(observedDateKey);
      observedDateKey = liveDateKey;
      localStorage.setItem(DATE_MARKER_KEY, observedDateKey);
      playDateTransition(previousDate, now());
      loadWeather();
      renderAll();
    }
    renderHeader();
    if (currentPage === "schedule") renderSchedule();
    if (currentPage === "urgent") renderUrgent();
    checkReminders();
  }, 30000);
  setInterval(loadWeather, 30 * 60 * 1000);
  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
