// 공통 UI 템플릿 (로딩, 스켈레톤, 토스트 등)
export const commonTemplates = {
  loading: (message = "상품을 불러오는 중...") => /* html */ `
    <div class="text-center py-4">
      <div class="inline-flex items-center">
        <svg class="animate-spin h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm text-gray-600">${message}</span>
      </div>
    </div>
  `,

  skeleton: (count = 4) => /* html */ `
    <div class="grid grid-cols-2 gap-4 mb-6">
      ${Array(count)
        .fill()
        .map(
          () => /* html */ `
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
          <div class="aspect-square bg-gray-200"></div>
          <div class="p-3">
            <div class="h-4 bg-gray-200 rounded mb-2"></div>
            <div class="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div class="h-5 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div class="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `,

  toast: (message, type = "success") => {
    const colors = {
      success: "bg-green-600",
      info: "bg-blue-600",
      error: "bg-red-600",
    };

    const icons = {
      success: /* html */ `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      `,
      info: /* html */ `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      `,
      error: /* html */ `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      `,
    };

    return /* html */ `
      <div class="${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 max-w-sm">
        <div class="flex-shrink-0">
          ${icons[type]}
        </div>
        <p class="text-sm font-medium">${message}</p>
        <button id="toast-close-btn" class="flex-shrink-0 ml-2 text-white hover:text-gray-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;
  },

  empty: (message = "데이터가 없습니다") => /* html */ `
    <div class="text-center py-20">
      <p class="text-gray-500">${message}</p>
    </div>
  `,

  error: (message = "오류가 발생했습니다") => /* html */ `
    <div class="text-center py-20">
      <div class="text-red-500 mb-4">
        <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <p class="text-gray-700 mb-4">${message}</p>
      <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
        다시 시도
      </button>
    </div>
  `,
};
