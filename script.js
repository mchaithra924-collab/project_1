"use strict";

const STORAGE_KEY = "student-task-management-system.tasks.v1";
const ATTENDANCE_STORAGE_KEY = "student-task-management-system.attendance.v1";
const today = getLocalDateString(new Date());
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const dialog = document.querySelector("#task-dialog");
const form = document.querySelector("#task-form");
const titleInput = document.querySelector("#task-title");
const dueDateInput = document.querySelector("#task-due-date");
const toast = document.querySelector("#toast");

let tasks = loadTasks();
let attendance = loadAttendance();
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let activeFilter = "all";
let activeSubject = "all";
let searchTerm = "";
let editingTaskId = null;
let toastTimeout;

const filterDetails = {
  all: { title: "Your tasks", caption: "Everything you need to get done." },
  today: { title: "Today’s tasks", caption: "The things to focus on today." },
  upcoming: { title: "Coming up", caption: "A look at what’s next on your list." },
  completed: { title: "Completed tasks", caption: "Look at everything you’ve accomplished." },
};

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadTasks() {
  try {
    const storedTasks = localStorage.getItem(STORAGE_KEY);
    if (!storedTasks) return [];
    const parsedTasks = JSON.parse(storedTasks);
    if (!Array.isArray(parsedTasks)) throw new Error("Saved tasks are not a list.");
    return parsedTasks.filter((task) =>
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.subject === "string" &&
      typeof task.completed === "boolean"
    );
  } catch (error) {
    window.setTimeout(() => showToast("Saved tasks couldn’t be loaded. You can still add new tasks."), 0);
    console.error("Could not load saved tasks:", error);
    return [];
  }
}

function loadAttendance() {
  try {
    const storedAttendance = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (!storedAttendance) return {};
    const parsedAttendance = JSON.parse(storedAttendance);
    if (!parsedAttendance || typeof parsedAttendance !== "object" || Array.isArray(parsedAttendance)) {
      throw new Error("Saved attendance is not a date record.");
    }
    return Object.fromEntries(
      Object.entries(parsedAttendance).filter(([date, time]) =>
        isValidDateKey(date) && typeof time === "string"
      )
    );
  } catch (error) {
    window.setTimeout(() => showToast("Attendance history couldn’t be loaded."), 0);
    console.error("Could not load attendance:", error);
    return {};
  }
}

function isValidDateKey(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const date = new Date(`${dateString}T12:00:00`);
  return !Number.isNaN(date.getTime()) && getLocalDateString(date) === dateString;
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    showToast("Changes couldn’t be saved in this browser.");
    console.error("Could not save tasks:", error);
    return false;
  }
}

function saveAttendance() {
  try {
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(attendance));
    return true;
  } catch (error) {
    showToast("Attendance couldn’t be saved in this browser.");
    console.error("Could not save attendance:", error);
    return false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatDueDate(dateString) {
  if (!dateString) return "No due date";
  if (dateString === today) return "Today";
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function isOverdue(task) {
  return Boolean(task.dueDate && task.dueDate < today && !task.completed);
}

function getAttendanceStreak() {
  const hasCheckedInToday = Object.hasOwn(attendance, today);
  const cursor = new Date(`${today}T12:00:00`);
  if (!hasCheckedInToday) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (Object.hasOwn(attendance, getLocalDateString(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderAttendance() {
  const checkedInToday = Object.hasOwn(attendance, today);
  const now = new Date();
  document.querySelector("#checkin-date").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(now);

  const checkinButton = document.querySelector("#attendance-checkin-button");
  checkinButton.disabled = checkedInToday;
  checkinButton.innerHTML = checkedInToday
    ? '<span aria-hidden="true">✓</span> You’re checked in'
    : '<span aria-hidden="true">✓</span> Mark present';
  document.querySelector("#attendance-status-heading").textContent = checkedInToday
    ? "You showed up today!"
    : "Ready when you are?";
  document.querySelector("#attendance-status-copy").textContent = checkedInToday
    ? `Checked in at ${attendance[today]}. Come back tomorrow to keep your streak going.`
    : "Tap below to record that you showed up today.";
  document.querySelector("#attendance-streak").textContent = String(getAttendanceStreak());

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const daysElapsed = monthStart > currentMonthStart
    ? 0
    : monthStart.getTime() === currentMonthStart.getTime()
      ? now.getDate()
      : daysInMonth;
  const attendanceDays = Object.keys(attendance).filter((date) => {
    const day = new Date(`${date}T12:00:00`);
    return day.getFullYear() === calendarMonth.getFullYear() &&
      day.getMonth() === calendarMonth.getMonth() &&
      day.getDate() <= daysElapsed;
  }).length;
  const monthlyRate = daysElapsed ? Math.round((attendanceDays / daysElapsed) * 100) : 0;
  document.querySelector("#attendance-rate").textContent = `${monthlyRate}%`;
  document.querySelector("#calendar-summary").textContent = daysElapsed
    ? `${attendanceDays} of ${daysElapsed} days`
    : "Month ahead";
  document.querySelector("#calendar-month-label").textContent = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(calendarMonth);

  const calendar = document.querySelector("#attendance-calendar");
  const calendarCells = [];
  const firstWeekday = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  for (let blank = 0; blank < firstWeekday; blank += 1) {
    const spacer = document.createElement("span");
    spacer.className = "calendar-day is-empty";
    spacer.setAttribute("aria-hidden", "true");
    calendarCells.push(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = getLocalDateString(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    const isToday = date === today;
    const isPresent = Object.hasOwn(attendance, date);
    const isFuture = date > today;
    const cell = document.createElement("span");
    cell.className = `calendar-day${isToday ? " is-today" : ""}${isPresent ? " is-present" : ""}${isFuture ? " is-future" : ""}`;
    cell.textContent = String(day);
    cell.setAttribute("aria-label", `${new Intl.DateTimeFormat(undefined, { month: "long" }).format(calendarMonth)} ${day}${isPresent ? ", checked in" : isToday ? ", today" : ""}`);
    if (isPresent) cell.title = `Checked in at ${attendance[date]}`;
    calendarCells.push(cell);
  }
  calendar.replaceChildren(...calendarCells);
  document.querySelector("#calendar-next").disabled = monthStart.getTime() >= currentMonthStart.getTime();
}

function getVisibleTasks() {
  return tasks
    .filter((task) => {
      if (activeFilter === "today" && (task.completed || task.dueDate !== today)) return false;
      if (activeFilter === "upcoming" && (task.completed || !task.dueDate || task.dueDate <= today)) return false;
      if (activeFilter === "completed" && !task.completed) return false;
      if (activeFilter === "all" && task.completed) return false;
      if (activeSubject !== "all" && task.subject !== activeSubject) return false;
      return !searchTerm || task.title.toLowerCase().includes(searchTerm) || task.subject.toLowerCase().includes(searchTerm);
    })
    .sort((first, second) => {
      if (!first.dueDate) return second.dueDate ? 1 : 0;
      if (!second.dueDate) return -1;
      return first.dueDate.localeCompare(second.dueDate) || first.createdAt - second.createdAt;
    });
}

function renderTask(task) {
  const taskElement = document.createElement("article");
  const completeClass = task.completed ? " is-complete" : "";
  const overdueClass = isOverdue(task) ? " is-overdue" : "";
  const priority = ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium";
  taskElement.className = `task-row${completeClass}`;
  taskElement.dataset.taskId = task.id;
  taskElement.innerHTML = `
    <button class="task-check${task.completed ? " is-complete" : ""}" type="button" data-action="toggle" aria-label="${task.completed ? "Mark incomplete" : "Mark complete"}: ${escapeHtml(task.title)}" aria-pressed="${task.completed}"></button>
    <div class="task-main">
      <p class="task-title">${escapeHtml(task.title)}</p>
      <div class="task-meta">
        <span class="subject-tag" data-subject="${escapeHtml(task.subject)}">${escapeHtml(task.subject)}</span>
        <span class="due-date${overdueClass}">${isOverdue(task) ? "Overdue · " : ""}${escapeHtml(formatDueDate(task.dueDate))}</span>
        <span class="priority priority-${priority}">${priority[0].toUpperCase()}${priority.slice(1)}</span>
      </div>
    </div>
    <div class="task-actions">
      <button class="icon-button" type="button" data-action="edit" aria-label="Edit ${escapeHtml(task.title)}" title="Edit task">✎</button>
      <button class="icon-button delete-task" type="button" data-action="delete" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task">×</button>
    </div>`;
  return taskElement;
}

function render() {
  const visibleTasks = getVisibleTasks();
  taskList.replaceChildren(...visibleTasks.map(renderTask));
  document.querySelector("#empty-state").hidden = visibleTasks.length > 0;
  document.querySelector("#visible-task-count").textContent = String(visibleTasks.length);

  const details = filterDetails[activeFilter];
  document.querySelector("#list-title").textContent = details.title;
  document.querySelector("#list-caption").textContent = details.caption;
  document.querySelector("#breadcrumb-current").textContent = details.title;
  document.querySelector("#page-title").innerHTML = activeFilter === "all"
    ? 'Make today <span class="title-accent">count.</span>'
    : `${escapeHtml(details.title)}<span class="title-accent">.</span>`;

  const incompleteTasks = tasks.filter((task) => !task.completed).length;
  const completedTasks = tasks.length - incompleteTasks;
  const todayTasks = tasks.filter((task) => task.dueDate === today);
  const dueTodayCount = todayTasks.filter((task) => !task.completed).length;
  const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const dailyProgress = todayTasks.length
    ? Math.round((todayTasks.filter((task) => task.completed).length / todayTasks.length) * 100)
    : 0;
  document.querySelector("#total-tasks").textContent = String(tasks.length);
  document.querySelector("#completed-tasks").textContent = String(completedTasks);
  document.querySelector("#due-today").textContent = String(dueTodayCount);
  document.querySelector("#completion-rate").textContent = `${completionRate}%`;
  document.querySelector("#daily-progress").textContent = `${dailyProgress}%`;
  document.querySelector("#daily-progress-fill").style.width = `${dailyProgress}%`;
  document.querySelector("#focus-progress-label").textContent = `${completedTasks} of ${tasks.length} tasks done`;
  document.querySelector("#focus-progress-fill").style.width = `${completionRate}%`;
  document.querySelector("#nav-task-count").textContent = String(incompleteTasks);

  const noMatches = tasks.length > 0 && visibleTasks.length === 0;
  document.querySelector("#empty-title").textContent = noMatches ? "No tasks found." : "Your day is a blank page.";
  document.querySelector("#empty-copy").textContent = noMatches
    ? "Try a different search or filter to find what you need."
    : "Add your first task and start making progress.";
  document.querySelector("#empty-add-task").hidden = noMatches;
  renderAttendance();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function openTaskDialog(task = null) {
  editingTaskId = task ? task.id : null;
  document.querySelector("#dialog-title").textContent = task ? "Edit task" : "Add a task";
  document.querySelector("#submit-label").textContent = task ? "Save changes" : "Add task";
  titleInput.value = task ? task.title : "";
  document.querySelector("#task-subject").value = task ? task.subject : "Other";
  dueDateInput.value = task ? task.dueDate || "" : today;
  document.querySelector("#task-priority").value = task ? task.priority || "medium" : "medium";
  dialog.showModal();
  titleInput.focus();
}

function closeTaskDialog() {
  dialog.close();
  form.reset();
  editingTaskId = null;
}

function setActiveFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === filter);
  });
  render();
}

document.querySelector("#topbar-date").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
}).format(new Date());

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => setActiveFilter(button.dataset.filter));
});

document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    activeSubject = button.dataset.subject;
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.classList.toggle("is-selected", chip === button);
    });
    render();
  });
});

document.querySelector("#attendance-checkin-button").addEventListener("click", () => {
  if (Object.hasOwn(attendance, today)) {
    showToast("You’ve already checked in today. See you tomorrow!");
    return;
  }
  attendance[today] = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  if (saveAttendance()) {
    renderAttendance();
    showToast("Checked in! You showed up for yourself today.");
  }
});

document.querySelector("#calendar-previous").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderAttendance();
});

document.querySelector("#calendar-next").addEventListener("click", () => {
  const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  if (calendarMonth >= currentMonth) return;
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderAttendance();
});

document.querySelector("#open-task-form").addEventListener("click", () => openTaskDialog());
document.querySelector("#empty-add-task").addEventListener("click", () => openTaskDialog());
document.querySelector("#close-task-form").addEventListener("click", closeTaskDialog);
document.querySelector("#cancel-task-form").addEventListener("click", closeTaskDialog);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeTaskDialog();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.setCustomValidity("Please enter a task name.");
    titleInput.reportValidity();
    return;
  }
  titleInput.setCustomValidity("");

  const taskData = {
    title,
    subject: document.querySelector("#task-subject").value,
    dueDate: dueDateInput.value,
    priority: document.querySelector("#task-priority").value,
  };
  if (editingTaskId) {
    tasks = tasks.map((task) => task.id === editingTaskId ? { ...task, ...taskData } : task);
    showToast("Task updated.");
  } else {
    tasks.push({
      ...taskData,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      completed: false,
      createdAt: Date.now(),
    });
    showToast("Task added to your list.");
  }
  saveTasks();
  closeTaskDialog();
  render();
});

titleInput.addEventListener("input", () => titleInput.setCustomValidity(""));

taskList.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const taskRow = actionButton.closest("[data-task-id]");
  const task = tasks.find((item) => item.id === taskRow.dataset.taskId);
  if (!task) return;

  if (actionButton.dataset.action === "toggle") {
    task.completed = !task.completed;
    saveTasks();
    render();
    showToast(task.completed ? "Nice work! Task completed." : "Task marked as in progress.");
  } else if (actionButton.dataset.action === "edit") {
    openTaskDialog(task);
  } else if (actionButton.dataset.action === "delete") {
    tasks = tasks.filter((item) => item.id !== task.id);
    saveTasks();
    render();
    showToast("Task deleted.");
  }
});

document.querySelector("#task-search").addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && !dialog.open) {
    event.preventDefault();
    document.querySelector("#task-search").focus();
  }
});

render();
