const STORAGE_KEY = "mounjaro-health-tracker-v1";
const SECTION_UI_STATE_KEY = "mounjaro-health-tracker-sections-v1";

const today = new Date().toISOString().split("T")[0];
const nowTime = new Date().toTimeString().slice(0, 5);

const state = {
  medications: [],
  weights: [],
  labs: [],
  inbody: [],
};

const charts = {
  weight: null,
  labs: null,
};

const medicationForm = document.getElementById("medication-form");
const weightForm = document.getElementById("weight-form");
const labsForm = document.getElementById("labs-form");
const inbodyForm = document.getElementById("inbody-form");
const tabButtons = document.querySelectorAll(".tab");
const medicationList = document.getElementById("medication-list");
const weightList = document.getElementById("weight-list");
const labsList = document.getElementById("labs-list");
const inbodyList = document.getElementById("inbody-list");
const exportButton = document.getElementById("export-button");
const importInput = document.getElementById("import-input");
const clearDataButton = document.getElementById("clear-data-button");
const injectionRegionSelect = document.getElementById("injection-region");
const injectionDetailSelect = document.getElementById("injection-detail");
const injectionDetailLabel = document.getElementById("injection-detail-label");
const syncStatus = document.getElementById("sync-status");
const latestMedicationSummary = document.getElementById("latest-medication-summary");
const latestWeightSummary = document.getElementById("latest-weight-summary");
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
const inputSectionToggle = document.getElementById("input-section-toggle");
const browseSectionToggle = document.getElementById("browse-section-toggle");
const inputWorkspaceBody = document.getElementById("input-workspace-body");
const browseWorkspaceBody = document.getElementById("browse-workspace-body");

const injectionSiteOptions = {
  肚臍: ["左側", "右側", "上方", "下方"],
  大腿: ["左腿外側", "右腿外側"],
  上臂: ["左上臂外側", "右上臂外側"],
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
  applySectionVisibility();
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
  inputSectionToggle?.addEventListener("click", () => toggleSectionVisibility("input"));
  browseSectionToggle?.addEventListener("click", () => toggleSectionVisibility("browse"));

  medicationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ensureFormValid(medicationForm, "用藥紀錄")) {
      return;
    }
    if (!ensureCanWrite("新增資料")) {
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
    resetMedicationForm();
  });

  weightForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ensureFormValid(weightForm, "體重紀錄")) {
      return;
    }
    if (!ensureCanWrite("新增資料")) {
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
    resetWeightForm();
  });

  labsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ensureLabsFormValid()) {
      return;
    }
    if (!ensureCanWrite("新增資料")) {
      return;
    }

    const date = String(labsForm.elements.date.value || "").trim();
    const totalCholesterol = parseRequiredNumberField(labsForm, "totalCholesterol", "總膽固醇");
    const hdl = parseRequiredNumberField(labsForm, "hdl", "高密度膽固醇（HDL）");
    const ldl = parseRequiredNumberField(labsForm, "ldl", "低密度膽固醇（LDL）");
    const triglycerides = parseRequiredNumberField(labsForm, "triglycerides", "三酸甘油脂（TG）");
    const fastingGlucose = parseRequiredNumberField(labsForm, "fastingGlucose", "空腹血糖");
    const uricAcid = parseRequiredNumberField(labsForm, "uricAcid", "尿酸");
    const creatinine = parseRequiredNumberField(labsForm, "creatinine", "Creatinine");

    if ([totalCholesterol, hdl, ldl, triglycerides, fastingGlucose, uricAcid, creatinine].some((value) => value === null)) {
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
      uricAcid,
      creatinine,
    };

    await saveRecord("labs", record);
    resetLabsForm();
  });

  inbodyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ensureFormValid(inbodyForm, "身體組成紀錄")) {
      return;
    }
    if (!ensureCanWrite("新增資料")) {
      return;
    }

    const record = {
      id: crypto.randomUUID(),
      date: String(inbodyForm.elements.date.value || "").trim(),
      weight: parseRequiredNumberField(inbodyForm, "weight", "體重", "身體組成紀錄"),
      skeletalMuscleMass: parseRequiredNumberField(inbodyForm, "skeletalMuscleMass", "骨骼肌重", "身體組成紀錄"),
      bodyFatMass: parseRequiredNumberField(inbodyForm, "bodyFatMass", "體脂肪重", "身體組成紀錄"),
      bodyFatPercentage: parseRequiredNumberField(inbodyForm, "bodyFatPercentage", "體脂肪率", "身體組成紀錄"),
      visceralFatArea: parseRequiredNumberField(inbodyForm, "visceralFatArea", "內臟脂肪面積", "身體組成紀錄"),
      inbodyScore: parseRequiredNumberField(inbodyForm, "inbodyScore", "InBody 分數", "身體組成紀錄"),
      basalMetabolicRate: parseRequiredNumberField(inbodyForm, "basalMetabolicRate", "基礎代謝率", "身體組成紀錄"),
    };

    if (
      [
        record.weight,
        record.skeletalMuscleMass,
        record.bodyFatMass,
        record.bodyFatPercentage,
        record.visceralFatArea,
        record.inbodyScore,
        record.basalMetabolicRate,
      ].some((value) => value === null)
    ) {
      return;
    }

    await saveRecord("inbody", record);
    resetInBodyForm();
  });

  medicationList.addEventListener("click", handleDelete);
  weightList.addEventListener("click", handleDelete);
  labsList.addEventListener("click", handleDelete);
  inbodyList.addEventListener("click", handleDelete);

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
      Object.assign(state, { medications: [], weights: [], labs: [], inbody: [] });
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
    Object.assign(state, { medications: [], weights: [], labs: [], inbody: [] });
    renderSyncStatus("auth-required");
  }
}

async function loadRemoteRecords() {
  const remoteData = await fetchSupabaseData();
  Object.assign(state, remoteData);
  saveState();
}

function setDefaultFormValues() {
  resetMedicationForm();
  resetWeightForm();
  resetLabsForm();
  resetInBodyForm();
}

function syncInjectionDetailOptions(region, selectedDetail) {
  const options = injectionSiteOptions[region] || [];
  injectionDetailLabel.textContent = "細部位置";

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
  Object.assign(state, { medications: [], weights: [], labs: [], inbody: [] });
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
  authHelp.textContent = "請輸入 Email 與密碼。";

  appContent.classList.toggle("is-locked", !isSignedIn);
}

function canWriteRecords() {
  return activeStorageMode === "local" || Boolean(currentSession?.user);
}

function ensureCanWrite(actionLabel) {
  if (canWriteRecords()) {
    return true;
  }

  window.alert(`請先登入後再${actionLabel}。`);
  return false;
}

async function handleDelete(event) {
  const button = event.target.closest("[data-delete-id]");
  if (!button) {
    return;
  }

  if (!ensureCanWrite("刪除資料")) {
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

function parseRequiredNumberField(form, fieldName, fieldLabel, formLabel = "檢驗紀錄") {
  const field = form.elements[fieldName];
  const rawValue = String(field.value || "").trim();

  if (!rawValue) {
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.focus({ preventScroll: true });
    window.alert(`請先完成「${fieldLabel}」再儲存${formLabel}。`);
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
  renderInputSummary();
  renderMedicationList();
  renderWeightList();
  renderInBodyList();
  renderLabsList();
  renderCharts();
}

function renderInputSummary() {
  const latestMedication = [...state.medications].sort(sortByDateTimeDesc)[0];
  const latestWeight = getLatestWeightSummaryRecord();

  latestMedicationSummary.textContent = latestMedication
    ? `${latestMedication.injectionSite} / ${latestMedication.dose} mg`
    : "尚無資料";

  latestWeightSummary.textContent = latestWeight
    ? `${latestWeight.weight.toFixed(1)} kg`
    : "尚無資料";
}

function getLatestWeightSummaryRecord() {
  const latestWeight = [...state.weights].sort(sortByDateTimeDesc)[0];
  const latestInBody = [...state.inbody].sort(sortByDateDesc)[0];

  if (!latestWeight) {
    return latestInBody || null;
  }

  if (!latestInBody) {
    return latestWeight;
  }

  const latestWeightDateTime = new Date(`${latestWeight.date}T${latestWeight.time || "00:00"}`);
  const latestInBodyDate = new Date(`${latestInBody.date}T00:00`);
  return latestInBodyDate > latestWeightDateTime ? latestInBody : latestWeight;
}

function renderMedicationList() {
  const items = [...state.medications].sort(sortByDateTimeDesc);
  renderRecordList(
    medicationList,
    items,
    "尚無用藥紀錄",
    (item) => `
      <article class="record-card">
        <div class="record-card-header">
          <h3 class="record-datetime">
            <span class="record-date-line">${formatDate(item.date, true)}</span>
            <span class="record-time-line">${item.time}</span>
          </h3>
          <div class="record-card-header-actions">
            <strong>${item.dose} mg</strong>
            <button class="record-button" type="button" data-delete-collection="medications" data-delete-id="${item.id}">刪除</button>
          </div>
        </div>
        <p>施打位置：${item.injectionSite || "未填位置"}</p>
      </article>
    `,
  );
}

function renderWeightList() {
  const items = [...state.weights].sort(sortByDateTimeDesc);
  renderRecordList(
    weightList,
    items,
    "尚無體重紀錄",
    (item) => `
      <article class="record-card">
        <div class="record-card-header">
          <h3 class="record-datetime">
            <span class="record-date-line">${formatDate(item.date, true)}</span>
            <span class="record-time-line">${item.time || ""}</span>
          </h3>
          <div class="record-card-header-actions">
            <strong>${item.weight.toFixed(1)} kg</strong>
            <button class="record-button" type="button" data-delete-collection="weights" data-delete-id="${item.id}">刪除</button>
          </div>
        </div>
      </article>
    `,
  );
}

function renderLabsList() {
  const items = [...state.labs].sort(sortByDateDesc);
  renderRecordList(
    labsList,
    items,
    "尚無檢驗紀錄",
    (item) => `
      <article class="record-card">
        <div class="record-card-header record-card-header-inline-action">
          <h3>${formatDate(item.date)}</h3>
          <button class="record-button" type="button" data-delete-collection="labs" data-delete-id="${item.id}">刪除</button>
        </div>
        <div class="lab-metrics">
          <span class="lab-metric"><span class="lab-metric-label">TC</span><span class="lab-metric-value">${item.totalCholesterol}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">HDL</span><span class="lab-metric-value">${item.hdl}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">LDL</span><span class="lab-metric-value">${item.ldl}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">TG</span><span class="lab-metric-value">${item.triglycerides}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">FPG</span><span class="lab-metric-value">${item.fastingGlucose}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">UA</span><span class="lab-metric-value">${formatDecimal(item.uricAcid)}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">Cr</span><span class="lab-metric-value">${formatDecimal(item.creatinine)}</span></span>
        </div>
      </article>
    `,
  );
}

function renderInBodyList() {
  const items = [...state.inbody].sort(sortByDateDesc);
  renderRecordList(
    inbodyList,
    items,
    "尚無身體組成紀錄",
    (item) => `
      <article class="record-card">
        <div class="record-card-header record-card-header-inline-action">
          <h3>${formatDate(item.date)}</h3>
          <button class="record-button" type="button" data-delete-collection="inbody" data-delete-id="${item.id}">刪除</button>
        </div>
        <div class="lab-metrics inbody-metrics">
          <span class="lab-metric"><span class="lab-metric-label">體重</span><span class="lab-metric-value">${formatDecimal(item.weight)}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">骨骼肌</span><span class="lab-metric-value">${formatDecimal(item.skeletalMuscleMass)}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">體脂重</span><span class="lab-metric-value">${formatDecimal(item.bodyFatMass)}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">體脂率</span><span class="lab-metric-value">${formatDecimal(item.bodyFatPercentage)}</span></span>
          <span class="lab-metric lab-metric-wide"><span class="lab-metric-label">內臟脂肪</span><span class="lab-metric-value">${formatDecimal(item.visceralFatArea)}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">BMR</span><span class="lab-metric-value">${Math.round(item.basalMetabolicRate)}</span></span>
          <span class="lab-metric"><span class="lab-metric-label">分數</span><span class="lab-metric-value">${Math.round(item.inbodyScore)}</span></span>
        </div>
      </article>
    `,
  );
}

function renderRecordList(container, items, emptyText, renderItem) {
  container.classList.toggle("empty-state", items.length === 0);
  container.innerHTML = items.length ? items.map(renderItem).join("") : emptyText;
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
          borderColor: "#6f35c8",
          backgroundColor: "rgba(111, 53, 200, 0.18)",
          borderWidth: 3,
          tension: 0.28,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 5,
          pointBackgroundColor: "#6f35c8",
          pointBorderColor: "#6f35c8",
          pointBorderWidth: 0,
        },
      ],
    },
    options: getChartOptions({ min: 50, max: 100 }),
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
        buildLabDataset("尿酸", labsData, "uricAcid", "#3f5db7"),
        buildLabDataset("Creatinine", labsData, "creatinine", "#5d6f86"),
      ],
    },
    options: getChartOptions(),
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

function getChartOptions(yAxisOverrides = {}) {
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
            return `${value}`;
          },
        },
      },
    },
  };
}

function exportData() {
  if (!ensureCanWrite("匯出資料")) {
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

  if (!ensureCanWrite("匯入資料")) {
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
        inbody: Array.isArray(parsed.inbody) ? parsed.inbody : [],
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
  if (!ensureCanWrite("清空資料")) {
    return;
  }

  const shouldClear = window.confirm("確定要清空所有資料嗎？這個動作無法復原。");
  if (!shouldClear) {
    return;
  }

  try {
    if (activeStorageMode === "supabase" && supabaseClient) {
      await replaceSupabaseData({ medications: [], weights: [], labs: [], inbody: [] });
      Object.assign(state, { medications: [], weights: [], labs: [], inbody: [] });
      renderSyncStatus("supabase");
    } else {
      Object.assign(state, { medications: [], weights: [], labs: [], inbody: [] });
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
    return { medications: [], weights: [], labs: [], inbody: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      weights: Array.isArray(parsed.weights) ? parsed.weights : [],
      labs: Array.isArray(parsed.labs) ? parsed.labs : [],
      inbody: Array.isArray(parsed.inbody) ? parsed.inbody : [],
    };
  } catch (error) {
    return { medications: [], weights: [], labs: [], inbody: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSectionVisibility() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SECTION_UI_STATE_KEY) || "{}");
    return {
      input: parsed.input !== false,
      browse: parsed.browse !== false,
    };
  } catch (error) {
    return { input: true, browse: true };
  }
}

function saveSectionVisibility(nextState) {
  localStorage.setItem(SECTION_UI_STATE_KEY, JSON.stringify(nextState));
}

function updateSectionVisibility(section, isExpanded) {
  const targetBody = section === "input" ? inputWorkspaceBody : browseWorkspaceBody;
  const targetButton = section === "input" ? inputSectionToggle : browseSectionToggle;

  if (!targetBody || !targetButton) {
    return;
  }

  targetBody.hidden = !isExpanded;
  targetButton.setAttribute("aria-expanded", String(isExpanded));
  targetButton.textContent = isExpanded ? "收合" : "展開";
}

function applySectionVisibility() {
  const sectionState = loadSectionVisibility();
  updateSectionVisibility("input", sectionState.input);
  updateSectionVisibility("browse", sectionState.browse);
}

function toggleSectionVisibility(section) {
  const sectionState = loadSectionVisibility();
  const nextExpanded = !sectionState[section];
  const nextState = { ...sectionState, [section]: nextExpanded };
  saveSectionVisibility(nextState);
  updateSectionVisibility(section, nextExpanded);
}

async function fetchSupabaseData() {
  const [medicationsResult, weightsResult, labsResult] = await Promise.all([
    supabaseClient.from("medications").select("*").order("date", { ascending: false }).order("time", { ascending: false }),
    supabaseClient.from("weights").select("*").order("date", { ascending: false }).order("time", { ascending: false }),
    supabaseClient.from("labs").select("*").order("date", { ascending: false }),
  ]);

  handleSupabaseError(medicationsResult.error);
  handleSupabaseError(weightsResult.error);
  handleSupabaseError(labsResult.error);

  let inbodyRecords = [];
  try {
    const inbodyResult = await supabaseClient.from("inbody").select("*").order("date", { ascending: false });
    handleSupabaseError(inbodyResult.error);
    inbodyRecords = (inbodyResult.data || []).map(mapInBodyFromDb);
  } catch (error) {
    if (isMissingInBodyTableError(error)) {
      console.warn("InBody 資料表尚未建立，已略過 InBody 初始化。", error);
    } else {
      throw error;
    }
  }

  return {
    medications: (medicationsResult.data || []).map(mapMedicationFromDb),
    weights: (weightsResult.data || []).map(mapWeightFromDb),
    labs: (labsResult.data || []).map(mapLabFromDb),
    inbody: inbodyRecords,
  };
}

async function upsertSupabaseRecord(collection, record) {
  const table = getSupabaseTable(collection);
  const payload = mapRecordToDb(collection, record);
  const result = await supabaseClient.from(table).upsert(payload);
  if (collection === "inbody" && isMissingInBodyTableError(result.error)) {
    throw new Error("Supabase 尚未建立 InBody 資料表，請先到 SQL Editor 重新執行最新的 supabase-schema.sql。");
  }
  handleSupabaseError(result.error);
}

async function deleteSupabaseRecord(collection, id) {
  const table = getSupabaseTable(collection);
  const result = await supabaseClient.from(table).delete().eq("id", id);
  if (collection === "inbody" && isMissingInBodyTableError(result.error)) {
    throw new Error("Supabase 尚未建立 InBody 資料表，請先到 SQL Editor 重新執行最新的 supabase-schema.sql。");
  }
  handleSupabaseError(result.error);
}

async function replaceSupabaseData(nextState) {
  const results = await Promise.all([
    supabaseClient.from("medications").delete().not("id", "is", null),
    supabaseClient.from("weights").delete().not("id", "is", null),
    supabaseClient.from("labs").delete().not("id", "is", null),
  ]);
  results.forEach((result) => handleSupabaseError(result.error));

  const inbodyDeleteResult = await supabaseClient.from("inbody").delete().not("id", "is", null);
  if (isMissingInBodyTableError(inbodyDeleteResult.error)) {
    if (nextState.inbody.length) {
      throw new Error("Supabase 尚未建立 InBody 資料表，請先到 SQL Editor 重新執行最新的 supabase-schema.sql。");
    }
  } else {
    handleSupabaseError(inbodyDeleteResult.error);
  }

  if (nextState.medications.length) {
    const result = await supabaseClient
      .from("medications")
      .insert(nextState.medications.map((item) => mapRecordToDb("medications", item)));
    handleSupabaseError(result.error);
  }

  if (nextState.weights.length) {
    const result = await supabaseClient
      .from("weights")
      .insert(nextState.weights.map((item) => mapRecordToDb("weights", item)));
    handleSupabaseError(result.error);
  }

  if (nextState.labs.length) {
    const result = await supabaseClient
      .from("labs")
      .insert(nextState.labs.map((item) => mapRecordToDb("labs", item)));
    handleSupabaseError(result.error);
  }

  if (nextState.inbody.length) {
    const result = await supabaseClient
      .from("inbody")
      .insert(nextState.inbody.map((item) => mapRecordToDb("inbody", item)));
    if (isMissingInBodyTableError(result.error)) {
      throw new Error("Supabase 尚未建立 InBody 資料表，請先到 SQL Editor 重新執行最新的 supabase-schema.sql。");
    }
    handleSupabaseError(result.error);
  }
}

function getSupabaseTable(collection) {
  return {
    medications: "medications",
    weights: "weights",
    labs: "labs",
    inbody: "inbody",
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

  if (collection === "inbody") {
    return {
      id: record.id,
      date: record.date,
      weight: record.weight,
      skeletal_muscle_mass: record.skeletalMuscleMass,
      body_fat_mass: record.bodyFatMass,
      body_fat_percentage: record.bodyFatPercentage,
      visceral_fat_area: record.visceralFatArea,
      inbody_score: record.inbodyScore,
      basal_metabolic_rate: record.basalMetabolicRate,
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
    uric_acid: record.uricAcid,
    creatinine: record.creatinine,
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
    uricAcid: Number(record.uric_acid),
    creatinine: Number(record.creatinine),
  };
}

function mapInBodyFromDb(record) {
  return {
    id: record.id,
    date: record.date,
    weight: Number(record.weight),
    skeletalMuscleMass: Number(record.skeletal_muscle_mass),
    bodyFatMass: Number(record.body_fat_mass),
    bodyFatPercentage: Number(record.body_fat_percentage),
    visceralFatArea: Number(record.visceral_fat_area),
    inbodyScore: Number(record.inbody_score),
    basalMetabolicRate: Number(record.basal_metabolic_rate),
  };
}

function handleSupabaseError(error) {
  if (error) {
    throw error;
  }
}

function isMissingInBodyTableError(error) {
  if (!error) {
    return false;
  }

  const message = String(error.message || error.details || "");
  return error.code === "42P01" || /relation .*inbody/i.test(message);
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
  return new Date(`${b.date}T${b.time || "00:00"}`) - new Date(`${a.date}T${a.time || "00:00"}`);
}

function formatDecimal(value) {
  return Number(value).toFixed(1);
}

function resetMedicationForm() {
  medicationForm.reset();
  medicationForm.elements.date.value = today;
  medicationForm.elements.time.value = nowTime;
  medicationForm.elements.dose.value = "2.5";
  injectionRegionSelect.value = "肚臍";
  syncInjectionDetailOptions("肚臍", "左側");
}

function resetWeightForm() {
  weightForm.reset();
  weightForm.elements.date.value = today;
  weightForm.elements.time.value = nowTime;
}

function resetLabsForm() {
  labsForm.reset();
  labsForm.elements.date.value = today;
}

function resetInBodyForm() {
  inbodyForm.reset();
  inbodyForm.elements.date.value = today;
}
