import { commonTemplates } from "../templates";

// ===== 유틸리티 함수 =====
export function showToast(message, type = "success") {
  const toastHTML = commonTemplates.toast(message, type);
  const toastContainer = document.createElement("div");
  toastContainer.className = "fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300";
  toastContainer.innerHTML = toastHTML;

  document.body.appendChild(toastContainer);

  // 닫기 버튼 이벤트
  const closeBtn = toastContainer.querySelector("#toast-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      toastContainer.remove();
    });
  }

  // 3초 후 자동 제거
  setTimeout(() => {
    toastContainer.remove();
  }, 3000);
}
