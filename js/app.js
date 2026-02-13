(() => {
  // --------------------
  // CONFIG + SUPABASE
  // --------------------
  const SUPABASE_URL = window.__ENV?.SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__ENV?.SUPABASE_ANON_KEY;

  function requireConfig() {
    const msg = document.getElementById("authMsg");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      msg.textContent =
        "Missing SUPABASE_URL / SUPABASE_ANON_KEY. Add them in Render → Environment and redeploy.";
      return false;
    }
    return true;
  }

  if (!requireConfig()) return;

  if (!window.supabase) {
    document.getElementById("authMsg").textContent =
      "Supabase library failed to load. Check the CDN script tag.";
    return;
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
      markIncomplete: "Mark incomplete",
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
      markIncomplete: "Als offen markieren",
      overdue: "ÜBERFÄLLIG",
      dueToday: "HEUTE FÄLLIG"
    }
  };

  let currentLang = "en";
  const t = (key) => translations[currentLang]?.[key] ?? key;

  function setLanguage(lang) {
    currentLang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });

    renderStudents();
  }

  // --------------------
  // STATE
  // --------------------
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

  const isOverdue = (task) => !task.submitted && parseDate(task.due_date) < startOfToday();
  const isDueToday = (task) => parseDate(task.due_date).getTime() === startOfToday().getTime();

  const isUpcomingOrOverdueNotSubmitted = (task) => {
    if (task.submitted) return false;
    return parseDate(task.due_date) >= startOfToday() || isOverdue(task);
  };

  const studentNameById = (id) => students.find((s) => s.id === id)?.name ?? "Unknown";

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
    await refreshAuthUI();
  }

  async function signup() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const msg = document.getElementById("authMsg");
    msg.textContent = "";

    const { error } = await supabaseClient.auth.signUp({ email, password });
    msg.textContent = error ? error.message : "Account created. You can log in now.";
  }

  async function logout() {
    await supabaseClient.auth.signOut();
    await refreshAuthUI();
  }

  // --------------------
  // DB LOAD
  // --------------------
  async function loadAllData() {
    const { data: s, error: e1 } = await supabaseClient
      .from("students")
      .select("*")
      .order("created_at", { ascending: true });
    if (e1) throw e1;
    students = s ?? [];

    const { data: l, error: e2 } = await supabaseClient
      .from("lessons")
      .select("*")
      .order("time", { ascending: true });
    if (e2) throw e2;
    lessons = l ?? [];

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

    students = students.filter((s) => s.id !== studentId);
    lessons = lessons.filter((l) => l.student_id !== studentId);
    tasks = tasks.filter((t) => t.student_id !== studentId);
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
    const idx = tasks.findIndex((t) => t.id === taskId);
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

    calendarGrid.querySelectorAll(".day").forEach((d) => d.remove());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    calendarMonth.textContent = `${currentDate.toLocaleString("en-US", { month: "long" })} ${year}`;

    let firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    firstDay = firstDay === 0 ? 6 : firstDay - 1;    // Mon-based

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

      const dayTasks = tasks.filter((tk) => tk.due_date === dateString);
      if (dayTasks.length > 0) dayDiv.classList.add("has-homework");

      const dayLessons = lessons.filter((lsn) => lsn.day_of_week === jsDow);
      if (dayLessons.length > 0) dayDiv.classList.add("has-lesson");

      dayDiv.addEventListener("click", () => {
        const listLessons = lessons
          .filter((lsn) => lsn.day_of_week === jsDow)
          .sort((a, b) => a.time.localeCompare(b.time));

        const listTasks = tasks
          .filter((tk) => tk.due_date === dateString)
          .sort((a, b) => studentNameById(a.student_id).localeCompare(studentNameById(b.student_id)));

        let message = "";

        if (listLessons.length > 0) {
          message += `${t("lessonsTitle")}\n`;
          listLessons.forEach((lsn) => {
            message += `🕒 ${lsn.time} — 👤 ${studentNameById(lsn.student_id)}\n`;
          });
          message += "\n";
        }

        if (listTasks.length > 0) {
          message += `${t("tasksTitle")}\n\n`;
          listTasks.forEach((task) => {
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

        alert(message || t("noItemsForDay"));
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

    students.forEach((s) => {
      const box = document.createElement("div");
      box.className = "student-row";
      box.style.flexDirection = "column";
      box.style.alignItems = "stretch";
      box.style.gap = "10px";

      const top = document.createElement("div");
      top.style.display = "flex";
      top.style.justifyContent = "space-between";
      top.style.alignItems = "center";

      const name = document.createElement("div");
      name.style.fontWeight = "700";
      name.textContent = s.name;

      const removeBtn = document.createElement("button");
      removeBtn.textContent = t("remove");
      removeBtn.addEventListener("click", async () => {
        await deleteStudentDB(s.id);
        renderAll();
      });

      top.appendChild(name);
      top.appendChild(removeBtn);

      // lessons
      const studentLessons = lessons
        .filter((l) => l.student_id === s.id)
        .sort((a, b) => a.day_of_week - b.day_of_week || a.time.localeCompare(b.time));

      // tasks (upcoming/overdue not submitted)
      const studentTasks = tasks
        .filter((t2) => t2.student_id === s.id && isUpcomingOrOverdueNotSubmitted(t2))
        .sort((a, b) => a.due_date.localeCompare(b.due_date));

      const details = document.createElement("div");
      details.style.fontSize = "14px";
      details.style.lineHeight = "1.4";
      details.style.opacity = "0.95";

      details.innerHTML = `
        <div><b>${t("weeklyLessons")}</b> ${studentLessons.length ? "" : t("none")}</div>
        ${studentLessons.map(l => `• ${DOW[l.day_of_week]} ${l.time}`).join("<br>")}
        <div style="margin-top:8px;"><b>${t("upcomingTasks")}</b> ${studentTasks.length ? "" : t("none")}</div>
      `;

      if (studentTasks.length) {
        const list = document.createElement("div");
        list.style.marginTop = "6px";
        list.style.display = "flex";
        list.style.flexDirection = "column";
        list.style.gap = "8px";

        studentTasks.forEach((task) => {
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.justifyContent = "space-between";
          row.style.gap = "10px";
          row.style.alignItems = "center";

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

          row.appendChild(left);
          row.appendChild(btn);
          list.appendChild(row);
        });

        details.appendChild(list);
      }

      box.appendChild(top);
      box.appendChild(details);
      container.appendChild(box);
    });
  }

  // --------------------
  // EVENT WIRES
  // --------------------
  document.addEventListener("DOMContentLoaded", async () => {
    // language
    document.querySelectorAll(".lang-btn[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
    });

    // auth buttons
    document.getElementById("loginBtn")?.addEventListener("click", login);
    document.getElementById("signupBtn")?.addEventListener("click", signup);
    document.getElementById("logoutBtn")?.addEventListener("click", logout);

    // tabs
    const navButtons = document.querySelectorAll(".nav-item");
    const tabs = document.querySelectorAll(".tab");
    navButtons.forEach((button) => {
      button.addEventListener("click", () => {
        navButtons.forEach((b) => b.classList.remove("active"));
        button.classList.add("active");

        tabs.forEach((t2) => t2.classList.remove("active"));
        document.getElementById(button.dataset.tab)?.classList.add("active");
      });
    });

    // calendar navigation
    document.getElementById("prevMonth")?.addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });
    document.getElementById("nextMonth")?.addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });

    // add student
    document.getElementById("addStudentBtn")?.addEventListener("click", async () => {
      const input = document.getElementById("student-name");
      const name = input.value.trim();
      if (!name) return alert("Please enter a student name");

      await addStudentDB(name);
      input.value = "";
      renderAll();
      alert("Student added!");
    });

    // add task
    document.getElementById("addTaskBtn")?.addEventListener("click", async () => {
      const studentId = document.getElementById("task-student-select").value;
      const text = document.getElementById("task-text").value.trim();
      const dueDate = document.getElementById("task-date").value;

      if (!studentId || !text || !dueDate) return alert("Please fill in all fields");

      await addTaskDB(studentId, text, dueDate);
      document.getElementById("task-text").value = "";
      document.getElementById("task-date").value = "";
      renderAll();
      alert("Task added!");
    });

    // add lesson
    document.getElementById("addLessonBtn")?.addEventListener("click", async () => {
      const studentId = document.getElementById("lesson-student").value;
      const dayOfWeek = Number(document.getElementById("lesson-day").value);
      const time = document.getElementById("lesson-time").value;

      if (!studentId || !time) return alert("Please choose student and time");

      await addLessonDB(studentId, dayOfWeek, time);
      document.getElementById("lesson-time").value = "";
      renderAll();
      alert("Lesson added!");
    });

    // listen auth changes (login/logout)
    supabaseClient.auth.onAuthStateChange(() => {
      refreshAuthUI();
    });

    // initial
    setLanguage("en");
    await refreshAuthUI();
  });
})();
