// --------------------
// supabaseClient CONFIG
// --------------------
const SUPABASE_URL = "https://hsrwgfzsqpaldbuevokm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcndnZnpzcXBhbGRidWV2b2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTQwODcsImV4cCI6MjA4NTkzMDA4N30.zP-LsXIz3mEzipmAU9pV6RcmIQM2SU5AkLWIqgn3Xms";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// If env vars are missing, show a helpful message instead of a blank page
function requireConfig() {
  const msg = document.getElementById("authMsg");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    msg.textContent =
      "Missing SUPABASE_URL / SUPABASE_ANON_KEY. Add them in Render → Environment and redeploy.";
    return false;
  }
  return true;
}

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

  renderStudents();
}

// --------------------
// STATE (loaded from DB)
// --------------------
// students: {id, user_id, name}
// lessons:  {id, user_id, student_id, day_of_week, time}
// tasks:    {id, user_id, student_id, text, due_date, submitted}
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
// AUTH UI
// --------------------
async function refreshAuthUI() {
  const authScreen = document.getElementById("authScreen");
  const appRoot = document.getElementById("appRoot");
  const msg = document.getElementById("authMsg");

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
    msg.textContent = e?.message || String(e);
  }
}

async function login() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const msg = document.getElementById("authMsg");
  msg.textContent = "";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) msg.textContent = error.message;
}

async function signup() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const msg = document.getElementById("authMsg");
  msg.textContent = "";

  const { error } = await supabaseClient.auth.signUp({ email, password });
  msg.textContent = error ? error.message : "Account created. Check email if confirmation is enabled.";
}

async function logout() {
  await supabaseClient.auth.signOut();
}

// --------------------
// DB LOAD
// --------------------
async function loadAllData() {
  // Students
  const { data: s, error: e1 } = await supabaseClient
    .from("students")
    .select("*")
    .order("created_at", { ascending: true });

  if (e1) throw e1;
  students = s ?? [];

  // Lessons
  const { data: l, error: e2 } = await supabaseClient
    .from("lessons")
    .select("*")
    .order("time", { ascending: true });

  if (e2) throw e2;
  lessons = l ?? [];

  // Tasks
  const { data: tsk, error: e3 } = await supabaseClient
    .from("tasks")
    .select("*")
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
  const { error } = await supabaseClient.from("students").delete().eq("id", studentId);
  if (error) throw error;

  // Local cleanup (DB should cascade if you set FK cascade)
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
    p.textContent = t("noStude
