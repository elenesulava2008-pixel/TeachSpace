// --------------------
// supabaseClient CONFIG
// --------------------
const SUPABASE_URL = "https://hsrwgfzsqpaldbuevokm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcndnZnpzcXBhbGRidWV2b2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTQwODcsImV4cCI6MjA4NTkzMDA4N30.zP-LsXIz3mEzipmAU9pV6RcmIQM2SU5AkLWIqgn3Xms";
const supabaseClientClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// --------------------
// TRANSLATIONS
// --------------------
const translations = {
  en: {
    nav: "Navigation",
    calendar: "Calendar",
    addStudent: "Add Student",
    addHomework: "Add Homework",
    students: "Students",
    schedule: "Schedule",
    monthlyCalendar: "Monthly Calendar",
    addStudentTitle: "Add New Student",
    assignHomework: "Assign Homework",
    scheduleTitle: "Add Lesson",
    studentName: "Student Name:",
    homework: "Homework:",
    dueDate: "Due Date:",
    dayOfWeek: "Day of Week:",
    time: "Time:",
    addStudentBtn: "Add Student",
    addHomeworkBtn: "Add Homework",
    addLessonBtn: "Add Lesson",
    studentPlaceholder: "Enter student name",
    homeworkPlaceholder: "Enter homework details",
    prev: "← Previous",
    next: "Next →",
    noStudents: "No students added yet.",
    remove: "Remove",
    noHomeworkOrLessons: "No lessons or tasks for this day.",
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
    addHomework: "Hausaufgabe hinzufügen",
    students: "Schüler",
    schedule: "Stundenplan",
    monthlyCalendar: "Monatskalender",
    addStudentTitle: "Neuen Schüler hinzufügen",
    assignHomework: "Hausaufgabe zuweisen",
    scheduleTitle: "Unterricht hinzufügen",
    studentName: "Name des Schülers:",
    homework: "Hausaufgabe:",
    dueDate: "Abgabedatum:",
    dayOfWeek: "Wochentag:",
    time: "Uhrzeit:",
    addStudentBtn: "Schüler hinzufügen",
    addHomeworkBtn: "Hausaufgabe hinzufügen",
    addLessonBtn: "Unterricht hinzufügen",
    studentPlaceholder: "Name eingeben",
    homeworkPlaceholder: "Hausaufgabe eingeben",
    prev: "← Zurück",
    next: "Weiter →",
    noStudents: "Noch keine Schüler hinzugefügt.",
    remove: "Entfernen",
    noHomeworkOrLessons: "Keine Aufgaben oder Unterricht an diesem Tag.",
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

  if (typeof window.renderStudents === "function") window.renderStudents();
}

// --------------------
// IN-MEMORY STATE (from DB)
// --------------------
// students: {id, name}
// lessons: {id, student_id, day_of_week, time}
// tasks:   {id, student_id, text, due_date, submitted}
let students = [];
let lessons = [];
let tasks = [];

let currentDate = new Date();

// --------------------
// HELPERS
// --------------------
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dowLabel(dow) {
  return DOW[dow] ?? "";
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(dateStr) {
  // dateStr is YYYY-MM-DD
  return new Date(`${dateStr}T00:00:00`);
}

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

// --------------------
// AUTH + BOOTSTRAP
// --------------------
async function refreshAuthUI() {
  const { data: { session } } = await supabaseClientClient.auth.getSession();

  const authScreen = document.getElementById("authScreen");
  const appRoot = document.getElementById("appRoot");

  if (!session) {
    authScreen.style.display = "block";
    appRoot.style.display = "none";
    return;
  }

  authScreen.style.display = "none";
  appRoot.style.display = "flex";

  await loadAllData();
  renderAll();
}

async function login() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const msg = document.getElementById("authMsg");

  const { error } = await supabaseClientClient.auth.signInWithPassword({ email, password });
  msg.textContent = error ? error.message : "";
}

async function signup() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const msg = document.getElementById("authMsg");

  const { error } = await supabaseClientClient.auth.signUp({ email, password });
  msg.textContent = error ? error.message : "Check your email to confirm (if enabled).";
}

async function logout() {
  await supabaseClientClient.auth.signOut();
}

// --------------------
// DB LOAD
// --------------------
async function loadAllData() {
  const { data: s, error: e1 } = await supabaseClientClient.from("students").select("*").order("created_at");
  if (e1) throw e1;
  students = s ?? [];

  const { data: l, error: e2 } = await supabaseClientClient.from("lessons").select("*").order("time");
  if (e2) throw e2;
  lessons = l ?? [];

  const { data: tsk, error: e3 } = await supabaseClientClient.from("tasks").select("*").order("due_date");
  if (e3) throw e3;
  tasks = tsk ?? [];
}

// --------------------
// DB MUTATIONS
// --------------------
async function addStudentDB(name) {
  const { data: { user } } = await supabaseClientClient.auth.getUser();

  const { data, error } = await supabaseClientClient
    .from("students")
    .insert([{ user_id: user.id, name }])
    .select()
    .single();

  if (error) throw error;
  students.push(data);
}

async function deleteStudentDB(studentId) {
  // cascades to tasks/lessons via FK on delete cascade
  const { error } = await supabaseClientClient.from("students").delete().eq("id", studentId);
  if (error) throw error;

  students = students.filter(s => s.id !== studentId);
  lessons = lessons.filter(l => l.student_id !== studentId);
  tasks = tasks.filter(t => t.student_id !== studentId);
}

async function addLessonDB(studentId, dayOfWeek, time) {
  const { data: { user } } = await supabaseClientClient.auth.getUser();

  const { data, error } = await supabaseClientClient
    .from("lessons")
    .insert([{ user_id: user.id, student_id: studentId, day_of_week: dayOfWeek, time }])
    .select()
    .single();

  if (error) throw error;
  lessons.push(data);
}

async function addTaskDB(studentId, text, dueDate) {
  const { data: { user } } = await supabaseClient.auth.getUser();

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
  renderStudentDropdown();
  renderLessonStudentDropdown();
  renderStudents();
  renderCalendar();
}

function renderStudentDropdown() {
  const select = document.getElementById("hw-student-select");
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
}

function renderLessonStudentDropdown() {
  const select = document.getElementById("lesson-student");
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
}

function renderCalendar() {
  const calendarGrid = document.querySelector(".calendar-grid");
  const calendarMonth = document.getElementById("calendarMonth");

  calendarGrid.querySelectorAll(".day").forEach(day => day.remove());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("en-US", { month: "long" });
  calendarMonth.textContent = `${monthName} ${year}`;

  let firstDay = new Date(year, month, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;

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
      const listTasks = tasks
        .filter(tk => tk.due_date === dateString)
        .sort((a, b) => studentNameById(a.student_id).localeCompare(studentNameById(b.student_id)));

      const listLessons = lessons
        .filter(lsn => lsn.day_of_week === jsDow)
        .sort((a, b) => a.time.localeCompare(b.time));

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
                : "⬜ Incomplete";

          message += `👤 ${studentNameById(task.student_id)}\n📝 ${task.text}\n📅 ${task.due_date} — ${status}\n\n`;
        });
      }

      if (!message) message = t("noHomeworkOrLessons");
      alert(message);
    });

    calendarGrid.appendChild(dayDiv);
  }
}

function renderStudents() {
  const container = document.getElementById("studentsList");
  container.innerHTML = "";

  if (students.length === 0) {
    const p = document.createElement("p");
    p.textContent = t("noStudents");
    container.appendChild(p);
    return;
  }

  students.forEach(student => {
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
      await deleteStudentDB(student.id);
      renderAll();
    });

    top.appendChild(label);
    top.appendChild(removeBtn);

    const details = document.createElement("div");
    details.style.fontSize = "14px";
    details.style.opacity = "0.95";
    details.style.lineHeight = "1.4";

    const studentLessons = lessons
      .filter(lsn => lsn.student_id === student.id)
      .sort((a, b) => a.day_of_week - b.day_of_week || a.time.localeCompare(b.time));

    const studentTasks = tasks
      .filter(task => task.student_id === student.id && isUpcomingOrOverdueNotSubmitted(task))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));

    let html = `<div><b>${t("weeklyLessons")}</b> `;
    if (studentLessons.length === 0) {
      html += `${t("none")}</div>`;
    } else {
      html += "<br>";
      studentLessons.forEach(lsn => {
        html += `• ${dowLabel(lsn.day_of_week)} ${lsn.time}<br>`;
      });
      html += "</div>";
    }

    html += `<div style="margin-top:8px;"><b>${t("upcomingTasks")}</b> `;
    if (studentTasks.length === 0) {
      html += `${t("none")}</div>`;
    } else {
      html += "</div>";
    }

    details.innerHTML = html;

    if (studentTasks.length > 0) {
      const taskList = document.createElement("div");
      taskList.style.marginTop = "6px";
      taskList.style.display = "flex";
      taskList.style.flexDirection = "column";
      taskList.style.gap = "8px";

      studentTasks.forEach(task => {
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
          await toggleTaskSubmittedDB(task.id);
          renderAll();
        });

        taskRow.appendChild(left);
        taskRow.appendChild(btn);
        taskList.appendChild(taskRow);
      });

      details.appendChild(taskList);
    }

    row.appendChild(top);
    row.appendChild(details);
    container.appendChild(row);
  });
}

// Allow setLanguage to call this
window.renderStudents = renderStudents;

// --------------------
// EVENTS + INIT
// --------------------
document.addEventListener("DOMContentLoaded", () => {
  // language buttons
  document.querySelectorAll(".lang-btn[data-lang]").forEach(btn => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
  });

  // auth buttons
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("signupBtn").addEventListener("click", signup);
  document.getElementById("logoutBtn").addEventListener("click", logout);

  // tab switching
  const navButtons = document.querySelectorAll(".nav-item");
  const tabs = document.querySelectorAll(".tab");
  navButtons.forEach(button => {
    button.addEventListener("click", () => {
      navButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      tabs.forEach(tab => tab.classList.remove("active"));
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });

  // prev/next month
  document.getElementById("prevMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  // add student
  document.getElementById("addStudentBtn").addEventListener("click", async () => {
    const input = document.getElementById("student-name");
    const name = input.value.trim();
    if (!name) {
      alert("Please enter a student name");
      return;
    }
    await addStudentDB(name);
    input.value = "";
    renderAll();
    alert("Student added!");
  });

  // add task
  document.getElementById("addHomeworkBtn").addEventListener("click", async () => {
    const studentId = document.getElementById("hw-student-select").value;
    const text = document.getElementById("hw-text").value.trim();
    const dueDate = document.getElementById("hw-date").value;

    if (!studentId || !text || !dueDate) {
      alert("Please fill in all fields");
      return;
    }

    await addTaskDB(studentId, text, dueDate);

    document.getElementById("hw-text").value = "";
    document.getElementById("hw-date").value = "";

    renderAll();
    alert("Task added!");
  });

  // add lesson
  document.getElementById("addLessonBtn").addEventListener("click", async () => {
    const studentId = document.getElementById("lesson-student").value;
    const dayOfWeek = Number(document.getElementById("lesson-day").value);
    const time = document.getElementById("lesson-time").value;

    if (!studentId || !time) {
      alert("Please choose student and time");
      return;
    }

    await addLessonDB(studentId, dayOfWeek, time);
    renderAll();
    alert("Lesson added!");
  });

  // auth state changes
  supabaseClient.auth.onAuthStateChange(() => refreshAuthUI());
  refreshAuthUI();

  // default language
  setLanguage("en");
});
