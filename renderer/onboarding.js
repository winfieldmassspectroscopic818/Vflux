"use strict";

const Onboarding = {
  init() {
    this._modal = document.getElementById("onboarding-modal");
    if (!this._modal) return;
    document.getElementById("onboarding-close")?.addEventListener("click", () => this.close(true));
    document.getElementById("onboarding-skip")?.addEventListener("click", () => this.close(true));
    document.getElementById("onboarding-done")?.addEventListener("click", () => this.close(true));
    document.getElementById("onboarding-open-toolchain")?.addEventListener("click", () => this._go("toolchain"));
    document.getElementById("onboarding-open-examples")?.addEventListener("click", () => this._go("examples"));
    document.getElementById("onboarding-new-project")?.addEventListener("click", () => {
      this.close(true);
      NewProjectModal.open();
    });
  },

  showIfNeeded() {
    if (!this._modal) return;
    if (localStorage.getItem("vflux.onboarding.done") === "true") return;
    // 语言弹窗优先，避免首次启动两个弹窗叠在一起。
    setTimeout(() => {
      const langModal = document.getElementById("language-modal");
      if (langModal && langModal.style.display !== "none") {
        setTimeout(() => this.showIfNeeded(), 600);
        return;
      }
      this._modal.style.display = "flex";
    }, 300);
  },

  close(markDone = false) {
    if (markDone && document.getElementById("onboarding-dont-show")?.checked) {
      localStorage.setItem("vflux.onboarding.done", "true");
    }
    if (this._modal) this._modal.style.display = "none";
  },

  _go(panel) {
    this.close(true);
    App.switchPanel(panel);
  },
};
