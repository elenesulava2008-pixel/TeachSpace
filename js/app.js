// --------------------
// CONFIG + SUPABASE
// --------------------
const SUPABASE_URL = window.__ENV?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.__ENV?.SUPABASE_ANON_KEY;

function showAuthMsg(text) {
  const msg = document.getElementById("authMsg");
  if (msg) msg.textContent = text || "";
}

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showAuthMsg(
      "Missing SUPABASE_URL / SUPABASE_ANON_KEY. Add them in Render → Environment and redeploy."
    );
    return false;
  }
  return true;
}

if (!window.supabase) {
  showAuthMsg("Supabase library didn't load. Check the script tag order in index.html.");
}

const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --------------------
// TRANSLATIONS
// --------------------
const translations = {
  en: {
    nav: "Navigation",
    calendar: "Calendar",
    addStudent: "Add Student",
    addTask: "Add Task",
    students: "Students",
    schedule: "Schedule",

    monthlyCalendar: "Teacher Calendar",
    addStudentTitle: "Add Student",
    addTaskTitle: "Add Task / Reminder",
    scheduleTitle: "Add Weekly Lesson",

    studentName: "Student:",
    taskTextLabel: "Task:",
    dueDate: "Due Date:",
    dayOfWeek: "Day of Week:",
    time: "Time:",

    addStudentBtn: "Add Student",
    addTaskBtn: "Add Task",
    addLessonBtn: "Add Lesson",

    studentPlaceholder: "Enter student name",
    taskPlaceholder: "Enter task or reminder",

    prev: "← Previous",
    next: "Next →",

    noStudents: "No students added yet.",
    remove: "Remove",

    noItemsForDay: "No lessons or tasks for this day.",
    tasksTitle: "Tasks due:",
    lessonsTitle: "Lessons:",
    weeklyLessons: "Weekly lessons:",
    upcomingTasks: "Upcoming / overdue tasks:",
    none: "none",

    submitted: "Submitted",
    markSubmitted: "Mark submitted",
    overdue: "OVERDUE",
    dueToday: "DUE TODAY",
  },
  de: {
    nav: "Navigation",
    calendar: "Kalender",
    addStudent: "Schüler hinzufügen",
    addTask: "Aufgabe hinzufügen",
    students: "Schüler",
    schedule: "Stundenplan",

    monthlyCalendar: "Lehrerkalender",
    addStudentTitle: "Schüler hinzufügen",
    addTaskTitle: "Aufgabe / Erinnerung hinzufügen",
    scheduleTitle: "Wöchentlichen Unterricht hinzufügen",

    studentName: "Schüler:",
    taskTextLabel: "Aufgabe:",
    dueDate: "Abgabedatum:",
    dayOfWeek: "Wochentag:",
    time: "Uhrzeit:",

    addStudentBtn: "Schüler hinzufügen",
    addTaskBtn: "Aufgabe hinzufügen",
    addLessonBtn: "Unterricht hinzufügen",

    studentPlaceholder: "Name eingeben",
    taskPlaceholder: "Aufgabe oder Erinnerung eingeben",

    prev: "← Zurück",
    next: "Weiter →",

    noStudents: "Noch keine Schüler hinzugefügt.",
    remove: "Entfernen",

    noItemsForDay: "Keine Aufgaben oder Unterricht an diesem Tag.",
    tasksTitle: "Fällige Aufgaben:",
    lessonsTitle: "Unterricht:",
    weeklyLessons: "Wöchentlicher Unterricht:",
    upcomingTasks: "Bevorstehende / überfällige Aufgaben:",
    none: "keine",

    submitted: "Abgegeben",
    markSubmitted: "Als abgegeben markieren",
    overdue: "ÜBERFÄLLIG",
    dueToday: "HEUTE FÄLLIG",
  },
};

let currentLang = "en";
function t(key) {
  return translations[currentLang]?.[key] ?? key;
}

function setLanguage(lang) {
  currentLang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  renderAll();
}

// --------------------
// STATE
// --------------------
let students = [];
let lessons = [];
let tasks = [];
let currentDate = new Date();

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const parseDate = (dateStr) => new Date(`${dateStr}T00:00:00`);

function isOverdue(task) {
  if (task.submitted) return false;
  return parseDate(task.due_date) < startOfToday();
}
function isDueToday(task) {
  return parseDate(task.due_date).getTime() === startOfToday().getTime();
}
function isUpcomingOrOverdueNotSubmitted(task) {
  if (task.submitted) return false;
  return parseDate(task.due_date) >= startOfToday() || isOverdue(task);
}
function studentNameById(id) {
  return students.find((s) => s.id === id)?.name ?? "Unknown";
}
function dowLabel(dow) {
  return DOW[dow] ?? "";
}

// --------------------
// AUTH
// --------------------
async function refreshAuthUI() {
  const authScreen = document.getElementById("authScreen");
  const appRoot = document.getElementById("appRoot");

  if (!requireConfig() || !supabaseClient) return;

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    const session = data?.session;
    if (!session) {
      authScreen.style.display = "block";
      appRoot.style.display = "none";
      return;
    }

    authScreen.style.display = "none";
    appRoot.style.display = "flex";

    await loadAllData();
    renderAll();
  } catch (e) {
    authScreen.style.display = "block";
    appRoot.style.display = "none";
    showAuthMsg(e?.message || String(e));
  }
}

async function login() {
  showAuthMsg("");
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  if (!email || !password) {
    showAuthMsg("Please enter email + password.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) showAuthMsg(error.message);
}

async function signup() {
  showAuthMsg("");
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  if (!email || !password) {
    showAuthMsg("Please enter email + password.");
    return;
  }
  if (password.length < 6) {
    showAuthMsg("Password must be at least 6 characters.");
    return;
  }

  const { error } = await supabaseClient.auth.signUp({ email, password });
  showAuthMsg(error ? error.message : "Account created. Check email if confirmation is enabled.");
}

async function logout() {
  await supabaseClient.auth.signOut();
}

// --------------------
// LOAD DATA
// --------------------
async function loadAllData() {
  const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData?.user?.id;

  // If your RLS is correct, filtering is optional, but it helps debugging
  const sRes = await supabaseClient.from("students").select("*").eq("user_id", userId).order("created_at");
  if (sRes.error) throw sRes.error;
  students = sRes.data ?? [];

  const lRes = await supabaseClient.from("lessons").select("*").eq("user_id", userId).order("time");
  if (lRes.error) throw lRes.error;
  lessons = lRes.data ?? [];

  const tRes = await supabaseClient.from("tasks").select("*").eq("user_id", userId).order("due_date");
  if (tRes.error) throw tRes.error;
  tasks = tRes.data ?? [];
}

// --------------------
// MUTATIONS
// --------------------
async function addStudentDB(name) {
  const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
  if (userErr) throw userErr;

  const userId = userData.user.id;

  const res = await supabaseClient
    .from("students")
    .insert([{ user_id: userId, name }])
    .select()
    .single();

  if (res.error) throw res.error;
  students.push(res.data);
}

async function deleteStudentDB(studentId) {
  const res = await supabaseClient.from("students").delete().eq("id", studentId);
  if (res.error) throw res.error;

  students = students.filter((s) => s.id !== studentId);
  lessons = lessons.filter((l) => l.student_id !== studentId);
  tasks = tasks.filter((t) => t.student_id !== studentId);
}

async function addLessonDB(studentId, dayOfWeek, time) {
  const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
  if (userErr) throw userErr;

  const userId = userData.user.id;

  const res = await supabaseClient
    .from("lessons")
    .insert([{ user_id: userId, student_id: studentId, day_of_week: dayOfWeek, time }])
    .select()
    .single();

  if (res.error) throw res.error;
  lessons.push(res.data);
}

async function addTaskDB(studentId, text, dueDate) {
  const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
  if (userErr) throw userErr;

  const userId = userData.user.id;

  const res = await supabaseClient
    .from("tasks")
    .insert([{ user_id: userId, student_id: studentId, text, due_date: dueDate, submitted: false }])
    .select()
    .single();

  if (res.error) throw res.error;
  tasks.push(res.data);
}

async function toggleTaskSubmittedDB(taskId) {
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return;

  const newValue = !tasks[idx].submitted;

  const res = await supabaseClient.from("tasks").update({ submitted: newValue }).eq("id", taskId);
  if (res.error) throw res.error;

  tasks[idx].submitted = newValue;
}

// --------------------
// RENDER
// --------------------
function renderAll() {
  renderStudentDropdowns();
  renderStudents();
  renderCalendar();
}

function renderStudentDropdowns() {
  const taskSelect = document.getElementById("task-student-select");
  const lessonSelect = document.getElementById("lesson-student");

  [taskSelect, lessonSelect].forEach((select) => {
    if (!select) return;

    select.innerHTML = "";
    if (students.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "—";
      select.appendChild(opt);
      return;
    }

    students.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      select.appendChild(opt);
    });
  });
}

function renderCalendar() {
  const calendarGrid = document.querySelector(".calendar-grid");
  const calendarMonth = document.getElementById("calendarMonth");
  if (!calendarGrid || !calendarMonth) return;

  calendarGrid.querySelectorAll(".day, .empty").forEach((d) => d.remove());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  calendarMonth.textContent = `${currentDate.toLocaleString("en-US", { month: "long" })} ${year}`;

  let firstDay = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
  firstDay = firstDay === 0 ? 6 : firstDay - 1; // convert to Mon-based

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.classList.add("day", "empty");
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.classList.add("day");
    dayDiv.textContent = day;

    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const jsDow = new Date(year, month, day).getDay();

    if (tasks.some((tk) => tk.due_date === dateString && !tk.submitted)) dayDiv.classList.add("has-homework");
    if (lessons.some((lsn) => lsn.day_of_week === jsDow)) dayDiv.classList.add("has-lesson");

    dayDiv.addEventListener("click", () => {
      const listLessons = lessons
        .filter((lsn) => lsn.day_of_week === jsDow)
        .sort((a, b) => a.time.localeCompare(b.time));

      const listTasks = tasks
        .filter((tk) => tk.due_date === dateString)
        .sort((a, b) => studentNameById(a.student_id).localeCompare(studentNameById(b.student_id)));

      let msg = "";

      if (listLessons.length) {
        msg += `${t("lessonsTitle")}\n`;
        listLessons.forEach((lsn) => {
          msg += `🕒 ${lsn.time} — 👤 ${studentNameById(lsn.student_id)}\n`;
        });
        msg += "\n";
      }

      if (listTasks.length) {
        msg += `${t("tasksTitle")}\n\n`;
        listTasks.forEach((task) => {
          const status = task.submitted
            ? `✅ ${t("submitted")}`
            : isOverdue(task)
              ? `⚠️ ${t("overdue")}`
              : isDueToday(task)
                ? `⏰ ${t("dueToday")}`
                : "⬜";
          msg += `👤 ${studentNameById(task.student_id)}\n📝 ${task.text}\n📅 ${task.due_date} — ${status}\n\n`;
        });
      }

      if (!msg) msg = t("noItemsForDay");
      alert(msg);
    });

    calendarGrid.appendChild(dayDiv);
  }
}

function renderStudents() {
  const container = document.getElementById("studentsList");
  if (!container) return;

  container.innerHTML = "";

  if (students.length === 0) {
    const p = document.createElement("p");
    p.textContent = t("noStudents");
    container.appendChild(p);
    return;
  }

  students.forEach((student) => {
    const row = document.createElement("div");
    row.className = "student-row";
    row.style.flexDirection = "column";
    row.style.alignItems = "stretch";
    row.style.gap = "10px";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.alignItems = "center";

    const label = document.createElement("div");
    label.style.fontWeight = "700";
    label.textContent = student.name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = t("remove");
    removeBtn.addEventListener("click", async () => {
      try {
        await deleteStudentDB(student.id);
        renderAll();
      } catch (e) {
        alert(e?.message || String(e));
      }
    });

    top.appendChild(label);
    top.appendChild(removeBtn);

    const details = document.createElement("div");
    details.style.fontSize = "14px";
    details.style.opacity = "0.95";
    details.style.lineHeight = "1.4";

    const studentLessons = lessons
      .filter((lsn) => lsn.student_id === student.id)
      .sort((a, b) => a.day_of_week - b.day_of_week || a.time.localeCompare(b.time));

    const studentTasks = tasks
      .filter((task) => task.student_id === student.id && isUpcomingOrOverdueNotSubmitted(task))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));

    let html = `<div><b>${t("weeklyLessons")}</b><br>`;
    html += studentLessons.length
      ? studentLessons.map((lsn) => `• ${dowLabel(lsn.day_of_week)} ${lsn.time}`).join("<br>")
      : t("none");
    html += `</div>`;

    html += `<div style="margin-top:10px;"><b>${t("upcomingTasks")}</b><br>`;
    html += studentTasks.length ? "" : t("none");
    html += `</div>`;

    details.innerHTML = html;

    if (studentTasks.length) {
      const list = document.createElement("div");
      list.style.marginTop = "6px";
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "8px";

      studentTasks.forEach((task) => {
        const taskRow = document.createElement("div");
        taskRow.style.display = "flex";
        taskRow.style.justifyContent = "space-between";
        taskRow.style.gap = "10px";
        taskRow.style.alignItems = "center";

        const left = document.createElement("div");
        const badge = isOverdue(task)
          ? `⚠️ ${t("overdue")}`
          : isDueToday(task)
            ? `⏰ ${t("dueToday")}`
            : "⬜";
        left.textContent = `${badge} (${task.due_date}) ${task.text}`;

        const btn = document.createElement("button");
        btn.textContent = t("markSubmitted");
        btn.addEventListener("click", async () => {
          try {
            await toggleTaskSubmittedDB(task.id);
            renderAll();
          } catch (e) {
            alert(e?.message || String(e));
          }
        });

        taskRow.appendChild(left);
        taskRow.appendChild(btn);
        list.appendChild(taskRow);
      });

      details.appendChild(list);
    }

    row.appendChild(top);
    row.appendChild(details);
    container.appendChild(row);
  });
}

// --------------------
// UI EVENTS
// --------------------
function setupTabs() {
  const navButtons = document.querySelectorAll(".nav-item");
  const tabs = document.querySelectorAll(".tab");

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      navButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      tabs.forEach((tab) => tab.classList.remove("active"));
      const target = document.getElementById(button.dataset.tab);
      if (target) target.classList.add("active");
    });
  });
}

// --------------------
// INIT
// --------------------
document.addEventListener("DOMContentLoaded", () => {
  if (!requireConfig() || !supabaseClient) return;

  // language
  document.querySelectorAll(".lang-btn[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
  });

  // auth buttons
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("signupBtn").addEventListener("click", signup);
  document.getElementById("logoutBtn").addEventListener("click", logout);

  // tabs
  setupTabs();

  // month controls
  document.getElementById("prevMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  // add student (HTML IDs: student-name, addStudentBtn)
  document.getElementById("addStudentBtn").addEventListener("click", async () => {
    try {
      const input = document.getElementById("student-name");
      const name = input.value.trim();
      if (!name) return alert("Please enter a student name");
      await addStudentDB(name);
      input.value = "";
      renderAll();
      alert("Student added!");
    } catch (e) {
      alert(e?.message || String(e));
    }
  });

  // add task (HTML IDs: task-student-select, task-text, task-date, addTaskBtn)
  document.getElementById("addTaskBtn").addEventListener("click", async () => {
    try {
      const studentId = document.getElementById("task-student-select").value;
      const text = document.getElementById("task-text").value.trim();
      const dueDate = document.getElementById("task-date").value;

      if (!studentId || !text || !dueDate) return alert("Please fill in all fields");
      await addTaskDB(studentId, text, dueDate);

      document.getElementById("task-text").value = "";
      document.getElementById("task-date").value = "";

      renderAll();
      alert("Task added!");
    } catch (e) {
      alert(e?.message || String(e));
    }
  });

  // add lesson (HTML IDs: lesson-student, lesson-day, lesson-time, addLessonBtn)
  document.getElementById("addLessonBtn").addEventListener("click", async () => {
    try {
      const studentId = document.getElementById("lesson-student").value;
      const dayOfWeek = Number(document.getElementById("lesson-day").value);
      const time = document.getElementById("lesson-time").value;

      if (!studentId || !time) return alert("Please choose student and time");
      await addLessonDB(studentId, dayOfWeek, time);

      document.getElementById("lesson-time").value = "";
      renderAll();
      alert("Lesson added!");
    } catch (e) {
      alert(e?.message || String(e));
    }
  });

  // react to auth changes
  supabaseClient.auth.onAuthStateChange(() => refreshAuthUI());

  // initial
  setLanguage("en");
  refreshAuthUI();
});
