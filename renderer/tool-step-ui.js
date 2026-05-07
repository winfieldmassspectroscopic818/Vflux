"use strict";

const ToolStepUI = {
  render(resultId, summaryId, listId, kind, summary, items) {
    const result = document.getElementById(resultId);
    const title = document.getElementById(summaryId);
    const list = document.getElementById(listId);
    if (result) result.className = `result-card ${kind}`;
    if (title) title.textContent = summary;
    if (list) {
      list.innerHTML = (items || [])
        .map((item) => `<li class="${item.state || "pending"}"><span></span>${this.escape(item.text)}</li>`)
        .join("");
      this.ensureDetails(listId);
      if (window.I18n) window.I18n.apply(list);
    }
  },

  ensureDetails(listId) {
    const list = document.getElementById(listId);
    if (!list) return null;
    const prefix = listId.split("-")[0];
    const existing = document.getElementById(`${prefix}-technical-details`);
    if (existing) return existing;

    const details = document.createElement("details");
    details.id = `${prefix}-technical-details`;
    details.className = "technical-details";
    details.innerHTML = [
      "<summary>技术详情</summary>",
      `<div class="technical-meta" id="${prefix}-technical-meta">尚未运行工具</div>`,
      `<div class="technical-label">实际命令</div>`,
      `<pre class="technical-detail-command" id="${prefix}-technical-command"></pre>`,
      `<div class="technical-label">原始日志</div>`,
      `<pre class="technical-detail-log" id="${prefix}-technical-log"></pre>`,
    ].join("");
    list.insertAdjacentElement("afterend", details);
    return details;
  },

  setTechnical(prefix, data = {}) {
    this.ensureDetails(`${prefix}-feedback-list`);
    const meta = document.getElementById(`${prefix}-technical-meta`);
    const command = document.getElementById(`${prefix}-technical-command`);
    const log = document.getElementById(`${prefix}-technical-log`);
    if (meta) meta.textContent = data.meta || "";
    if (command) command.textContent = data.command || "";
    if (log && data.log !== undefined) log.textContent = data.log || "";
  },

  projectPath(relativePath) {
    const dir = (Config.getProjectDir() || ".").replace(/[\\/]$/, "");
    return `${dir}/${relativePath}`;
  },

  async existsInProject(relativePath) {
    return await window.vflux.fileExists(this.projectPath(relativePath));
  },

  appendHiddenLog(el, text) {
    if (!el) return;
    el.textContent += text;
    el.scrollTop = el.scrollHeight;
    const prefix = el.id ? el.id.split("-")[0] : "";
    const detailLog = prefix ? document.getElementById(`${prefix}-technical-log`) : null;
    if (detailLog) {
      detailLog.textContent += text;
      detailLog.scrollTop = detailLog.scrollHeight;
    }
  },

  escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },
};
