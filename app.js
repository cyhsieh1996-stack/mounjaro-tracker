const STORAGE_KEY = "mounjaro-health-tracker-v1";

const today = new Date().toISOString().split("T")[0];
const nowTime = new Date().toTimeString().slice(0, 5);

const state = {
  medications: [],
  weights: [],
  labs: [],
};

const charts = {
  weight: null,
  labs: null,
};

const medicationForm = document.getElementById("medication-form");
const weightForm = document.getElementById("weight-form");
const labsForm = document.getElementById("labs-form");
const tabButtons = document.querySelectorAll(".tab");
const medicationList = document.getElementById("medication-list");
const weightList = document.getElementById("weight-list");
const labsList = document.getElementById("labs-list");
const exportButton = document.getElementById("export-button");
const importInput = document.getElementById("import-input");
const clearDataButton = document.getElementById("clear-data-button");
const injectionRegionSelect = document.getElementById("injection-region");
const injectionDetailSelect = document.getElementById("injection-detail");
const injectionDetailLabel = document.getElementById("injection-detail-label");
const syncStatus = document.getElementById("sync-status");
const authPanel = document.getElementById("auth-panel");
const authEmailField = document.getElementById("auth-email-field");
const authPasswordField = document.getElementById("auth-password-field");
const emailSignInInput = document.getElementById("email-sign-in-input");
const passwordSignInInput = document.getElementById("password-sign-in-input");
const emailSignInButton = document.getElementById("email-sign-in-button");
const emailSignUpButton = document.getElementById("email-sign-up-button");
const authSession = document.getElementById("auth-session");
const authUserEmail = document.getElementById("auth-user-email");
const signOutButton = document.getElementById("sign-out-button");
const authHelp = document.getElementById("auth-help");
const appContent = document.getElementById("app-content");

const injectionSiteOptions = {
  肚臍: ["左側", "右側", "上方", "下方"],
  大腿: ["左腿內側", "左腿外側", "右腿內側", "右腿外側"],
  上臂: ["左上臂內側", "左上臂外側", "右上臂內側", "右上臂外側"],
};

const appConfig = window.APP_CONFIG || {};
const supabaseConfig = appConfig.supabase || {};
const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey && window.supabase);
const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

let activeStorageMode = supabaseClient ? "supabase" : "local";
let eventsBound = false;
let currentSession = null;
let hasShownWeightTimeCompatibilityNotice = false;

document.addEventListener("DOMContentLoaded", () => {
  initializeApp().catch((error) => {
    console.error(error);
    window.alert("初始化資料時發生問題，已切換成本機模式。");
    activeStorageMode = "local";
    currentSession = null;
    Object.assign(state, loadState());
    setDefaultFormValues();
    bindEvents();
    updateAuthUI();
    renderSyncStatus("local", true);
    render();
  });
});

async function initializeApp() {
  setDefaultFormValues();
  bindEvents();
  await setupStorageMode();
  updateAuthUI();
  render();
}

function bindEvents() {
  if (eventsBound) {
    return;
  }
  eventsBound = true;

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget));
  });

  injectionRegionSelect.addEventListener("change", () => {
    syncInjectionDetailOptions(injectionRegionSelect.value);
  });

  injectionDetailSelect.addEventListener("change", () => {
    medicationForm.elements.injectionSite.value = buildInjectionSite(
      injectionRegionSelect.value,
      injectionDetailSelect.value,
    );
  });

  emailSignInButton.addEventListener("click", handleEmailSignIn);
  emailSignUpButton.addEventListener("click", handleEmailSignUp);
  passwordSignInInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleEmailSignIn();
    }
  });
  signOutButton.addEventListener("click", handleSignOut);

  medicationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ensureFormValid(medicationForm, "用藥紀錄")) {
      return;
    }
    if (!canWriteRecords()) {
      window.alert("請先登入後再新增資料。");
      return;
    }

    const formData = new FormData(medicationForm);
    const record = {
      id: crypto.randomUUID(),
      date: String(formData.get("date")),
      time: String(formData.get("time")),
      dose: Number(formData.get("dose")),
      injectionSite: String(formData.get("injectionSite")),
    };

    await saveRecord("medications", record);
    medicationForm.reset();
    medicationForm.elements.date.value = today;
    medicationForm.elements.time.value = nowTime;
    medicationForm.elements.dose.value = "2.5";
    injectionRegionSelect.value = "肚臍";
    syncInjectionDetailOptions("肚臍", "左側");
  });

  weightForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ensureFormValid(weightForm, "體重紀錄")) {
      return;
    }
    if (!canWriteRecords()) {
      window.alert("請先登入後再新增資料。");
      return;
    }

    const formData = new FormData(weightForm);
    const record = {
      id: crypto.randomUUID(),
      date: String(formData.get("date")),
      time: String(formData.get("time")),
      weight: Number(formData.get("weight")),
    };

    await saveRecord("weights", record);
    weightForm.reset();
    weightForm.elements.date.value = today;
    weightForm.elements.time.value = nowTime;
  });

  labsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ensureLabsFormValid()) {
      return;
    }
    if (!canWriteRecords()) {
      window.alert("請先登入後再新增資料。");
      return;
    }

    const date = String(labsForm.elements.date.value || "").trim();
    const totalCholesterol = parseRequiredNumberField(labsForm, "totalCholesterol", "總膽固醇");
    const hdl = parseRequiredNumberField(labsForm, "hdl", "高密度膽固醇（HDL）");
    const ldl = parseRequiredNumberField(labsForm, "ldl", "低密度膽固醇（LDL）");
    const triglycerides = parseRequiredNumberField(labsForm, "triglycerides", "三酸甘油脂（TG）");
    const fastingGlucose = parseRequiredNumberField(labsForm, "fastingGlucose", "空腹血糖");

    if ([totalCholesterol, hdl, ldl, triglycerides, fastingGlucose].some((value) => value === null)) {
      return;
    }

    const record = {
      id: crypto.randomUUID(),
      date,
      totalCholesterol,
      hdl,
      ldl,
      triglycerides,
      fastingGlucose,
    };

    await saveRecord("labs", record);
    labsForm.reset();
    labsForm.elements.date.value = today;
  });

  medicationList.addEventListener("click", handleDelete);
  weightList.addEventListener("click", handleDelete);
  labsList.addEventListener("click", handleDelete);

  exportButton.addEventListener("click", exportData);
  importInput.addEventListener("change", importData);
  clearDataButton.addEventListener("click", clearAllData);
}

async function setupStorageMode() {
  if (!supabaseClient) {
    activeStorageMode = "local";
    currentSession = null;
    Object.assign(state, loadState());
    renderSyncStatus("local");
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    throw error;
  }

  currentSession = data.session;

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentSession = session;
    if (currentSession) {
      activeStorageMode = "supabase";
      await loadRemoteRecords();
      renderSyncStatus("supabase");
    } else {
      Object.assign(state, { medications: [], weights: [], labs: [] });
      renderSyncStatus("auth-required");
    }

    updateAuthUI();
    render();
  });

  if (currentSession) {
    activeStorageMode = "supabase";
    await loadRemoteRecords();
    renderSyncStatus("supabase");
  } else {
    activeStorageMode = "supabase";
    Object.assign(state, { medications: [], weights: [], labs: [] });
    renderSyncStatus("auth-required");
  }
}

async function loadRemoteRecords() {
  const remoteData = await fetchSupabaseData();
  Object.assign(state, remoteData);
  saveState();
}

function setDefaultFormValues() {
  medicationForm.elements.date.value = today;
  medicationForm.elements.time.value = nowTime;
  medicationForm.elements.dose.value = "2.5";
  injectionRegionSelect.value = "肚臍";
  syncInjectionDetailOptions("肚臍", "左側");
  weightForm.elements.date.value = today;
  weightForm.elements.time.value = nowTime;
  labsForm.elements.date.value = today;
}

function syncInjectionDetailOptions(region, selectedDetail) {
  const options = injectionSiteOptions[region] || [];
  injectionDetailLabel.textContent =
    region === "肚臍" ? "細部位置（上下左右）" : "細部位置（左/右＋內/外側）";

  injectionDetailSelect.innerHTML = options
    .map((option) => `<option value="${option}">${option}</option>`)
    .join("");

  const fallbackDetail = options[0] || "";
  injectionDetailSelect.value = selectedDetail && options.includes(selectedDetail) ? selectedDetail : fallbackDetail;
  medicationForm.elements.injectionSite.value = buildInjectionSite(region, injectionDetailSelect.value);
}

function buildInjectionSite(region, detail) {
  if (region === "肚臍") {
    return `${region}${detail}`;
  }
  return detail;
}

function setActiveTab(formId) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === formId);
  });

  document.querySelectorAll(".data-form").forEach((form) => {
    const isActive = form.id === formId;
    form.classList.toggle("active", isActive);
    form.hidden = !isActive;
  });
}

async function handleEmailSignIn() {
  if (!supabaseClient) {
    window.alert("目前沒有設定 Supabase，無法使用登入。");
    return;
  }

  const { email, password } = getAuthCredentials();
  if (!email) {
    window.alert("請先輸入 Email。");
    emailSignInInput.focus();
    return;
  }
  if (!password) {
    window.alert("請先輸入密碼。");
    passwordSignInInput.focus();
    return;
  }

  setAuthButtonsDisabled(true);

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      throw error;
    }

    passwordSignInInput.value = "";
  } catch (error) {
    console.error(error);
    const details = error?.message ? `\n\n錯誤訊息：${error.message}` : "";
    window.alert(`登入失敗，請確認 Email 與密碼。${details}`);
  } finally {
    setAuthButtonsDisabled(false);
  }
}

async function handleEmailSignUp() {
  if (!supabaseClient) {
    window.alert("目前沒有設定 Supabase，無法使用註冊。");
    return;
  }

  const { email, password } = getAuthCredentials();
  if (!email) {
    window.alert("請先輸入 Email。");
    emailSignInInput.focus();
    return;
  }
  if (!password) {
    window.alert("請先輸入密碼。");
    passwordSignInInput.focus();
    return;
  }
  if (password.length < 6) {
    window.alert("密碼至少需要 6 碼。");
    passwordSignInInput.focus();
    return;
  }

  setAuthButtonsDisabled(true);

  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      throw error;
    }

    if (data.session) {
      passwordSignInInput.value = "";
      return;
    }

    window.alert("註冊成功，請先到 Email 信箱完成驗證後再登入。");
  } catch (error) {
    console.error(error);
    const details = error?.message ? `\n\n錯誤訊息：${error.message}` : "";
    window.alert(`註冊失敗，請稍後再試。${details}`);
  } finally {
    setAuthButtonsDisabled(false);
  }
}

function getAuthCredentials() {
  return {
    email: emailSignInInput.value.trim(),
    password: String(passwordSignInInput.value || ""),
  };
}

function setAuthButtonsDisabled(disabled) {
  emailSignInButton.disabled = disabled;
  emailSignUpButton.disabled = disabled;
}

async function handleSignOut() {
  if (!supabaseClient) {
    return;
  }

  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error(error);
    window.alert("登出失敗，請稍後再試。");
    return;
  }

  currentSession = null;
  Object.assign(state, { medications: [], weights: [], labs: [] });
  renderSyncStatus("auth-required");
  updateAuthUI();
  render();
}

function updateAuthUI() {
  const requiresAuth = Boolean(supabaseClient);
  const isSignedIn = Boolean(currentSession?.user);

  if (!requiresAuth) {
    authPanel.hidden = false;
    authEmailField.hidden = true;
    authPasswordField.hidden = true;
    emailSignInButton.hidden = true;
    emailSignUpButton.hidden = true;
    authSession.hidden = true;
    authHelp.textContent = "目前為本機模式，資料只保留在這台裝置的瀏覽器。";
    appContent.classList.remove("is-locked");
    return;
  }

  authPanel.hidden = isSignedIn;
  authEmailField.hidden = isSignedIn;
  authPasswordField.hidden = isSignedIn;
  emailSignInButton.hidden = isSignedIn;
  emailSignUpButton.hidden = isSignedIn;
  authSession.hidden = !isSignedIn;
  authUserEmail.textContent = isSignedIn ? `已登入：${currentSession.user.email}` : "";
  authHelp.textContent = isSignedIn
    ? "目前已登入，只會讀取與寫入你的個人資料。"
    : "請輸入 Email 與密碼。";

  appContent.classList.toggle("is-locked", !isSignedIn);
}

function canWriteRecords() {
  return activeStorageMode === "local" || Boolean(currentSession?.user);
}

async function handleDelete(event) {
  const button = event.target.closest("[data-delete-id]");
  if (!button) {
    return;
  }

  if (!canWriteRecords()) {
    window.alert("請先登入後再刪除資料。");
    return;
  }

  const { deleteId, deleteCollection } = button.dataset;
  if (!deleteCollection) {
    return;
  }

  await removeRecord(deleteCollection, deleteId);
}

async function saveRecord(collection, record) {
  try {
    if (activeStorageMode === "supabase" && supabaseClient) {
      await upsertSupabaseRecord(collection, record);
      await loadRemoteRecords();
      renderSyncStatus("supabase");
    } else {
      state[collection].push(record);
      sortCollection(collection);
      saveState();
      renderSyncStatus("local");
    }

    render();
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error && error.message ? `\n${error.message}` : "";
    window.alert(`儲存資料失敗，請稍後再試。${detail}`);
  }
}

async function removeRecord(collection, id) {
  try {
    if (activeStorageMode === "supabase" && supabaseClient) {
      await deleteSupabaseRecord(collection, id);
      await loadRemoteRecords();
      renderSyncStatus("supabase");
    } else {
      state[collection] = state[collection].filter((item) => item.id !== id);
      saveState();
      renderSyncStatus("local");
    }

    render();
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error && error.message ? `\n${error.message}` : "";
    window.alert(`刪除資料失敗，請稍後再試。${detail}`);
  }
}

function sortCollection(collection) {
  if (collection === "medications") {
    state[collection].sort(sortByDateTimeDesc);
    return;
  }
  state[collection].sort(sortByDateDesc);
}

function ensureFormValid(form, formLabel) {
  if (form.checkValidity()) {
    return true;
  }

  form.reportValidity();

  const invalidField = form.querySelector(":invalid");
  if (invalidField instanceof HTMLElement) {
    invalidField.scrollIntoView({ behavior: "smooth", block: "center" });
    invalidField.focus({ preventScroll: true });
    const fieldLabel = invalidField.closest(".field")?.querySelector("span")?.textContent?.trim();
    if (fieldLabel) {
      window.alert(`請先完成「${fieldLabel}」再儲存${formLabel}。`);
    }
  }

  return false;
}

function ensureLabsFormValid() {
  const dateField = labsForm.elements.date;
  if (!String(dateField.value || "").trim()) {
    dateField.scrollIntoView({ behavior: "smooth", block: "center" });
    dateField.focus({ preventScroll: true });
    window.alert("請先完成「檢驗日期」再儲存檢驗紀錄。");
    return false;
  }

  return true;
}

function parseRequiredNumberField(form, fieldName, fieldLabel) {
  const field = form.elements[fieldName];
  const rawValue = String(field.value || "").trim();

  if (!rawValue) {
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.focus({ preventScroll: true });
    window.alert(`請先完成「${fieldLabel}」再儲存檢驗紀錄。`);
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.focus({ preventScroll: true });
    window.alert(`「${fieldLabel}」請輸入有效數字。`);
    return null;
  }

  if (parsed < 0) {
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.focus({ preventScroll: true });
    window.alert(`「${fieldLabel}」不能小於 0。`);
    return null;
  }

  return parsed;
}

function render() {
  renderMedicationList();
  renderWeightList();
  renderLabsList();
  renderCharts();
}

function renderMedicationList() {
  const items = [...state.medications].sort(sortByDateTimeDesc);
  medicationList.classList.toggle("empty-state", items.length === 0);
  medicationList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="record-card">
              <div class="record-card-header">
                <h3>${formatDate(item.date, true)} ${item.time}</h3>
                <div class="record-card-header-actions">
                  <strong>${item.dose} mg</strong>
                  <button class="record-button" type="button" data-delete-collection="medications" data-delete-id="${item.id}">刪除</button>
                </div>
              </div>
              <p>施打位置：${item.injectionSite || "未填位置"}</p>
            </article>
          `,
        )
        .join("")
    : "尚無用藥紀錄";
}

function renderWeightList() {
  const items = [...state.weights].sort(sortByDateDesc);
  weightList.classList.toggle("empty-state", items.length === 0);
  weightList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="record-card">
              <div class="record-card-header">
                <h3>${formatDate(item.date, true)} ${item.time || ""}</h3>
                <div class="record-card-header-actions">
                  <strong>${item.weight.toFixed(1)} kg</strong>
                  <button class="record-button" type="button" data-delete-collection="weights" data-delete-id="${item.id}">刪除</button>
                </div>
              </div>
            </article>
          `,
        )
        .join("")
    : "尚無體重紀錄";
}

function renderLabsList() {
  const items = [...state.labs].sort(sortByDateDesc);
  labsList.classList.toggle("empty-state", items.length === 0);
  labsList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="record-card">
              <div class="record-card-header record-card-header-inline-action">
                <h3>${formatDate(item.date)}</h3>
                <button class="record-button" type="button" data-delete-collection="labs" data-delete-id="${item.id}">刪除</button>
              </div>
              <div class="lab-metrics">
                <div class="lab-metric-row">
                  <span class="lab-metric"><span class="lab-metric-label">TC</span><span class="lab-metric-value">${item.totalCholesterol}</span></span>
                  <span class="lab-metric"><span class="lab-metric-label">HDL</span><span class="lab-metric-value">${item.hdl}</span></span>
                  <span class="lab-metric"><span class="lab-metric-label">LDL</span><span class="lab-metric-value">${item.ldl}</span></span>
                </div>
                <div class="lab-metric-row">
                  <span class="lab-metric"><span class="lab-metric-label">TG</span><span class="lab-metric-value">${item.triglycerides}</span></span>
                  <span class="lab-metric"><span class="lab-metric-label">FPG</span><span class="lab-metric-value">${item.fastingGlucose}</span></span>
                </div>
              </div>
            </article>
          `,
        )
        .join("")
    : "尚無檢驗紀錄";
}

function renderCharts() {
  if (!window.Chart) {
    return;
  }

  const weightData = [...state.weights].sort(sortByDateAsc);
  const labsData = [...state.labs].sort(sortByDateAsc);

  const weightCtx = document.getElementById("weight-chart");
  const labsCtx = document.getElementById("labs-chart");

  if (charts.weight) {
    charts.weight.destroy();
  }
  if (charts.labs) {
    charts.labs.destroy();
  }

  charts.weight = new Chart(weightCtx, {
    type: "line",
    data: {
      labels: weightData.map((item) => formatDate(item.date, true)),
      datasets: [
        {
          label: "體重 (kg)",
          data: weightData.map((item) => item.weight),
          borderColor: "#476dc7",
          backgroundColor: "rgba(71, 109, 199, 0.18)",
          borderWidth: 3,
          tension: 0.28,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 5,
          pointBackgroundColor: "#476dc7",
          pointBorderColor: "#476dc7",
          pointBorderWidth: 0,
        },
      ],
    },
    options: getChartOptions("kg", { min: 50, max: 100 }),
  });

  charts.labs = new Chart(labsCtx, {
    type: "line",
    data: {
      labels: labsData.map((item) => formatDate(item.date, true)),
      datasets: [
        buildLabDataset("總膽固醇", labsData, "totalCholesterol", "#d95d39"),
        buildLabDataset("HDL", labsData, "hdl", "#3f7d6b"),
        buildLabDataset("LDL", labsData, "ldl", "#476dc7"),
        buildLabDataset("TG", labsData, "triglycerides", "#d89a1d"),
        buildLabDataset("空腹血糖", labsData, "fastingGlucose", "#8c4cc9"),
      ],
    },
    options: getChartOptions("mg/dL"),
  });
}

function buildLabDataset(label, source, key, color) {
  return {
    label,
    data: source.map((item) => item[key]),
    borderColor: color,
    backgroundColor: `${color}20`,
    borderWidth: 2,
    tension: 0.22,
    fill: false,
    pointRadius: 3,
    pointHoverRadius: 4,
    pointBackgroundColor: color,
    pointBorderColor: color,
    pointBorderWidth: 0,
  };
}

function getChartOptions(unit, yAxisOverrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.9,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 7,
          boxHeight: 7,
          padding: 14,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        ...yAxisOverrides,
        ticks: {
          callback(value) {
            return `${value} ${unit}`;
          },
        },
      },
    },
  };
}

function exportData() {
  if (!canWriteRecords()) {
    window.alert("請先登入後再匯出資料。");
    return;
  }

  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mounjaro-tracker-data-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  if (!canWriteRecords()) {
    window.alert("請先登入後再匯入資料。");
    importInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const nextState = {
        medications: Array.isArray(parsed.medications) ? parsed.medications : [],
        weights: Array.isArray(parsed.weights) ? parsed.weights : [],
        labs: Array.isArray(parsed.labs) ? parsed.labs : [],
      };

      if (activeStorageMode === "supabase" && supabaseClient) {
        await replaceSupabaseData(nextState);
        await loadRemoteRecords();
        renderSyncStatus("supabase");
      } else {
        Object.assign(state, nextState);
        saveState();
        renderSyncStatus("local");
      }

      render();
    } catch (error) {
      console.error(error);
      window.alert("匯入失敗，請確認檔案格式是否正確。");
    } finally {
      importInput.value = "";
    }
  };

  reader.readAsText(file);
}

async function clearAllData() {
  if (!canWriteRecords()) {
    window.alert("請先登入後再清空資料。");
    return;
  }

  const shouldClear = window.confirm("確定要清空所有資料嗎？這個動作無法復原。");
  if (!shouldClear) {
    return;
  }

  try {
    if (activeStorageMode === "supabase" && supabaseClient) {
      await replaceSupabaseData({ medications: [], weights: [], labs: [] });
      Object.assign(state, { medications: [], weights: [], labs: [] });
      renderSyncStatus("supabase");
    } else {
      Object.assign(state, { medications: [], weights: [], labs: [] });
      saveState();
      renderSyncStatus("local");
    }

    render();
  } catch (error) {
    console.error(error);
    window.alert("清空資料失敗，請稍後再試。");
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { medications: [], weights: [], labs: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      weights: Array.isArray(parsed.weights) ? parsed.weights : [],
      labs: Array.isArray(parsed.labs) ? parsed.labs : [],
    };
  } catch (error) {
    return { medications: [], weights: [], labs: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function fetchSupabaseData() {
  const [medicationsResult, weightsResult, labsResult] = await Promise.all([
    supabaseClient.from("medications").select("*").order("date", { ascending: false }).order("time", { ascending: false }),
    supabaseClient.from("weights").select("*").order("date", { ascending: false }),
    supabaseClient.from("labs").select("*").order("date", { ascending: false }),
  ]);

  handleSupabaseError(medicationsResult.error);
  handleSupabaseError(weightsResult.error);
  handleSupabaseError(labsResult.error);

  return {
    medications: (medicationsResult.data || []).map(mapMedicationFromDb),
    weights: (weightsResult.data || []).map(mapWeightFromDb),
    labs: (labsResult.data || []).map(mapLabFromDb),
  };
}

async function upsertSupabaseRecord(collection, record) {
  const table = getSupabaseTable(collection);
  const payload = mapRecordToDb(collection, record);
  let result = await supabaseClient.from(table).upsert(payload);

  if (collection === "weights" && isMissingWeightTimeColumnError(result.error)) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.time;
    result = await supabaseClient.from(table).upsert(fallbackPayload);

    if (!result.error && !hasShownWeightTimeCompatibilityNotice) {
      hasShownWeightTimeCompatibilityNotice = true;
      window.alert("目前體重資料已先成功儲存，但雲端資料表尚未完成時間欄位更新，所以這筆體重時間不會被保留。請到 Supabase SQL Editor 重新執行最新的 schema。");
    }
  }

  handleSupabaseError(result.error);
}

async function deleteSupabaseRecord(collection, id) {
  const table = getSupabaseTable(collection);
  const result = await supabaseClient.from(table).delete().eq("id", id);
  handleSupabaseError(result.error);
}

async function replaceSupabaseData(nextState) {
  const results = await Promise.all([
    supabaseClient.from("medications").delete().not("id", "is", null),
    supabaseClient.from("weights").delete().not("id", "is", null),
    supabaseClient.from("labs").delete().not("id", "is", null),
  ]);
  results.forEach((result) => handleSupabaseError(result.error));

  if (nextState.medications.length) {
    const result = await supabaseClient
      .from("medications")
      .insert(nextState.medications.map((item) => mapRecordToDb("medications", item)));
    handleSupabaseError(result.error);
  }

  if (nextState.weights.length) {
    let result = await supabaseClient
      .from("weights")
      .insert(nextState.weights.map((item) => mapRecordToDb("weights", item)));

    if (isMissingWeightTimeColumnError(result.error)) {
      result = await supabaseClient.from("weights").insert(
        nextState.weights.map((item) => {
          const payload = mapRecordToDb("weights", item);
          delete payload.time;
          return payload;
        }),
      );
    }

    handleSupabaseError(result.error);
  }

  if (nextState.labs.length) {
    const result = await supabaseClient
      .from("labs")
      .insert(nextState.labs.map((item) => mapRecordToDb("labs", item)));
    handleSupabaseError(result.error);
  }
}

function getSupabaseTable(collection) {
  return {
    medications: "medications",
    weights: "weights",
    labs: "labs",
  }[collection];
}

function mapRecordToDb(collection, record) {
  if (collection === "medications") {
    return {
      id: record.id,
      date: record.date,
      time: record.time,
      dose: record.dose,
      injection_site: record.injectionSite,
    };
  }

  if (collection === "weights") {
    return {
      id: record.id,
      date: record.date,
      time: record.time,
      weight: record.weight,
    };
  }

  return {
    id: record.id,
    date: record.date,
    total_cholesterol: record.totalCholesterol,
    hdl: record.hdl,
    ldl: record.ldl,
    triglycerides: record.triglycerides,
    fasting_glucose: record.fastingGlucose,
  };
}

function mapMedicationFromDb(record) {
  return {
    id: record.id,
    date: record.date,
    time: record.time,
    dose: Number(record.dose),
    injectionSite: record.injection_site,
  };
}

function mapWeightFromDb(record) {
  return {
    id: record.id,
    date: record.date,
    time: record.time || "",
    weight: Number(record.weight),
  };
}

function mapLabFromDb(record) {
  return {
    id: record.id,
    date: record.date,
    totalCholesterol: Number(record.total_cholesterol),
    hdl: Number(record.hdl),
    ldl: Number(record.ldl),
    triglycerides: Number(record.triglycerides),
    fastingGlucose: Number(record.fasting_glucose),
  };
}

function handleSupabaseError(error) {
  if (error) {
    throw error;
  }
}

function isMissingWeightTimeColumnError(error) {
  if (!error) {
    return false;
  }

  const message = String(error.message || "").toLowerCase();
  return message.includes("time") && (message.includes("column") || message.includes("schema cache"));
}

function renderSyncStatus(mode, fallback = false) {
  if (!syncStatus) {
    return;
  }

  if (mode === "supabase") {
    syncStatus.textContent = "目前使用雲端同步模式";
    return;
  }

  if (mode === "auth-required") {
    syncStatus.textContent = "請先登入，登入後只會看到自己的資料";
    return;
  }

  syncStatus.textContent = fallback
    ? "雲端連線失敗，已切換成本機儲存模式"
    : "目前使用本機儲存模式";
}

function formatDate(dateString, short = false) {
  const date = new Date(`${dateString}T00:00:00`);
  if (short) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  }

  const formatter = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return formatter.format(date);
}

function sortByDateDesc(a, b) {
  return new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`);
}

function sortByDateAsc(a, b) {
  return new Date(`${a.date}T00:00:00`) - new Date(`${b.date}T00:00:00`);
}

function sortByDateTimeDesc(a, b) {
  return new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`);
}
