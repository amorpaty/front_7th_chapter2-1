// 상품 관련 템플릿
export const productTemplates = {
  card: (product) => /* html */ `
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden product-card"
         data-product-id="${product.productId}">
      <!-- 상품 이미지 -->
      <div class="aspect-square bg-gray-100 overflow-hidden cursor-pointer product-image">
        <img src="${product.image}"
             alt="${product.title}"
             class="product-image w-full h-full object-cover hover:scale-105 transition-transform duration-200"
             loading="lazy">
      </div>
      <!-- 상품 정보 -->
      <div class="p-3">
        <div class="cursor-pointer product-info mb-3">
          <h3 class="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
            ${product.title}
          </h3>
          <p class="text-xs text-gray-500 mb-2">${product.brand || ""}</p>
          <p class="text-lg font-bold text-gray-900">
            ${Number(product.lprice).toLocaleString()}원
          </p>
        </div>
        <!-- 장바구니 버튼 -->
        <button class="w-full bg-blue-600 text-white text-sm py-2 px-3 rounded-md
                       hover:bg-blue-700 transition-colors add-to-cart-btn" 
                data-product-id="${product.productId}">
          장바구니 담기
        </button>
      </div>
    </div>
  `,

  list: (products) => {
    return /* html */ `
      <div id="product-list-container">
        <div class="grid grid-cols-2 gap-4 mb-6" id="products-grid" data-testid="products-grid">
          ${
            !products || products.length === 0
              ? '<div class="col-span-2"><p class="text-center py-20 text-gray-500">상품이 없습니다</p></div>'
              : products.map((p) => productTemplates.card(p)).join("")
          }
        </div>
      </div>
    `;
  },

  appendList: (targetId, products) => {
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.insertAdjacentHTML("beforeend", products.map((p) => productTemplates.card(p)).join(""));
    }
  },

  count: (count) => /* html */ `
    <div class="mb-4 text-sm text-gray-600" data-testid="product-count">
      총 <span class="font-medium text-gray-900">${count}</span>개의 상품
    </div>
  `,

  skeletonCards: (count = 2) => /* html */ `
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
      .join("")}`,
};
