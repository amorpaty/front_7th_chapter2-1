/**
 * URL 관련 유틸리티 함수들
 */

/**
 * 현재 URL의 쿼리 파라미터를 객체로 반환
 * @returns {Object} 쿼리 파라미터 객체
 */
export function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
}

/**
 * 객체를 쿼리 스트링으로 변환
 * @param {Object} params - 쿼리 파라미터 객체
 * @returns {string} 쿼리 스트링 (? 포함)
 */
export function buildQueryString(params) {
  const filtered = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return filtered ? `?${filtered}` : "";
}

/**
 * 메인 페이지 URL 생성 (필터 파라미터 포함)
 * @param {Object} filters - 필터 객체 { category1, category2, search, sort, limit }
 * @returns {string} URL
 */
export function buildMainPageUrl(filters = {}) {
  const params = {};

  if (filters.category1) params.category1 = filters.category1;
  if (filters.category2) params.category2 = filters.category2;
  if (filters.search) params.search = filters.search;
  if (filters.sort && filters.sort !== "price_asc") params.sort = filters.sort; // 기본값이 아닐 때만
  if (filters.limit && filters.limit !== 20) params.limit = filters.limit; // 기본값이 아닐 때만

  return "/" + buildQueryString(params);
}

/**
 * 상품 상세 페이지 URL 생성
 * @param {string} productId - 상품 ID
 * @returns {string} URL
 */
export function buildProductDetailUrl(productId) {
  return `/product/${productId}`;
}

/**
 * 현재 URL이 메인 페이지인지 확인
 * @returns {boolean}
 */
export function isMainPage() {
  return window.location.pathname === "/";
}

/**
 * 현재 URL이 상품 상세 페이지인지 확인
 * @returns {boolean}
 */
export function isProductDetailPage() {
  return window.location.pathname.includes("/product/");
}

/**
 * 상품 ID를 URL에서 추출
 * @returns {string|null} 상품 ID 또는 null
 */
export function getProductIdFromUrl() {
  if (!isProductDetailPage()) return null;
  return window.location.pathname.split("/product/")[1];
}

/**
 * URL 변경 및 히스토리 추가
 * @param {string} url - 변경할 URL
 * @param {Object} state - 히스토리 state (선택사항)
 */
export function navigateTo(url, state = null) {
  history.pushState(state, "", url);
}

/**
 * 현재 필터 상태를 URL에 반영
 * @param {Object} filters - 필터 객체
 */
export function updateUrlWithFilters(filters) {
  const url = buildMainPageUrl(filters);
  navigateTo(url);
}
