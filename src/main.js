import {
  layoutTemplates,
  searchTemplates,
  productTemplates,
  commonTemplates,
  cartTemplates,
  detailTemplates,
  notFoundTemplates,
} from "./templates/index.js";
import { showToast } from "./util/commonUtils.js";
import {
  getQueryParams,
  buildProductDetailUrl,
  getProductIdFromUrl,
  navigateTo,
  updateUrlWithFilters,
  isMainPage,
  isProductDetailPage,
} from "./util/urlUtils.js";
import { store } from "./store.js";
import { observe } from "./core/observer.js";
import { getProducts } from "./api/productApi.js";

const enableMocking = () =>
  import("./mocks/browser.js").then(({ worker }) =>
    worker.start({
      onUnhandledRequest: "bypass",
    }),
  );
// Observer 등록 여부 플래그
let observersInitialized = false;
let eventListenersInitialized = false;

async function initMain() {
  if (!observersInitialized) {
    setupObservers();
    observersInitialized = true;
  }

  store.dispatch("initCart");
  await Promise.all([navigate()]);

  // 이벤트 리스너는 한 번만 등록 (document.body에 등록되므로)
  if (!eventListenersInitialized) {
    addEventListeners();
    eventListenersInitialized = true;
  }

  // 뒤로가기 처리
  window.addEventListener("popstate", () => {
    navigate();
  });
}

// 상태 변경 감지 및 자동 렌더링 설정
function setupObservers() {
  // 상품 목록 업데이트 관찰
  observe(() => {
    const productListContainer = document.getElementById("product-list-container");
    if (productListContainer && store.state.products) {
      const content = `
        ${productTemplates.list(store.state.products)}
        `;
      productListContainer.innerHTML = content;
    }
  });

  // 상품 개수 업데이트 관찰
  observe(() => {
    const countElement = document.querySelector('[data-testid="product-count"]');
    if (countElement && store.state.totalCount !== undefined) {
      countElement.innerHTML = `총 <span class="font-medium text-gray-900">${store.state.totalCount}</span>개의 상품`;
    }
  });

  // 장바구니 아이콘 업데이트 관찰
  observe(() => {
    const cart = store.state.cart;
    const cartIconBtn = document.getElementById("cart-icon-btn");

    if (cartIconBtn) {
      const existingBadge = cartIconBtn.querySelector("span");
      if (existingBadge) {
        if (cart.length > 0) {
          existingBadge.textContent = cart.length;
        } else {
          existingBadge.remove();
        }
      } else if (!existingBadge && cart.length > 0) {
        const badgeHTML = `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">${cart.length}</span>`;
        cartIconBtn.insertAdjacentHTML("beforeend", badgeHTML);
      }
    }
  });

  // 카테고리 필터 업데이트 관찰
  observe(() => {
    const targetDiv = document.getElementById("category-filters");
    const categoryBreadcrumb = document.getElementById("category-breadcrumb");

    if (categoryBreadcrumb && store.state.filters) {
      categoryBreadcrumb.innerHTML = searchTemplates.breadcrumb(
        store.state.filters.category1,
        store.state.filters.category2,
      );
    }

    if (targetDiv && store.state.categories && store.state.filters) {
      const filters = store.state.filters;
      let categories = {};

      if (!filters.category1) {
        categories = store.state.categories;
        targetDiv.innerHTML = Object.keys(categories)
          .map((category) => searchTemplates.categoryButton1(category, false))
          .join("");
      } else {
        categories = store.state.categories[filters.category1];

        store.commit("SET_FILTERS", {
          categories: Object.keys(categories),
          category1: filters.category1,
          category2: filters.category2,
        });

        targetDiv.innerHTML = Object.keys(categories)
          .map((category) =>
            searchTemplates.categoryButton2(filters.category1, category, category === filters.category2),
          )
          .join("");
      }
    }
  });
}

async function navigate() {
  try {
    // 메인 페이지 (루트 경로, 쿼리 없음)
    if (isMainPage() && !window.location.search) {
      showLoadingState();

      await Promise.all([store.dispatch("loadCategories"), store.dispatch("loadProducts")]);
      renderMainPage();

      // 메인 페이지 (필터 적용)
    } else if (isMainPage() && window.location.search) {
      const params = getQueryParams();

      // 로딩 상태 표시
      showLoadingState();

      await store.dispatch("loadCategories");

      // URL에서 필터 파라미터 추출
      const filters = {
        category1: params.category1 || "",
        category2: params.category2 || "",
        sort: params.sort || "price_asc",
        limit: params.limit ? parseInt(params.limit, 10) : 20,
        search: params.search || "",
      };

      // category1이 있으면 해당 카테고리의 서브 카테고리 목록을 가져옴
      if (filters.category1 && store.state.categories[filters.category1]) {
        filters.categories = Object.keys(store.state.categories[filters.category1]);
      }

      store.commit("SET_FILTERS", filters);
      await store.dispatch("loadProducts");
      renderMainPage();

      // 상품 상세 페이지
    } else if (isProductDetailPage()) {
      const productId = getProductIdFromUrl();

      // 로딩 상태 표시
      showDetailLoadingState();

      await store.dispatch("loadCategories");
      await store.dispatch("loadProducts");
      await store.dispatch("loadDetailProduct", productId);
      await loadRelatedProducts(productId);
      renderProductDetailPage();

      // 404 페이지
    } else {
      render404Page();
    }
  } catch (error) {
    console.error("초기화 실패:", error);
    renderError("데이터를 불러오는데 실패했습니다.");
  }
}

// 로딩 상태 표시 (메인 페이지)
function showLoadingState() {
  const loadingHTML = layoutTemplates.page(
    /* html */ `
      <div class="min-h-screen bg-gray-50">
        <!-- 필터 스켈레톤 -->
        <div class="bg-white border-b border-gray-200 mb-6">
          <div class="max-w-7xl mx-auto px-4 py-6">
            <div class="h-10 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div class="flex gap-2">
              <div class="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
              <div class="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
              <div class="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
        
        <!-- 상품 목록 스켈레톤 -->
        <div class="max-w-7xl mx-auto px-4">
          ${commonTemplates.skeleton(8)}
        </div>
      </div>
    `,
    0,
  );

  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = loadingHTML;
  } else {
    document.body.innerHTML = loadingHTML;
  }
}

// 로딩 상태 표시 (상세 페이지)
function showDetailLoadingState() {
  const loadingHTML = layoutTemplates.page(
    /* html */ `
      <div class="min-h-screen bg-gray-50 py-6">
        <div class="max-w-4xl mx-auto px-4">
          <div class="bg-white rounded-lg shadow-sm p-6 mb-6 animate-pulse">
            <div class="aspect-square bg-gray-200 rounded-lg mb-4"></div>
            <div class="h-8 bg-gray-200 rounded mb-4"></div>
            <div class="h-4 bg-gray-200 rounded mb-2"></div>
            <div class="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
            <div class="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    `,
    0,
  );

  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = loadingHTML;
  } else {
    document.body.innerHTML = loadingHTML;
  }
}

function renderMainPage() {
  const mainPageHTML = layoutTemplates.page(
    searchTemplates.filterBox(store.state.filters) +
      productTemplates.count(store.state.totalCount) +
      productTemplates.list(store.state.products),
    store.state.cart.length,
  );

  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = mainPageHTML;
  } else {
    document.body.innerHTML = mainPageHTML;
  }

  const cartIconBtn = document.getElementById("cart-icon-btn");
  if (cartIconBtn && store.state.cart.length > 0) {
    const badgeHTML = `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">${store.state.cart.length}</span>`;
    cartIconBtn.insertAdjacentHTML("beforeend", badgeHTML);
  }
}

// 관련 상품 정보 (store에 action이 없어서 직접 구현)
async function loadRelatedProducts(productId = "") {
  try {
    const response = await getProducts({ category2: store.state.detailProduct.category2 });
    store.commit(
      "SET_RELATED_PRODUCTS",
      response.products.filter((p) => p.productId !== productId),
    );
  } catch (error) {
    console.error("관련 상품 정보 로딩 실패:", error);
  }
}

// 상세페이지 렌더링
function renderProductDetailPage() {
  const pageHTML = detailTemplates.page(store.state.detailProduct, store.state.relatedProducts);

  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = pageHTML;
  } else {
    document.body.innerHTML = pageHTML;
  }

  const cartIconBtn = document.getElementById("cart-icon-btn");
  if (cartIconBtn && store.state.cart.length > 0) {
    const badgeHTML = `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">${store.state.cart.length}</span>`;
    cartIconBtn.insertAdjacentHTML("beforeend", badgeHTML);
  }
}

// 404 페이지 렌더링
function render404Page() {
  const content = notFoundTemplates.page();
  const pageHTML = layoutTemplates.page(content);

  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = pageHTML;
  } else {
    document.body.innerHTML = pageHTML;
  }
}

// 다음 상품 가져올 떄 스켈레톤 보여주기
function showInfiniteScrollLoader() {
  const productsGrid = document.getElementById("products-grid");
  if (productsGrid) {
    const loaderHTML = /* html */ `
      <div class="col-span-2" id="infinite-scroll-loader">
        ${commonTemplates.loading("상품을 더 불러오는 중...")}
        <div class="grid grid-cols-2 gap-4 mt-4">
          ${productTemplates.skeletonCards(store.state.filters.limit)}
        </div>
      </div>
    `;
    productsGrid.insertAdjacentHTML("beforeend", loaderHTML);
  }
}

// 스켈레톤 제거
function removeInfiniteScrollLoader() {
  const loadingIndicator = document.getElementById("infinite-scroll-loader");
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
}

// 에러 렌더링
function renderError(message) {
  const content = commonTemplates.error(message);
  document.body.innerHTML = layoutTemplates.page(content);
}

// 장바구니 모달 열기
async function openCartModal() {
  console.log("🛒 장바구니 모달 열기 시작");

  // 기존 모달이 있으면 제거
  const existingModal = document.querySelector(".cart-modal-overlay");
  if (existingModal) {
    existingModal.remove();
  }

  // 장바구니 데이터 가져오기 (이제 전체 상품 정보가 저장되어 있음)
  const cart = store.state.cart;
  console.log("📦 장바구니:", cart);

  // cart에 이미 모든 정보가 있으므로 그대로 사용
  const cartItems = cart.map((item) => ({
    id: item.productId,
    name: item.name,
    price: item.price,
    image: item.image,
    quantity: item.quantity,
    selected: item.selected || false,
  }));
  const modalHTML = cartTemplates.modal(cartItems);

  const root = document.getElementById("root");
  const target = root || document.body;
  target.insertAdjacentHTML("beforeend", modalHTML);

  // body 스크롤 막기
  document.body.style.overflow = "hidden";
  console.log("✨ 모달이 DOM에 추가됨");

  // 모달 이벤트 리스너 등록
  setupCartModalEventListeners();
}

// 장바구니 아이템 수량 업데이트 (모달 내 DOM 직접 수정)
function updateCartItemQuantityInModal(productId, newQuantity) {
  // 수량 input 업데이트
  const quantityInput = document.querySelector(`.quantity-input[data-product-id="${productId}"]`);
  if (quantityInput) {
    quantityInput.value = newQuantity;
  }

  // 해당 아이템의 가격 업데이트
  const cartItem = store.state.cart.find((item) => item.productId === productId);
  if (cartItem) {
    const priceElement = document.querySelector(`.cart-item[data-product-id="${productId}"] .cart-item-total-price`);
    if (priceElement) {
      priceElement.textContent = `${(cartItem.price * newQuantity).toLocaleString()}원`;
    }
  }

  // 총 금액 업데이트
  updateCartTotalInModal();
}

// 장바구니 모달의 총 금액 업데이트
function updateCartTotalInModal() {
  const total = store.state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalElement = document.querySelector(".cart-modal-total-price");
  if (totalElement) {
    totalElement.textContent = `${total.toLocaleString()}원`;
  }

  // 선택된 아이템의 총 금액도 업데이트
  const selectedCheckboxes = document.querySelectorAll(".cart-item-checkbox:checked");
  if (selectedCheckboxes.length > 0) {
    let selectedTotal = 0;
    selectedCheckboxes.forEach((checkbox) => {
      const productId = checkbox.getAttribute("data-product-id");
      const item = store.state.cart.find((i) => i.productId === productId);
      if (item) {
        selectedTotal += item.price * item.quantity;
      }
    });

    const selectedTotalElement = document.querySelector(".cart-modal-selected-total");
    if (selectedTotalElement) {
      selectedTotalElement.textContent = `${selectedTotal.toLocaleString()}원`;
    }
  }
}

// 장바구니 모달을 빈 상태로 업데이트
function updateCartModalToEmpty() {
  const modal = document.querySelector(".cart-modal");
  if (!modal) return;

  // 모달 내부를 빈 장바구니 템플릿으로 교체
  const emptyContent = /* html */ `
    <!-- 헤더 -->
    <div class="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
      <h2 class="text-lg font-bold text-gray-900 flex items-center">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"></path>
        </svg>
        장바구니 
      </h2>
      <button id="cart-modal-close-btn" class="text-gray-400 hover:text-gray-600 p-1">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
    
    <!-- 컨텐츠 -->
    <div class="flex flex-col max-h-[calc(90vh-120px)]">
      <!-- 빈 장바구니 -->
      <div class="flex-1 flex items-center justify-center p-8">
        <div class="text-center">
          <div class="text-gray-400 mb-4">
            <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">장바구니가 비어있습니다</h3>
          <p class="text-gray-600">원하는 상품을 담아보세요!</p>
        </div>
      </div>
    </div>
  `;

  modal.innerHTML = emptyContent;

  // 닫기 버튼 이벤트 리스너 다시 등록
  const closeBtn = document.getElementById("cart-modal-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeCartModal);
  }
}

// 장바구니 모달 닫기
function closeCartModal() {
  const modal = document.querySelector(".cart-modal-overlay");
  if (modal) {
    modal.remove();
  }

  // body 스크롤 복원
  document.body.style.overflow = "";
}

// 선택 상품 삭제 버튼 동적 업데이트
function updateRemoveSelectedButton() {
  const selectedCheckboxes = document.querySelectorAll(".cart-item-checkbox:checked");
  const selectedCount = selectedCheckboxes.length;

  console.log("🔧 updateRemoveSelectedButton 호출됨 - 선택된 개수:", selectedCount);

  // 기존 버튼 찾기
  let removeSelectedBtn = document.getElementById("cart-modal-remove-selected-btn");
  const actionButtonsContainer = document.querySelector(".cart-modal .sticky.bottom-0 .space-y-2");

  if (!actionButtonsContainer) {
    console.error("❌ actionButtonsContainer를 찾을 수 없음");
    return;
  }

  if (selectedCount > 0) {
    console.log("✅ 선택된 항목 있음 - 버튼/금액 표시");
    // 선택된 항목이 있으면 버튼 표시
    if (!removeSelectedBtn) {
      // 버튼이 없으면 생성
      const buttonHTML = /* html */ `
        <button id="cart-modal-remove-selected-btn" 
                class="w-full bg-red-600 text-white py-2 px-4 rounded-md 
                       hover:bg-red-700 transition-colors text-sm">
          선택한 상품 삭제 (${selectedCount}개)
        </button>
      `;
      actionButtonsContainer.insertAdjacentHTML("afterbegin", buttonHTML);

      // 이벤트 리스너 등록
      removeSelectedBtn = document.getElementById("cart-modal-remove-selected-btn");
      if (removeSelectedBtn) {
        removeSelectedBtn.addEventListener("click", handleRemoveSelectedItems);
      }
    } else {
      // 버튼이 있으면 텍스트만 업데이트
      removeSelectedBtn.textContent = `선택한 상품 삭제 (${selectedCount}개)`;
    }

    // 선택된 상품의 총 금액 표시/업데이트
    updateSelectedItemsTotal(selectedCheckboxes);
  } else {
    console.log("❌ 선택된 항목 없음 - 버튼/금액 제거");
    // 선택된 항목이 없으면 버튼 제거
    if (removeSelectedBtn) {
      console.log("🗑️ 선택 삭제 버튼 제거");
      removeSelectedBtn.remove();
    }

    // 선택된 상품 총 금액 표시 제거
    const selectedTotalDiv = document.querySelector(".cart-modal .selected-items-total");
    if (selectedTotalDiv) {
      console.log("🗑️ 선택된 상품 금액 표시 제거");
      selectedTotalDiv.remove();
    }
  }
}

// 선택된 상품의 총 금액 업데이트
function updateSelectedItemsTotal(selectedCheckboxes) {
  let selectedTotal = 0;
  selectedCheckboxes.forEach((checkbox) => {
    const productId = checkbox.getAttribute("data-product-id");
    const item = store.state.cart.find((i) => i.productId === productId);
    if (item) {
      selectedTotal += item.price * item.quantity;
    }
  });

  const totalElement = document.querySelector(".cart-modal .sticky.bottom-0");
  if (!totalElement) return;

  let selectedTotalDiv = totalElement.querySelector(".selected-items-total");

  if (!selectedTotalDiv) {
    // 선택된 상품 총 금액 표시가 없으면 생성
    const totalAmountDiv = totalElement.querySelector(".flex.justify-between.items-center.mb-4");
    if (totalAmountDiv) {
      const selectedHTML = /* html */ `
        <div class="flex justify-between items-center mb-3 text-sm selected-items-total">
          <span class="text-gray-600">선택한 상품 (${selectedCheckboxes.length}개)</span>
          <span class="font-medium cart-modal-selected-total">${selectedTotal.toLocaleString()}원</span>
        </div>
      `;
      totalAmountDiv.insertAdjacentHTML("beforebegin", selectedHTML);
    }
  } else {
    // 이미 있으면 업데이트
    const countSpan = selectedTotalDiv.querySelector(".text-gray-600");
    const priceSpan = selectedTotalDiv.querySelector(".cart-modal-selected-total");
    if (countSpan) countSpan.textContent = `선택한 상품 (${selectedCheckboxes.length}개)`;
    if (priceSpan) priceSpan.textContent = `${selectedTotal.toLocaleString()}원`;
  }
}

// 선택된 상품 삭제 핸들러
function handleRemoveSelectedItems() {
  const selectedCheckboxes = document.querySelectorAll(".cart-item-checkbox:checked");
  if (selectedCheckboxes.length > 0) {
    const count = selectedCheckboxes.length;

    // 1. 스토어에서 삭제
    selectedCheckboxes.forEach((checkbox) => {
      const productId = checkbox.getAttribute("data-product-id");
      store.commit("REMOVE_FROM_CART", productId);
    });
    window.localStorage.setItem("shopping_cart", JSON.stringify(store.state.cart));

    // 2. DOM 업데이트
    if (store.state.cart.length === 0) {
      // 장바구니가 비었으면 빈 화면으로
      updateCartModalToEmpty();
    } else {
      // 아이템이 남아있으면 해당 아이템만 DOM에서 제거
      selectedCheckboxes.forEach((checkbox) => {
        const productId = checkbox.getAttribute("data-product-id");
        const cartItemElement = document.querySelector(`.cart-item[data-product-id="${productId}"]`);
        if (cartItemElement) {
          cartItemElement.remove();
        }
      });
      // 총 금액 업데이트
      updateCartTotalInModal();
      // 선택 버튼 제거
      updateRemoveSelectedButton();
    }

    // 3. 토스트 메시지
    showToast(`${count}개 상품이 삭제되었습니다.`, "info");
  }
}

// 장바구니 모달 이벤트 리스너
function setupCartModalEventListeners() {
  // 닫기 버튼
  const closeBtn = document.getElementById("cart-modal-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeCartModal);
  }

  // 오버레이 클릭 시 닫기
  const overlay = document.querySelector(".cart-modal-overlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeCartModal();
      }
    });
  }

  // ESC 키로 닫기
  const handleEsc = (e) => {
    if (e.key === "Escape") {
      closeCartModal();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  // 체크박스 - getAttribute/setAttribute 사용!
  const modal = document.querySelector(".cart-modal");
  if (modal) {
    // 전체 선택 체크박스 이벤트
    const selectAllCheckbox = modal.querySelector("#cart-modal-select-all-checkbox");
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener("change", () => {
        console.log("🎯 전체 선택 change 이벤트! checked:", selectAllCheckbox.checked);
        setTimeout(() => {
          const isChecked = selectAllCheckbox.checked;

          // store 업데이트
          store.commit("SELECT_ALL_CART_ITEMS", isChecked);
          window.localStorage.setItem("shopping_cart", JSON.stringify(store.state.cart));

          // DOM 업데이트
          const itemCheckboxes = modal.querySelectorAll(".cart-item-checkbox");
          itemCheckboxes.forEach((checkbox) => {
            checkbox.checked = isChecked;
          });

          updateRemoveSelectedButton();
        }, 10);
      });
    }

    // 개별 체크박스 change 이벤트 등록
    const itemCheckboxes = modal.querySelectorAll(".cart-item-checkbox");
    itemCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        console.log("✅ 개별 change 이벤트!", checkbox.checked);
        setTimeout(() => {
          const productId = checkbox.getAttribute("data-product-id");
          const isChecked = checkbox.checked;

          // store 업데이트
          store.commit("SET_CART_ITEM_SELECTED", { productId, selected: isChecked });
          window.localStorage.setItem("shopping_cart", JSON.stringify(store.state.cart));

          // 전체 선택 체크박스 상태 업데이트
          const selectAll = modal.querySelector("#cart-modal-select-all-checkbox");
          const allCheckboxes = modal.querySelectorAll(".cart-item-checkbox");
          const checkedCount = Array.from(allCheckboxes).filter((cb) => cb.checked).length;

          if (selectAll && allCheckboxes.length > 0) {
            selectAll.checked = checkedCount === allCheckboxes.length && checkedCount > 0;
          }

          updateRemoveSelectedButton();
        }, 10);
      });
    });

    // setInterval로도 감시 (백업)
    const observer = setInterval(() => {
      const modal = document.querySelector(".cart-modal");
      if (!modal) {
        clearInterval(observer);
        return;
      }

      // 전체 선택 체크박스 상태 동기화
      const selectAll = modal.querySelector("#cart-modal-select-all-checkbox");
      const allCheckboxes = modal.querySelectorAll(".cart-item-checkbox");
      const checkedCount = Array.from(allCheckboxes).filter((cb) => cb.checked).length;

      if (selectAll && allCheckboxes.length > 0) {
        const shouldBeChecked = checkedCount === allCheckboxes.length && checkedCount > 0;
        if (shouldBeChecked) {
          selectAll.setAttribute("checked", "");
          selectAll.checked = true;
        } else {
          selectAll.removeAttribute("checked");
          selectAll.checked = false;
        }
      }

      updateRemoveSelectedButton();
    }, 100);
  }

  // 상품 삭제 버튼
  document.querySelectorAll(".cart-item-remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const productId = e.target.getAttribute("data-product-id");

      // 1. 스토어에서 삭제
      store.commit("REMOVE_FROM_CART", productId);
      window.localStorage.setItem("shopping_cart", JSON.stringify(store.state.cart));

      // 2. DOM 업데이트
      if (store.state.cart.length === 0) {
        // 장바구니가 비었으면 빈 화면으로
        updateCartModalToEmpty();
      } else {
        // 아이템이 남아있으면 해당 아이템만 DOM에서 제거
        const cartItemElement = document.querySelector(`.cart-item[data-product-id="${productId}"]`);
        if (cartItemElement) {
          cartItemElement.remove();
        }
        // 총 금액 업데이트
        updateCartTotalInModal();
      }

      // 3. 토스트 메시지
      showToast("장바구니에서 제거되었습니다.", "info");
    });
  });

  // 전체 비우기 버튼
  const clearCartBtn = document.getElementById("cart-modal-clear-cart-btn");
  if (clearCartBtn) {
    clearCartBtn.addEventListener("click", () => {
      store.commit("SET_CART", []);
      window.localStorage.setItem("shopping_cart", JSON.stringify([]));

      // 2. DOM 업데이트
      // 장바구니가 비었으면 빈 화면으로
      updateCartModalToEmpty();
      showToast("장바구니가 비워졌습니다.", "info");
    });
  }

  // 선택 상품 삭제 버튼 (페이지 로드 시 이미 있는 경우)
  const removeSelectedBtn = document.getElementById("cart-modal-remove-selected-btn");
  if (removeSelectedBtn) {
    removeSelectedBtn.addEventListener("click", handleRemoveSelectedItems);
  }

  // 장바구니 모달에서 수량 증가/감소 버튼
  document.querySelectorAll(".quantity-increase-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      const productId = button.getAttribute("data-product-id");
      const cartItem = store.state.cart.find((item) => item.productId === productId);
      if (cartItem) {
        const newQuantity = cartItem.quantity + 1;
        store.commit("UPDATE_CART_ITEM", { productId, quantity: newQuantity });
        window.localStorage.setItem("shopping_cart", JSON.stringify(store.state.cart));
        updateCartItemQuantityInModal(productId, newQuantity);
      }
    });
  });

  document.querySelectorAll(".quantity-decrease-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      const productId = button.getAttribute("data-product-id");
      const cartItem = store.state.cart.find((item) => item.productId === productId);
      if (cartItem && cartItem.quantity > 1) {
        const newQuantity = cartItem.quantity - 1;
        store.commit("UPDATE_CART_ITEM", { productId, quantity: newQuantity });
        window.localStorage.setItem("shopping_cart", JSON.stringify(store.state.cart));

        // DOM 직접 업데이트 (모달 새로고침 없이)
        updateCartItemQuantityInModal(productId, newQuantity);
      }
    });
  });

  // 구매하기 버튼
  const checkoutBtn = document.getElementById("cart-modal-checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      showToast("구매 기능은 준비 중입니다.", "info");
    });
  }

  // 상품 이미지/제목 클릭 시 상세페이지로 이동
  document.querySelectorAll(".cart-item-image, .cart-item-title").forEach((element) => {
    element.addEventListener("click", (e) => {
      const productId = e.target.getAttribute("data-product-id");
      closeCartModal();
      navigateTo(buildProductDetailUrl(productId));
      navigate();
    });
  });
}

// 이벤트 등록
function addEventListeners() {
  // 장바구니 아이콘 클릭 이벤트
  document.body.addEventListener("click", (event) => {
    if (event.target.closest("#cart-icon-btn")) {
      console.log("🛒 장바구니 아이콘 클릭됨!");
      event.preventDefault();
      event.stopPropagation();
      openCartModal();
    }
  });

  // 검색 입력 이벤트 (이벤트 위임 사용)
  document.body.addEventListener("keydown", async (event) => {
    if (event.target.matches("#search-input") && event.key === "Enter") {
      event.preventDefault();
      const searchTerm = event.target.value.trim();
      store.commit("SET_CURRENT_PAGE", 1);
      store.commit("SET_FILTERS", { search: searchTerm });
      updateUrlWithFilters(store.state.filters);

      await store.dispatch("loadProducts");
    }
  });

  // 카테고리 필터 버튼 클릭 이벤트
  document.body.addEventListener("click", async (event) => {
    event.stopPropagation();

    if (event.target.matches(".category-filter-btn")) {
      store.commit("SET_CURRENT_PAGE", 1);

      let category1 = "";
      let category2 = "";

      if (event.target.getAttribute("data-category1") && !event.target.getAttribute("data-category2")) {
        category1 = event.target.textContent.trim();
      } else if (event.target.getAttribute("data-category2")) {
        category1 = event.target.getAttribute("data-category1");
        category2 = event.target.textContent.trim();
      }

      store.commit("SET_FILTERS", { category1, category2 });

      updateUrlWithFilters(store.state.filters);

      await store.dispatch("loadProducts");
    }
  });

  // 전체 / 카테고리 클릭 시 리셋
  document.body.addEventListener("click", async (event) => {
    if (
      event.target.matches("button[data-breadcrumb='reset']") ||
      event.target.matches("button[data-breadcrumb='category1']")
    ) {
      event.stopPropagation();

      store.commit("SET_FILTERS", {
        category1: event.target.getAttribute("data-category1") || "",
        category2: "",
      });

      store.commit("SET_CURRENT_PAGE", 1);

      updateUrlWithFilters(store.state.filters);
      await store.dispatch("loadProducts");
    }
  });

  // 페이지당 상품 수 변경 이벤트 (이벤트 위임 사용)
  document.body.addEventListener("change", async (event) => {
    if (event.target.matches("#limit-select")) {
      event.stopPropagation();

      const newLimit = parseInt(event.target.value, 10);
      store.commit("SET_FILTERS", { limit: newLimit });
      store.commit("SET_CURRENT_PAGE", 1);

      updateUrlWithFilters(store.state.filters);
      await store.dispatch("loadProducts");
    }
  });

  // 정렬 변경 이벤트 (이벤트 위임 사용)
  document.body.addEventListener("change", async (event) => {
    if (event.target.matches("#sort-select")) {
      event.stopPropagation();

      const newSort = event.target.value;
      store.commit("SET_FILTERS", { sort: newSort });
      store.commit("SET_CURRENT_PAGE", 1);

      updateUrlWithFilters(store.state.filters);
      await store.dispatch("loadProducts");
    }
  });

  // 장바구니 담기 이벤트
  document.body.addEventListener("click", (event) => {
    event.stopPropagation();

    if (event.target.matches(".add-to-cart-btn") || event.target.matches("#add-to-cart-btn")) {
      const productId = event.target.getAttribute("data-product-id");

      // 상품 정보 찾기
      let product = store.state.products.find((p) => p.productId === productId);
      if (!product && store.state.detailProduct.productId === productId) {
        product = store.state.detailProduct;
      }
      if (!product) {
        product = store.state.relatedProducts.find((p) => p.productId === productId);
      }

      if (!product) {
        showToast("상품 정보를 찾을 수 없습니다.", "error");
        return;
      }

      // 상세페이지에서는 수량 정보를 확인
      const quantityInput = document.getElementById("quantity-input");
      let quantity = 1;

      if (quantityInput) {
        quantity = parseInt(quantityInput.value, 10);
        if (isNaN(quantity) || quantity < 1) {
          quantity = 1;
        }
      }

      const success = store.dispatch("addToCart", { productId, quantity, product });
      if (success) {
        const message = "장바구니에 추가되었습니다.";
        showToast(message, "success");

        // 상세페이지에서는 수량을 1로 리셋
        if (quantityInput) {
          quantityInput.value = 1;
        }
      }
    }
  });

  // 상세페이지 이동 이벤트
  document.body.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (event.target.offsetParent?.matches(".product-card") && !event.target.matches(".add-to-cart-btn")) {
      const productId = event.target.offsetParent.getAttribute("data-product-id");
      navigateTo(buildProductDetailUrl(productId));
      navigate();
    }
  });

  // 상세페이지에서 메인으로 이동 이벤트
  document.body.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.target.parentElement.matches("#back-button")) {
      store.commit("SET_CURRENT_PAGE", 1);
      navigateTo("/");
      navigate();
    }
  });

  // 관련 상품 상세페이지 이동 이벤트
  document.body.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (event.target.offsetParent?.matches(".related-product-card")) {
      const productId = event.target.offsetParent.getAttribute("data-product-id");
      navigateTo(buildProductDetailUrl(productId));
      navigate();
    }
  });

  // 상세페이지 수량 증가/감소 이벤트
  document.body.addEventListener("click", (event) => {
    event.stopPropagation();

    const quantityInput = document.getElementById("quantity-input");
    if (!quantityInput) return; // 상세페이지가 아니면 무시

    if (event.target.matches("#quantity-increase") || event.target.closest("#quantity-increase")) {
      const currentValue = parseInt(quantityInput.value, 10);
      const maxValue = parseInt(quantityInput.max, 10);

      if (currentValue < maxValue) {
        quantityInput.value = currentValue + 1;
      } else {
        showToast(`재고는 최대 ${maxValue}개입니다.`, "info");
      }
    } else if (event.target.matches("#quantity-decrease") || event.target.closest("#quantity-decrease")) {
      const currentValue = parseInt(quantityInput.value, 10);
      const minValue = parseInt(quantityInput.min, 10);

      if (currentValue > minValue) {
        quantityInput.value = currentValue - 1;
      }
    }
  });

  // 상세페이지 수량 input 직접 입력 시 유효성 검증
  document.body.addEventListener("input", (event) => {
    if (event.target.matches("#quantity-input")) {
      const input = event.target;
      const value = parseInt(input.value, 10);
      const min = parseInt(input.min, 10);
      const max = parseInt(input.max, 10);

      // 숫자가 아닌 경우 최소값으로 설정
      if (isNaN(value)) {
        input.value = min;
        return;
      }

      // 최소값보다 작으면 최소값으로 설정
      if (value < min) {
        input.value = min;
      }

      // 최대값보다 크면 최대값으로 설정
      if (value > max) {
        input.value = max;
        showToast(`재고는 최대 ${max}개입니다.`, "info");
      }
    }
  });

  // 상품 목록으로 돌아가기 이벤트
  document.body.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.target.matches(".go-to-product-list")) {
      store.commit("SET_FILTERS", { search: "" });
      store.commit("SET_CURRENT_PAGE", 1);
      updateUrlWithFilters(store.state.filters);
      navigate();
    }
  });

  // 브레드크럼으로 카테고리 이동 이벤트
  document.body.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.target.matches(".breadcrumb-link")) {
      const category1 = event.target.getAttribute("data-category1") || "";
      const category2 = event.target.getAttribute("data-category2") || "";
      store.commit("SET_FILTERS", { category1, category2, search: "", sort: "", limit: "" });
      store.commit("SET_CURRENT_PAGE", 1);

      updateUrlWithFilters(store.state.filters);
      navigate();
    }
  });

  // 무한 스크롤 이벤트
  window.addEventListener("scroll", async () => {
    const { scrollTop, clientHeight, scrollHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      // 100px 남았을 때 다음 페이지 로드
      if (store.state.hasNext && !store.state.isLoading) {
        store.commit("SET_CURRENT_PAGE", store.state.currentPage + 1);
        showInfiniteScrollLoader();
        await store.dispatch("loadProducts");
        removeInfiniteScrollLoader();
      }
    }
  });
}

function main() {
  // 템플릿 사용 예시
  console.log("템플릿이 로드되었습니다!");

  const 상품목록_레이아웃_로딩 = /* html */ `
    <div class="min-h-screen bg-gray-50">
      <header class="bg-white shadow-sm sticky top-0 z-40">
        <div class="max-w-md mx-auto px-4 py-4">
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-bold text-gray-900">
              <a href="/" data-link="">쇼핑몰</a>
            </h1>
            <div class="flex items-center space-x-2">
              <!-- 장바구니 아이콘 -->
              <button id="cart-icon-btn" class="relative p-2 text-gray-700 hover:text-gray-900 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main class="max-w-md mx-auto px-4 py-4">
        <!-- 검색 및 필터 -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <!-- 검색창 -->
          <div class="mb-4">
            <div class="relative">
              <input type="text" id="search-input" placeholder="상품명을 검색해보세요..." value="" class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg
                          focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>
          </div>
          <!-- 필터 옵션 -->
          <div class="space-y-3">
            <!-- 카테고리 필터 -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-600">카테고리:</label>
                <button data-breadcrumb="reset" class="text-xs hover:text-blue-800 hover:underline">전체</button>
              </div>
              <!-- 1depth 카테고리 -->
              <div class="flex flex-wrap gap-2">
                <div class="text-sm text-gray-500 italic">카테고리 로딩 중...</div>
              </div>
              <!-- 2depth 카테고리 -->
            </div>
            <!-- 기존 필터들 -->
            <div class="flex gap-2 items-center justify-between">
              <!-- 페이지당 상품 수 -->
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-600">개수:</label>
                <select id="limit-select"
                        class="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                  <option value="10">
                    10개
                  </option>
                  <option value="20" selected="">
                    20개
                  </option>
                  <option value="50">
                    50개
                  </option>
                  <option value="100">
                    100개
                  </option>
                </select>
              </div>
              <!-- 정렬 -->
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-600">정렬:</label>
                <select id="sort-select" class="text-sm border border-gray-300 rounded px-2 py-1
                             focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                  <option value="price_asc" selected="">가격 낮은순</option>
                  <option value="price_desc">가격 높은순</option>
                  <option value="name_asc">이름순</option>
                  <option value="name_desc">이름 역순</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <!-- 상품 목록 -->
        <div class="mb-6">
          <div>
            <!-- 상품 그리드 -->
            <div class="grid grid-cols-2 gap-4 mb-6" id="products-grid">
              <!-- 로딩 스켈레톤 -->
              <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
                <div class="aspect-square bg-gray-200"></div>
                <div class="p-3">
                  <div class="h-4 bg-gray-200 rounded mb-2"></div>
                  <div class="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div class="h-5 bg-gray-200 rounded w-1/2 mb-3"></div>
                  <div class="h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
                <div class="aspect-square bg-gray-200"></div>
                <div class="p-3">
                  <div class="h-4 bg-gray-200 rounded mb-2"></div>
                  <div class="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div class="h-5 bg-gray-200 rounded w-1/2 mb-3"></div>
                  <div class="h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
                <div class="aspect-square bg-gray-200"></div>
                <div class="p-3">
                  <div class="h-4 bg-gray-200 rounded mb-2"></div>
                  <div class="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div class="h-5 bg-gray-200 rounded w-1/2 mb-3"></div>
                  <div class="h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
                <div class="aspect-square bg-gray-200"></div>
                <div class="p-3">
                  <div class="h-4 bg-gray-200 rounded mb-2"></div>
                  <div class="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div class="h-5 bg-gray-200 rounded w-1/2 mb-3"></div>
                  <div class="h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
            
            <div class="text-center py-4">
              <div class="inline-flex items-center">
                <svg class="animate-spin h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-sm text-gray-600">상품을 불러오는 중...</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer class="bg-white shadow-sm sticky top-0 z-40">
        <div class="max-w-md mx-auto py-8 text-center text-gray-500">
          <p>© 2025 항해플러스 프론트엔드 쇼핑몰</p>
        </div>
      </footer>
    </div>
  `;

  const 상품목록_레이아웃_로딩완료 = `
    <div class="bg-gray-50">
      <header class="bg-white shadow-sm sticky top-0 z-40">
        <div class="max-w-md mx-auto px-4 py-4">
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-bold text-gray-900">
              <a href="/" data-link="">쇼핑몰</a>
            </h1>
            <div class="flex items-center space-x-2">
              <!-- 장바구니 아이콘 -->
              <button id="cart-icon-btn" class="relative p-2 text-gray-700 hover:text-gray-900 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"></path>
                </svg>
                <span
                  class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">4</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main class="max-w-md mx-auto px-4 py-4">
        <!-- 검색 및 필터 -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <!-- 검색창 -->
          <div class="mb-4">
            <div class="relative">
              <input type="text" id="search-input" placeholder="상품명을 검색해보세요..." value="" class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg
                          focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>
          </div>
          <!-- 필터 옵션 -->
          <div class="space-y-3">
            <!-- 카테고리 필터 -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-600">카테고리:</label>
                <button data-breadcrumb="reset" class="text-xs hover:text-blue-800 hover:underline">전체</button>
              </div>
              <!-- 1depth 카테고리 -->
              <div class="flex flex-wrap gap-2">
                <button data-category1="생활/건강" class="category1-filter-btn text-left px-3 py-2 text-sm rounded-md border transition-colors
                   bg-white border-gray-300 text-gray-700 hover:bg-gray-50">
                  생활/건강
                </button>
                <button data-category1="디지털/가전" class="category1-filter-btn text-left px-3 py-2 text-sm rounded-md border transition-colors
                   bg-white border-gray-300 text-gray-700 hover:bg-gray-50">
                  디지털/가전
                </button>
              </div>
              <!-- 2depth 카테고리 -->
            </div>
            <!-- 기존 필터들 -->
            <div class="flex gap-2 items-center justify-between">
              <!-- 페이지당 상품 수 -->
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-600">개수:</label>
                <select id="limit-select"
                        class="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                  <option value="10">
                    10개
                  </option>
                  <option value="20" selected="">
                    20개
                  </option>
                  <option value="50">
                    50개
                  </option>
                  <option value="100">
                    100개
                  </option>
                </select>
              </div>
              <!-- 정렬 -->
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-600">정렬:</label>
                <select id="sort-select" class="text-sm border border-gray-300 rounded px-2 py-1
                             focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                  <option value="price_asc" selected="">가격 낮은순</option>
                  <option value="price_desc">가격 높은순</option>
                  <option value="name_asc">이름순</option>
                  <option value="name_desc">이름 역순</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <!-- 상품 목록 -->
        <div class="mb-6">
          <div>
            <!-- 상품 개수 정보 -->
            <div class="mb-4 text-sm text-gray-600">
              총 <span class="font-medium text-gray-900">340개</span>의 상품
            </div>
            <!-- 상품 그리드 -->
            <div class="grid grid-cols-2 gap-4 mb-6" id="products-grid">
              <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden product-card"
                   data-product-id="85067212996">
                <!-- 상품 이미지 -->
                <div class="aspect-square bg-gray-100 overflow-hidden cursor-pointer product-image">
                  <img src="https://shopping-phinf.pstatic.net/main_8506721/85067212996.1.jpg"
                       alt="PVC 투명 젤리 쇼핑백 1호 와인 답례품 구디백 비닐 손잡이 미니 간식 선물포장"
                       class="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                       loading="lazy">
                </div>
                <!-- 상품 정보 -->
                <div class="p-3">
                  <div class="cursor-pointer product-info mb-3">
                    <h3 class="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                      PVC 투명 젤리 쇼핑백 1호 와인 답례품 구디백 비닐 손잡이 미니 간식 선물포장
                    </h3>
                    <p class="text-xs text-gray-500 mb-2"></p>
                    <p class="text-lg font-bold text-gray-900">
                      220원
                    </p>
                  </div>
                  <!-- 장바구니 버튼 -->
                  <button class="w-full bg-blue-600 text-white text-sm py-2 px-3 rounded-md
                         hover:bg-blue-700 transition-colors add-to-cart-btn" data-product-id="85067212996">
                    장바구니 담기
                  </button>
                </div>
              </div>
              <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden product-card"
                   data-product-id="86940857379">
                <!-- 상품 이미지 -->
                <div class="aspect-square bg-gray-100 overflow-hidden cursor-pointer product-image">
                  <img src="https://shopping-phinf.pstatic.net/main_8694085/86940857379.1.jpg"
                       alt="샷시 풍지판 창문 바람막이 베란다 문 틈막이 창틀 벌레 차단 샤시 방충망 틈새막이"
                       class="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                       loading="lazy">
                </div>
                <!-- 상품 정보 -->
                <div class="p-3">
                  <div class="cursor-pointer product-info mb-3">
                    <h3 class="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                      샷시 풍지판 창문 바람막이 베란다 문 틈막이 창틀 벌레 차단 샤시 방충망 틈새막이
                    </h3>
                    <p class="text-xs text-gray-500 mb-2">이지웨이건축자재</p>
                    <p class="text-lg font-bold text-gray-900">
                      230원
                    </p>
                  </div>
                  <!-- 장바구니 버튼 -->
                  <button class="w-full bg-blue-600 text-white text-sm py-2 px-3 rounded-md
                         hover:bg-blue-700 transition-colors add-to-cart-btn" data-product-id="86940857379">
                    장바구니 담기
                  </button>
                </div>
              </div>
            </div>
            
            <div class="text-center py-4 text-sm text-gray-500">
              모든 상품을 확인했습니다
            </div>
          </div>
        </div>
      </main>
      <footer class="bg-white shadow-sm sticky top-0 z-40">
        <div class="max-w-md mx-auto py-8 text-center text-gray-500">
          <p>© 2025 항해플러스 프론트엔드 쇼핑몰</p>
        </div>
      </footer>
    </div>
  `;

  const 상품목록_레이아웃_카테고리_1Depth = `
    <main class="max-w-md mx-auto px-4 py-4">
      <!-- 검색 및 필터 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <!-- 검색창 -->
        <div class="mb-4">
          <div class="relative">
            <input type="text" id="search-input" placeholder="상품명을 검색해보세요..." value="" class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
          </div>
        </div>
        
        <!-- 필터 옵션 -->
        <div class="space-y-3">

          <!-- 카테고리 필터 -->
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <label class="text-sm text-gray-600">카테고리:</label>
              <button data-breadcrumb="reset" class="text-xs hover:text-blue-800 hover:underline">전체</button><span class="text-xs text-gray-500">&gt;</span><button data-breadcrumb="category1" data-category1="생활/건강" class="text-xs hover:text-blue-800 hover:underline">생활/건강</button>
            </div>
            <div class="space-y-2">
              <div class="flex flex-wrap gap-2">
                <button data-category1="생활/건강" data-category2="생활용품" class="category2-filter-btn text-left px-3 py-2 text-sm rounded-md border transition-colors bg-white border-gray-300 text-gray-700 hover:bg-gray-50">
                  생활용품
                </button>
                <button data-category1="생활/건강" data-category2="주방용품" class="category2-filter-btn text-left px-3 py-2 text-sm rounded-md border transition-colors bg-white border-gray-300 text-gray-700 hover:bg-gray-50">
                  주방용품
                </button>
                <button data-category1="생활/건강" data-category2="문구/사무용품" class="category2-filter-btn text-left px-3 py-2 text-sm rounded-md border transition-colors bg-white border-gray-300 text-gray-700 hover:bg-gray-50">
                  문구/사무용품
                </button>
              </div>
            </div>
          </div>
          
          <!-- 기존 필터들 -->
          <div class="flex gap-2 items-center justify-between">
            <!-- 페이지당 상품 수 -->
            <div class="flex items-center gap-2">
              <label class="text-sm text-gray-600">개수:</label>
              <select id="limit-select"
                      class="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                <option value="10">
                  10개
                </option>
                <option value="20" selected="">
                  20개
                </option>
                <option value="50">
                  50개
                </option>
                <option value="100">
                  100개
                </option>
              </select>
            </div>
            <!-- 정렬 -->
            <div class="flex items-center gap-2">
              <label class="text-sm text-gray-600">정렬:</label>
              <select id="sort-select" class="text-sm border border-gray-300 rounded px-2 py-1
                           focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                <option value="price_asc" selected="">가격 낮은순</option>
                <option value="price_desc">가격 높은순</option>
                <option value="name_asc">이름순</option>
                <option value="name_desc">이름 역순</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </main>
  `;

  const 상품목록_레이아웃_카테고리_2Depth = `
    <main class="max-w-md mx-auto px-4 py-4">
      <!-- 검색 및 필터 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <!-- 검색창 -->
        <div class="mb-4">
          <div class="relative">
            <input type="text" id="search-input" placeholder="상품명을 검색해보세요..." value="" class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
          </div>
        </div>
        
        <!-- 필터 옵션 -->
        <div class="space-y-3">

          <!-- 카테고리 필터 -->
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <label class="text-sm text-gray-600">카테고리:</label>
              <button data-breadcrumb="reset" class="text-xs hover:text-blue-800 hover:underline">전체</button><span class="text-xs text-gray-500">&gt;</span><button data-breadcrumb="category1" data-category1="생활/건강" class="text-xs hover:text-blue-800 hover:underline">생활/건강</button><span class="text-xs text-gray-500">&gt;</span><span class="text-xs text-gray-600 cursor-default">주방용품</span>
            </div>
            <div class="space-y-2">
              <div class="flex flex-wrap gap-2">
                <button data-category1="생활/건강" data-category2="생활용품" class="category2-filter-btn text-left px-3 py-2 text-sm rounded-md border transition-colors bg-white border-gray-300 text-gray-700 hover:bg-gray-50">
                  생활용품
                </button>
                <button data-category1="생활/건강" data-category2="주방용품" class="category2-filter-btn text-left px-3 py-2 text-sm rounded-md border transition-colors bg-blue-100 border-blue-300 text-blue-800">
                  주방용품
                </button>
                <button data-category1="생활/건강" data-category2="문구/사무용품" class="category2-filter-btn text-left px-3 py-2 text-sm rounded-md border transition-colors bg-white border-gray-300 text-gray-700 hover:bg-gray-50">
                  문구/사무용품
                </button>
              </div>
            </div>
          </div>
          
          <!-- 기존 필터들 -->
          <div class="flex gap-2 items-center justify-between">
            <!-- 페이지당 상품 수 -->
            <div class="flex items-center gap-2">
              <label class="text-sm text-gray-600">개수:</label>
              <select id="limit-select"
                      class="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                <option value="10">
                  10개
                </option>
                <option value="20" selected="">
                  20개
                </option>
                <option value="50">
                  50개
                </option>
                <option value="100">
                  100개
                </option>
              </select>
            </div>
            <!-- 정렬 -->
            <div class="flex items-center gap-2">
              <label class="text-sm text-gray-600">정렬:</label>
              <select id="sort-select" class="text-sm border border-gray-300 rounded px-2 py-1
                           focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                <option value="price_asc" selected="">가격 낮은순</option>
                <option value="price_desc">가격 높은순</option>
                <option value="name_asc">이름순</option>
                <option value="name_desc">이름 역순</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </main>
  `;

  const 토스트 = `
    <div class="flex flex-col gap-2 items-center justify-center mx-auto" style="width: fit-content;">
      <div class="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 max-w-sm">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <p class="text-sm font-medium">장바구니에 추가되었습니다</p>
        <button id="toast-close-btn" class="flex-shrink-0 ml-2 text-white hover:text-gray-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <div class="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 max-w-sm">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
         </svg>
        </div>
        <p class="text-sm font-medium">선택된 상품들이 삭제되었습니다</p>
        <button id="toast-close-btn" class="flex-shrink-0 ml-2 text-white hover:text-gray-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <div class="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 max-w-sm">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <p class="text-sm font-medium">오류가 발생했습니다.</p>
        <button id="toast-close-btn" class="flex-shrink-0 ml-2 text-white hover:text-gray-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  `;

  const 장바구니_비어있음 = `
    <div class="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
      <div class="relative bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-hidden">
        <!-- 헤더 -->
        <div class="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-900 flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"></path>
            </svg>
            장바구니 
          </h2>
          
          <button id="cart-modal-close-btn" class="text-gray-400 hover:text-gray-600 p-1">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <!-- 컨텐츠 -->
        <div class="flex flex-col max-h-[calc(90vh-120px)]">
          <!-- 빈 장바구니 -->
          <div class="flex-1 flex items-center justify-center p-8">
            <div class="text-center">
              <div class="text-gray-400 mb-4">
                <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"></path>
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">장바구니가 비어있습니다</h3>
              <p class="text-gray-600">원하는 상품을 담아보세요!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const 장바구니_선택없음 = `
    <div class="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
      <div class="relative bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-hidden">
        <!-- 헤더 -->
        <div class="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-900 flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"></path>
            </svg>
            장바구니
            <span class="text-sm font-normal text-gray-600 ml-1">(2)</span>
          </h2>
          <button id="cart-modal-close-btn" class="text-gray-400 hover:text-gray-600 p-1">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <!-- 컨텐츠 -->
        <div class="flex flex-col max-h-[calc(90vh-120px)]">
          <!-- 전체 선택 섹션 -->
          <div class="p-4 border-b border-gray-200 bg-gray-50">
            <label class="flex items-center text-sm text-gray-700">
              <input type="checkbox" id="cart-modal-select-all-checkbox" class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2">
              전체선택 (2개)
            </label>
          </div>
          <!-- 아이템 목록 -->
          <div class="flex-1 overflow-y-auto">
            <div class="p-4 space-y-4">
              <div class="flex items-center py-3 border-b border-gray-100 cart-item" data-product-id="85067212996">
                <!-- 선택 체크박스 -->
                <label class="flex items-center mr-3">
                  <input type="checkbox" class="cart-item-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded 
                focus:ring-blue-500" data-product-id="85067212996">
                </label>
                <!-- 상품 이미지 -->
                <div class="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden mr-3 flex-shrink-0">
                  <img src="https://shopping-phinf.pstatic.net/main_8506721/85067212996.1.jpg" alt="PVC 투명 젤리 쇼핑백 1호 와인 답례품 구디백 비닐 손잡이 미니 간식 선물포장" class="w-full h-full object-cover cursor-pointer cart-item-image" data-product-id="85067212996">
                </div>
                <!-- 상품 정보 -->
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-gray-900 truncate cursor-pointer cart-item-title" data-product-id="85067212996">
                    PVC 투명 젤리 쇼핑백 1호 와인 답례품 구디백 비닐 손잡이 미니 간식 선물포장
                  </h4>
                  <p class="text-sm text-gray-600 mt-1">
                    220원
                  </p>
                  <!-- 수량 조절 -->
                  <div class="flex items-center mt-2">
                    <button class="quantity-decrease-btn w-7 h-7 flex items-center justify-center 
                 border border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100" data-product-id="85067212996">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                      </svg>
                    </button>
                    <input type="number" value="2" min="1" class="quantity-input w-12 h-7 text-center text-sm border-t border-b 
                border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" disabled="" data-product-id="85067212996">
                    <button class="quantity-increase-btn w-7 h-7 flex items-center justify-center 
                 border border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100" data-product-id="85067212996">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <!-- 가격 및 삭제 -->
                <div class="text-right ml-3">
                  <p class="text-sm font-medium text-gray-900">
                    440원
                  </p>
                  <button class="cart-item-remove-btn mt-1 text-xs text-red-600 hover:text-red-800" data-product-id="85067212996">
                    삭제
                  </button>
                </div>
              </div>
              <div class="flex items-center py-3 border-b border-gray-100 cart-item" data-product-id="86940857379">
                <!-- 선택 체크박스 -->
                <label class="flex items-center mr-3">
                  <input type="checkbox" class="cart-item-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded 
                focus:ring-blue-500" data-product-id="86940857379">
                </label>
                <!-- 상품 이미지 -->
                <div class="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden mr-3 flex-shrink-0">
                  <img src="https://shopping-phinf.pstatic.net/main_8694085/86940857379.1.jpg" alt="샷시 풍지판 창문 바람막이 베란다 문 틈막이 창틀 벌레 차단 샤시 방충망 틈새막이" class="w-full h-full object-cover cursor-pointer cart-item-image" data-product-id="86940857379">
                </div>
                <!-- 상품 정보 -->
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-gray-900 truncate cursor-pointer cart-item-title" data-product-id="86940857379">
                    샷시 풍지판 창문 바람막이 베란다 문 틈막이 창틀 벌레 차단 샤시 방충망 틈새막이
                  </h4>
                  <p class="text-sm text-gray-600 mt-1">
                    230원
                  </p>
                  <!-- 수량 조절 -->
                  <div class="flex items-center mt-2">
                    <button class="quantity-decrease-btn w-7 h-7 flex items-center justify-center 
                 border border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100" data-product-id="86940857379">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                      </svg>
                    </button>
                    <input type="number" value="1" min="1" class="quantity-input w-12 h-7 text-center text-sm border-t border-b 
                border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" disabled="" data-product-id="86940857379">
                    <button class="quantity-increase-btn w-7 h-7 flex items-center justify-center 
                 border border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100" data-product-id="86940857379">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <!-- 가격 및 삭제 -->
                <div class="text-right ml-3">
                  <p class="text-sm font-medium text-gray-900">
                    230원
                  </p>
                  <button class="cart-item-remove-btn mt-1 text-xs text-red-600 hover:text-red-800" data-product-id="86940857379">
                    삭제
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- 하단 액션 -->
        <div class="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <!-- 선택된 아이템 정보 -->
          <!-- 총 금액 -->
          <div class="flex justify-between items-center mb-4">
            <span class="text-lg font-bold text-gray-900">총 금액</span>
            <span class="text-xl font-bold text-blue-600">670원</span>
          </div>
          <!-- 액션 버튼들 -->
          <div class="space-y-2">
            <div class="flex gap-2">
              <button id="cart-modal-clear-cart-btn" class="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md 
                       hover:bg-gray-700 transition-colors text-sm">
                전체 비우기
              </button>
              <button id="cart-modal-checkout-btn" class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md 
                       hover:bg-blue-700 transition-colors text-sm">
                구매하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const 장바구니_선택있음 = `
    <div class="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
      <div class="relative bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-hidden">
        <!-- 헤더 -->
        <div class="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-900 flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"></path>
            </svg>
            장바구니
            <span class="text-sm font-normal text-gray-600 ml-1">(2)</span>
          </h2>
          <button id="cart-modal-close-btn" class="text-gray-400 hover:text-gray-600 p-1">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <!-- 컨텐츠 -->
        <div class="flex flex-col max-h-[calc(90vh-120px)]">
          <!-- 전체 선택 섹션 -->
          <div class="p-4 border-b border-gray-200 bg-gray-50">
            <label class="flex items-center text-sm text-gray-700">
              <input type="checkbox" id="cart-modal-select-all-checkbox" class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2">
              전체선택 (2개)
            </label>
          </div>
          <!-- 아이템 목록 -->
          <div class="flex-1 overflow-y-auto">
            <div class="p-4 space-y-4">
              <div class="flex items-center py-3 border-b border-gray-100 cart-item" data-product-id="85067212996">
                <!-- 선택 체크박스 -->
                <label class="flex items-center mr-3">
                  <input type="checkbox" checked="" class="cart-item-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded 
                focus:ring-blue-500" data-product-id="85067212996">
                </label>
                <!-- 상품 이미지 -->
                <div class="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden mr-3 flex-shrink-0">
                  <img src="https://shopping-phinf.pstatic.net/main_8506721/85067212996.1.jpg" alt="PVC 투명 젤리 쇼핑백 1호 와인 답례품 구디백 비닐 손잡이 미니 간식 선물포장" class="w-full h-full object-cover cursor-pointer cart-item-image" data-product-id="85067212996">
                </div>
                <!-- 상품 정보 -->
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-gray-900 truncate cursor-pointer cart-item-title" data-product-id="85067212996">
                    PVC 투명 젤리 쇼핑백 1호 와인 답례품 구디백 비닐 손잡이 미니 간식 선물포장
                  </h4>
                  <p class="text-sm text-gray-600 mt-1">
                    220원
                  </p>
                  <!-- 수량 조절 -->
                  <div class="flex items-center mt-2">
                    <button class="quantity-decrease-btn w-7 h-7 flex items-center justify-center 
                 border border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100" data-product-id="85067212996">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                      </svg>
                    </button>
                    <input type="number" value="2" min="1" class="quantity-input w-12 h-7 text-center text-sm border-t border-b 
                border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" disabled="" data-product-id="85067212996">
                    <button class="quantity-increase-btn w-7 h-7 flex items-center justify-center 
                 border border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100" data-product-id="85067212996">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <!-- 가격 및 삭제 -->
                <div class="text-right ml-3">
                  <p class="text-sm font-medium text-gray-900">
                    440원
                  </p>
                  <button class="cart-item-remove-btn mt-1 text-xs text-red-600 hover:text-red-800" data-product-id="85067212996">
                    삭제
                  </button>
                </div>
              </div>
              <div class="flex items-center py-3 border-b border-gray-100 cart-item" data-product-id="86940857379">
                <!-- 선택 체크박스 -->
                <label class="flex items-center mr-3">
                  <input type="checkbox" class="cart-item-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded 
                focus:ring-blue-500" data-product-id="86940857379">
                </label>
                <!-- 상품 이미지 -->
                <div class="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden mr-3 flex-shrink-0">
                  <img src="https://shopping-phinf.pstatic.net/main_8694085/86940857379.1.jpg" alt="샷시 풍지판 창문 바람막이 베란다 문 틈막이 창틀 벌레 차단 샤시 방충망 틈새막이" class="w-full h-full object-cover cursor-pointer cart-item-image" data-product-id="86940857379">
                </div>
                <!-- 상품 정보 -->
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-gray-900 truncate cursor-pointer cart-item-title" data-product-id="86940857379">
                    샷시 풍지판 창문 바람막이 베란다 문 틈막이 창틀 벌레 차단 샤시 방충망 틈새막이
                  </h4>
                  <p class="text-sm text-gray-600 mt-1">
                    230원
                  </p>
                  <!-- 수량 조절 -->
                  <div class="flex items-center mt-2">
                    <button class="quantity-decrease-btn w-7 h-7 flex items-center justify-center 
                 border border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100" data-product-id="86940857379">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                      </svg>
                    </button>
                    <input type="number" value="1" min="1" class="quantity-input w-12 h-7 text-center text-sm border-t border-b 
                border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" disabled="" data-product-id="86940857379">
                    <button class="quantity-increase-btn w-7 h-7 flex items-center justify-center 
                 border border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100" data-product-id="86940857379">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <!-- 가격 및 삭제 -->
                <div class="text-right ml-3">
                  <p class="text-sm font-medium text-gray-900">
                    230원
                  </p>
                  <button class="cart-item-remove-btn mt-1 text-xs text-red-600 hover:text-red-800" data-product-id="86940857379">
                    삭제
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- 하단 액션 -->
        <div class="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <!-- 선택된 아이템 정보 -->
          <div class="flex justify-between items-center mb-3 text-sm">
            <span class="text-gray-600">선택한 상품 (1개)</span>
            <span class="font-medium">440원</span>
          </div>
          <!-- 총 금액 -->
          <div class="flex justify-between items-center mb-4">
            <span class="text-lg font-bold text-gray-900">총 금액</span>
            <span class="text-xl font-bold text-blue-600">670원</span>
          </div>
          <!-- 액션 버튼들 -->
          <div class="space-y-2">
            <button id="cart-modal-remove-selected-btn" class="w-full bg-red-600 text-white py-2 px-4 rounded-md 
                       hover:bg-red-700 transition-colors text-sm">
              선택한 상품 삭제 (1개)
            </button>
            <div class="flex gap-2">
              <button id="cart-modal-clear-cart-btn" class="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md 
                       hover:bg-gray-700 transition-colors text-sm">
                전체 비우기
              </button>
              <button id="cart-modal-checkout-btn" class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md 
                       hover:bg-blue-700 transition-colors text-sm">
                구매하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const 상세페이지_로딩 = `
    <div class="min-h-screen bg-gray-50">
      <header class="bg-white shadow-sm sticky top-0 z-40">
        <div class="max-w-md mx-auto px-4 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <button onclick="window.history.back()" class="p-2 text-gray-700 hover:text-gray-900 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
              </button>
              <h1 class="text-lg font-bold text-gray-900">상품 상세</h1>
            </div>
            <div class="flex items-center space-x-2">
              <!-- 장바구니 아이콘 -->
              <button id="cart-icon-btn" class="relative p-2 text-gray-700 hover:text-gray-900 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main class="max-w-md mx-auto px-4 py-4">
        <div class="py-20 bg-gray-50 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p class="text-gray-600">상품 정보를 불러오는 중...</p>
          </div>
        </div>
      </main>
      <footer class="bg-white shadow-sm sticky top-0 z-40">
        <div class="max-w-md mx-auto py-8 text-center text-gray-500">
          <p>© 2025 항해플러스 프론트엔드 쇼핑몰</p>
        </div>
      </footer>
    </div>
  `;

  const 상세페이지_로딩완료 = `
    <div class="min-h-screen bg-gray-50">
      <header class="bg-white shadow-sm sticky top-0 z-40">
        <div class="max-w-md mx-auto px-4 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <button onclick="window.history.back()" class="p-2 text-gray-700 hover:text-gray-900 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
              </button>
              <h1 class="text-lg font-bold text-gray-900">상품 상세</h1>
            </div>
            <div class="flex items-center space-x-2">
              <!-- 장바구니 아이콘 -->
              <button id="cart-icon-btn" class="relative p-2 text-gray-700 hover:text-gray-900 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11v6a1 1 0 001 1h1a1 1 0 001-1v-6M13 13v6a1 1 0 001 1h1a1 1 0 001-1v-6"></path>
                </svg>
                <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  1
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main class="max-w-md mx-auto px-4 py-4">
        <!-- 브레드크럼 -->
        <nav class="mb-4">
          <div class="flex items-center space-x-2 text-sm text-gray-600">
            <a href="/" data-link="" class="hover:text-blue-600 transition-colors">홈</a>
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            <button class="breadcrumb-link" data-category1="생활/건강">
              생활/건강
            </button>
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            <button class="breadcrumb-link" data-category2="생활용품">
              생활용품
            </button>
          </div>
        </nav>
        <!-- 상품 상세 정보 -->
        <div class="bg-white rounded-lg shadow-sm mb-6">
          <!-- 상품 이미지 -->
          <div class="p-4">
            <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
              <img src="https://shopping-phinf.pstatic.net/main_8506721/85067212996.1.jpg" alt="PVC 투명 젤리 쇼핑백 1호 와인 답례품 구디백 비닐 손잡이 미니 간식 선물포장" class="w-full h-full object-cover product-detail-image">
            </div>
            <!-- 상품 정보 -->
            <div>
              <p class="text-sm text-gray-600 mb-1"></p>
              <h1 class="text-xl font-bold text-gray-900 mb-3">PVC 투명 젤리 쇼핑백 1호 와인 답례품 구디백 비닐 손잡이 미니 간식 선물포장</h1>
              <!-- 평점 및 리뷰 -->
              <div class="flex items-center mb-3">
                <div class="flex items-center">
                  <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                  </svg>
                  <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                  </svg>
                  <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                  </svg>
                  <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                  </svg>
                  <svg class="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                  </svg>
                </div>
                <span class="ml-2 text-sm text-gray-600">4.0 (749개 리뷰)</span>
              </div>
              <!-- 가격 -->
              <div class="mb-4">
                <span class="text-2xl font-bold text-blue-600">220원</span>
              </div>
              <!-- 재고 -->
              <div class="text-sm text-gray-600 mb-4">
                재고 107개
              </div>
              <!-- 설명 -->
              <div class="text-sm text-gray-700 leading-relaxed mb-6">
                PVC 투명 젤리 쇼핑백 1호 와인 답례품 구디백 비닐 손잡이 미니 간식 선물포장에 대한 상세 설명입니다. 브랜드의 우수한 품질을 자랑하는 상품으로, 고객 만족도가 높은 제품입니다.
              </div>
            </div>
          </div>
          <!-- 수량 선택 및 액션 -->
          <div class="border-t border-gray-200 p-4">
            <div class="flex items-center justify-between mb-4">
              <span class="text-sm font-medium text-gray-900">수량</span>
              <div class="flex items-center">
                <button id="quantity-decrease" class="w-8 h-8 flex items-center justify-center border border-gray-300 
                   rounded-l-md bg-gray-50 hover:bg-gray-100">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                  </svg>
                </button>
                <input type="number" id="quantity-input" value="1" min="1" max="107" class="w-16 h-8 text-center text-sm border-t border-b border-gray-300 
                  focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                <button id="quantity-increase" class="w-8 h-8 flex items-center justify-center border border-gray-300 
                   rounded-r-md bg-gray-50 hover:bg-gray-100">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                </button>
              </div>
            </div>
            <!-- 액션 버튼 -->
            <button id="add-to-cart-btn" data-product-id="85067212996" class="w-full bg-blue-600 text-white py-3 px-4 rounded-md 
                 hover:bg-blue-700 transition-colors font-medium">
              장바구니 담기
            </button>
          </div>
        </div>
        <!-- 상품 목록으로 이동 -->
        <div class="mb-6">
          <button class="block w-full text-center bg-gray-100 text-gray-700 py-3 px-4 rounded-md 
            hover:bg-gray-200 transition-colors go-to-product-list">
            상품 목록으로 돌아가기
          </button>
        </div>
        <!-- 관련 상품 -->
        <div class="bg-white rounded-lg shadow-sm">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-bold text-gray-900">관련 상품</h2>
            <p class="text-sm text-gray-600">같은 카테고리의 다른 상품들</p>
          </div>
          <div class="p-4">
            <div class="grid grid-cols-2 gap-3 responsive-grid">
              <div class="bg-gray-50 rounded-lg p-3 related-product-card cursor-pointer" data-product-id="86940857379">
                <div class="aspect-square bg-white rounded-md overflow-hidden mb-2">
                  <img src="https://shopping-phinf.pstatic.net/main_8694085/86940857379.1.jpg" alt="샷시 풍지판 창문 바람막이 베란다 문 틈막이 창틀 벌레 차단 샤시 방충망 틈새막이" class="w-full h-full object-cover" loading="lazy">
                </div>
                <h3 class="text-sm font-medium text-gray-900 mb-1 line-clamp-2">샷시 풍지판 창문 바람막이 베란다 문 틈막이 창틀 벌레 차단 샤시 방충망 틈새막이</h3>
                <p class="text-sm font-bold text-blue-600">230원</p>
              </div>
              <div class="bg-gray-50 rounded-lg p-3 related-product-card cursor-pointer" data-product-id="82094468339">
                <div class="aspect-square bg-white rounded-md overflow-hidden mb-2">
                  <img src="https://shopping-phinf.pstatic.net/main_8209446/82094468339.4.jpg" alt="실리카겔 50g 습기제거제 제품 /산업 신발 의류 방습제" class="w-full h-full object-cover" loading="lazy">
                </div>
                <h3 class="text-sm font-medium text-gray-900 mb-1 line-clamp-2">실리카겔 50g 습기제거제 제품 /산업 신발 의류 방습제</h3>
                <p class="text-sm font-bold text-blue-600">280원</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer class="bg-white shadow-sm sticky top-0 z-40">
        <div class="max-w-md mx-auto py-8 text-center text-gray-500">
          <p>© 2025 항해플러스 프론트엔드 쇼핑몰</p>
        </div>
      </footer>
    </div>
  `;

  const _404_ = `
    <main class="max-w-md mx-auto px-4 py-4">
      <div class="text-center my-4 py-20 shadow-md p-6 bg-white rounded-lg">
      <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4285f4;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1a73e8;stop-opacity:1" />
          </linearGradient>
          <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="#000000" flood-opacity="0.1"/>
          </filter>
        </defs>
        
        <!-- 404 Numbers -->
        <text x="160" y="85" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="48" font-weight="600" fill="url(#blueGradient)" text-anchor="middle">404</text>
        
        <!-- Icon decoration -->
        <circle cx="80" cy="60" r="3" fill="#e8f0fe" opacity="0.8"/>
        <circle cx="240" cy="60" r="3" fill="#e8f0fe" opacity="0.8"/>
        <circle cx="90" cy="45" r="2" fill="#4285f4" opacity="0.5"/>
        <circle cx="230" cy="45" r="2" fill="#4285f4" opacity="0.5"/>
        
        <!-- Message -->
        <text x="160" y="110" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" font-weight="400" fill="#5f6368" text-anchor="middle">페이지를 찾을 수 없습니다</text>
        
        <!-- Subtle bottom accent -->
        <rect x="130" y="130" width="60" height="2" rx="1" fill="url(#blueGradient)" opacity="0.3"/>
      </svg>
      
      <a href="/" data-link class="inline-block px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">홈으로</a>
    </div>
    </main>
  `;

  document.body.innerHTML = `
    ${상품목록_레이아웃_로딩}
    <br />
    ${상품목록_레이아웃_로딩완료}
    <br />
    ${상품목록_레이아웃_카테고리_1Depth}
    <br />
    ${상품목록_레이아웃_카테고리_2Depth}
    <br />
    ${토스트}
    <br />
    ${장바구니_비어있음}
    <br />
    ${장바구니_선택없음}
    <br />
    ${장바구니_선택있음}
    <br />
    ${상세페이지_로딩}
    <br />
    ${상세페이지_로딩완료}
    <br />
    ${_404_}
  `;
}

// 애플리케이션 시작
if (import.meta.env.MODE !== "test") {
  enableMocking().then(() => initMain());
} else {
  main();
}
