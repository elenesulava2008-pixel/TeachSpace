// --------------------
// SUPABASE CONFIG (from /config.js)
// --------------------
const SUPABASE_URL = window.__ENV?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.__ENV?.SUPABASE_ANON_KEY;

function showAuthMessage(text) {
  const msg = document.getElementById("authMsg");
  if (msg) msg.textContent = text || "";
}

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showAuthMessage(
      "Missing SUPABASE_URL / SUPABASE_ANON_KEY. Add them in Render → Environment and redeploy."
    );
    return false;
  }
  if (!window.supabase) {
    showAuthMessage("Supabase library not loaded. Check script order in index.html.");
    return false;
  }
  return true;
}

let supabaseClient = null;

// --------------------
// TRANSLATIONS (teacher wording)
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
    dueToday: "DUE TODAY"
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
    dueToday: "HEUTE FÄLLIG"
  }
};

let currentLang = "en";
function t(key) {
  return translations[currentLang]?.[key] ?? key;
}

function setLanguage(lang) {
  currentLang = lang;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    el.placeholder = t(key);
  });

  renderStudents(); // refresh labels + buttons
}

// --------------------
// STATE (loaded from DB)
// --------------------
// students: {id, user_id, name, created_at}
// lessons:  {id, user_id, student_id, day_of_week, time, created_at}
// tasks:    {id, user_id, student_id, text, due_date, submitted, created_at}
let students = [];
let lessons = [];
let tasks = [];
let currentDate = new Date();

// --------------------
// HELPERS
// --------------------
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
  return students.find(s => s.id === id)?.name ?? "Unknown";
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

  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

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
    showAuthMessage(e?.message || String(e));
  }
}

async function login() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  showAuthMessage("");

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) showAuthMessage(error.message);
}

async function signup() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  showAuthMessage("");

  const { error } = await supabaseClient.auth.signUp({ email, password });
  showAuthMessage(error ? error.message : "Account created. Check email if confirmation is enabled.");
}

async function logout() {
  await supabaseClient.auth.signOut();
}

// --------------------
// DB LOAD (filter by user)
// --------------------
async function loadAllData() {
  const { data: { user }, error: eU } = await supabaseClient.auth.getUser();
  if (eU) throw eU;
  if (!user) return;

  const { data: s, error: e1 } = await supabaseClient
    .from("students")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (e1) throw e1;
  students = s ?? [];

  const { data: l, error: e2 } = await supabaseClient
    .from("lessons")
    .select("*")
    .eq("user_id", user.id)
    .order("time", { ascending: true });
  if (e2) throw e2;
  lessons = l ?? [];

  const { data: tsk, error: e3 } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });
  if (e3) throw e3;
  tasks = tsk ?? [];
}

// --------------------
// DB MUTATIONS
// --------------------
async function addStudentDB(name) {
  const { data: { user }, error: eU } = await supabaseClient.auth.getUser();
  if (eU) throw eU;

  const { data, error } = await supabaseClient
    .from("students")
    .insert([{ user_id: user.id, name }])
    .select()
    .single();

  if (error) throw error;
  students.push(data);
}

async function deleteStudentDB(studentId) {
  // delete child rows first (safe even if FK cascade exists)
  await supabaseClient.from("tasks").delete().eq("student_id", studentId);
  await supabaseClient.from("lessons").delete().eq("student_id", studentId);

  const { error } = await supabaseClient.from("students").delete().eq("id", studentId);
  if (error) throw error;

  students = students.filter(s => s.id !== studentId);
  lessons = lessons.filter(l => l.student_id !== studentId);
  tasks = tasks.filter(t => t.student_id !== studentId);
}

async function addLessonDB(studentId, dayOfWeek, time) {
  const { data: { user }, error: eU } = await supabaseClient.auth.getUser();
  if (eU) throw eU;

  const { data, error } = await supabaseClient
    .from("lessons")
    .insert([{ user_id: user.id, student_id: studentId, day_of_week: dayOfWeek, time }])
    .select()
    .single();

  if (error) throw error;
  lessons.push(data);
}

async function addTaskDB(studentId, text, dueDate) {
  const { data: { user }, error: eU } = await supabaseClient.auth.getUser();
  if (eU) throw eU;

  const { data, error } = await supabaseClient
    .from("tasks")
    .insert([{ user_id: user.id, student_id: studentId, text, due_date: dueDate, submitted: false }])
    .select()
    .single();

  if (error) throw error;
  tasks.push(data);
}

async function toggleTaskSubmittedDB(taskId) {
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;

  const newValue = !tasks[idx].submitted;

  const { error } = await supabaseClient
    .from("tasks")
    .update({ submitted: newValue })
    .eq("id", taskId);

  if (error) throw error;
  tasks[idx].submitted = newValue;
}

// --------------------
// RENDERING
// --------------------
function renderAll() {
  setLanguage(currentLang);
  renderStudentDropdowns();
  renderStudents();
  renderCalendar();
}

function renderStudentDropdowns() {
  const taskSelect = document.getElementById("task-student-select");
  const lessonSelect = document.getElementById("lesson-student");

  [taskSelect, lessonSelect].forEach(select => {
    if (!select) return;
    select.innerHTML = "";

    if (students.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "—";
      select.appendChild(opt);
      return;
    }

    students.forEach(s => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = s.name;
      select.appendChild(option);
    });
  });
}

function renderCalendar() {
  const calendarGrid = document.querySelector(".calendar-grid");
  const calendarMonth = document.getElementById("calendarMonth");
  if (!calendarGrid || !calendarMonth) return;

  // remove only generated .day cells
  calendarGrid.querySelectorAll(".day").forEach(day => day.remove());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  calendarMonth.textContent = `${currentDate.toLocaleString("en-US", { month: "long" })} ${year}`;

  let firstDay = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
  firstDay = firstDay === 0 ? 6 : firstDay - 1;    // convert to Mon-based

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

    const dateString =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const jsDow = new Date(year, month, day).getDay();

    const dayTasks = tasks.filter(tk => tk.due_date === dateString);
    if (dayTasks.length > 0) dayDiv.classList.add("has-homework");

    const dayLessons = lessons.filter(lsn => lsn.day_of_week === jsDow);
    if (dayLessons.length > 0) dayDiv.classList.add("has-lesson");

    dayDiv.addEventListener("click", () => {
      const listLessons = lessons
        .filter(lsn => lsn.day_of_week === jsDow)
        .sort((a, b) => a.time.localeCompare(b.time));

      const listTasks = tasks
        .filter(tk => tk.due_date === dateString)
        .sort((a, b) => studentNameById(a.student_id).localeCompare(studentNameById(b.student_id)));

      let message = "";

      if (listLessons.length > 0) {
        message += `${t("lessonsTitle")}\n`;
        listLessons.forEach(lsn => {
          message += `🕒 ${lsn.time} — 👤 ${studentNameById(lsn.student_id)}\n`;
        });
        message += "\n";
      }

      if (listTasks.length > 0) {
        message += `${t("tasksTitle")}\n\n`;
        listTasks.forEach(task => {
          const status = task.submitted
            ? `✅ ${t("submitted")}`
            : isOverdue(task)
              ? `⚠️ ${t("overdue")}`
              : isDueToday(task)
                ? `⏰ ${t("dueToday")}`
                : "⬜";

          message += `👤 ${studentNameById(task.student_id)}\n📝 ${task.text}\n📅 ${task.due_date} — ${status}\n\n`;
        });
      }

      if (!message) message = t("noItemsForDay");
      alert(message);
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

  students.forEach(student => {
    const card = document.createElement("div");
    card.className = "student-row";
    card.style.flexDirection = "column";
    card.style.alignItems = "stretch";
    card.style.gap = "10px";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.alignItems = "center";

    const nameEl = document.createElement("div");
    nameEl.style.fontWeight = "700";
    nameEl.textContent = student.name;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = t("remove");
    removeBtn.addEventListener("click", async () => {
      try {
        await deleteStudentDB(student.id);
        renderStudentDropdowns();
        renderCalendar();
        renderStudents();
      } catch (e) {
        alert(e?.message || String(e));
      }
    });

    top.appendChild(nameEl);
    top.appendChild(removeBtn);

    const details = document.createElement("div");
    details.style.fontSize = "14px";
    details.style.lineHeight = "1.5";
    details.style.opacity = "0.95";

    // weekly lessons for that student
    const studentLessons = lessons
      .filter(l => l.student_id === student.id)
      .sort((a, b) => a.day_of_week - b.day_of_week || a.time.localeCompare(b.time));

    // upcoming/overdue tasks not submitted
    const studentTasks = tasks
      .filter(tk => tk.student_id === student.id && isUpcomingOrOverdueNotSubmitted(tk))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));

    // lessons text
    let html = `<div><b>${t("weeklyLessons")}</b><br>`;
    if (studentLessons.length === 0) {
      html += `${t("none")}</div>`;
    } else {
      studentLessons.forEach(lsn => {
        html += `• ${dowLabel(lsn.day_of_week)} ${lsn.time}<br>`;
      });
      html += `</div>`;
    }

    // tasks title
    html += `<div style="margin-top:10px;"><b>${t("upcomingTasks")}</b><br>`;
    if (studentTasks.length === 0) {
      html += `${t("none")}</div>`;
      details.innerHTML = html;
    } else {
      html += `</div>`;
      details.innerHTML = html;

      const taskList = document.createElement("div");
      taskList.style.display = "flex";
      taskList.style.flexDirection = "column";
      taskList.style.gap = "8px";
      taskList.style.marginTop = "6px";

      studentTasks.forEach(task => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.style.gap = "10px";

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
            renderCalendar();
            renderStudents();
          } catch (e) {
            alert(e?.message || String(e));
          }
        });

        row.appendChild(left);
        row.appendChild(btn);
        taskList.appendChild(row);
      });

      details.appendChild(taskList);
    }

    card.appendChild(top);
    card.appendChild(details);
    container.appendChild(card);
  });
}

// --------------------
// INIT + EVENTS
// --------------------
document.addEventListener("DOMContentLoaded", () => {
  // create supabase client only when everything is ready
  if (!requireConfig()) return;
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // language buttons
  document.querySelectorAll(".lang-btn").forEach(btn => {
    const lang = btn.dataset.lang;
    if (lang) btn.addEventListener("click", () => setLanguage(lang));
  });

  // auth buttons
  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn) loginBtn.addEventListener("click", login);
  if (signupBtn) signupBtn.addEventListener("click", signup);
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  // calendar nav
  const prevBtn = document.getElementById("prevMonth");
  const nextBtn = document.getElementById("nextMonth");
  if (prevBtn) prevBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
  if (nextBtn) nextBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

  // add student
  const addStudentBtn = document.getElementById("addStudentBtn");
  if (addStudentBtn) {
    addStudentBtn.addEventListener("click", async () => {
      const input = document.getElementById("student-name");
      const name = input.value.trim();
      if (!name) return alert("Please enter a student name");

      try {
        await addStudentDB(name);
        input.value = "";
        renderStudentDropdowns();
        renderCalendar();
        renderStudents();
      } catch (e) {
        alert(e?.message || String(e));
      }
    });
  }

  // add task
  const addTaskBtn = document.getElementById("addTaskBtn");
  if (addTaskBtn) {
    addTaskBtn.addEventListener("click", async () => {
      const studentId = document.getElementById("task-student-select").value;
      const text = document.getElementById("task-text").value.trim();
      const dueDate = document.getElementById("task-date").value;

      if (!studentId || !text || !dueDate) return alert("Please fill in all fields");

      try {
        await addTaskDB(studentId, text, dueDate);
        document.getElementById("task-text").value = "";
        document.getElementById("task-date").value = "";
        renderCalendar();
        renderStudents();
      } catch (e) {
        alert(e?.message || String(e));
      }
    });
  }

  // add lesson
  const addLessonBtn = document.getElementById("addLessonBtn");
  if (addLessonBtn) {
    addLessonBtn.addEventListener("click", async () => {
      const studentId = document.getElementById("lesson-student").value;
      const dayOfWeek = Number(document.getElementById("lesson-day").value);
      const time = document.getElementById("lesson-time").value;

      if (!studentId || !time) return alert("Please choose student and time");

      try {
        await addLessonDB(studentId, dayOfWeek, time);
        document.getElementById("lesson-time").value = "";
        renderCalendar();
        renderStudents();
      } catch (e) {
        alert(e?.message || String(e));
      }
    });
  }

  // tab switching
  const navButtons = document.querySelectorAll(".nav-item");
  const tabs = document.querySelectorAll(".tab");

  navButtons.forEach(button => {
    button.addEventListener("click", () => {
      navButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      tabs.forEach(tab => tab.classList.remove("active"));
      const target = document.getElementById(button.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  // keep UI updated on auth changes
  supabaseClient.auth.onAuthStateChange(() => refreshAuthUI());

  // initial
  setLanguage("en");
  refreshAuthUI();
});
