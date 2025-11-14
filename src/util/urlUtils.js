/**
 * URL 관련 유틸리티 함수들
 */

// GitHub Pages 배포를 위한 base URL
const BASE_URL = import.meta.env.BASE_URL || "/";

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
  if (filters.sort) params.sort = filters.sort;
  if (filters.limit) params.limit = filters.limit;

  const queryString = buildQueryString(params);
  // BASE_URL이 /로 끝나므로 /를 제거한 후 쿼리스트링 추가
  const basePath = BASE_URL === "/" ? "/" : BASE_URL.slice(0, -1);
  return basePath + queryString;
}

/**
 * 상품 상세 페이지 URL 생성
 * @param {string} productId - 상품 ID
 * @returns {string} URL
 */
export function buildProductDetailUrl(productId) {
  return `${BASE_URL}product/${productId}`;
}

/**
 * 현재 URL이 메인 페이지인지 확인
 * @returns {boolean}
 */
export function isMainPage() {
  const pathname = window.location.pathname;
  return pathname === BASE_URL || pathname === BASE_URL.slice(0, -1);
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
  const parts = window.location.pathname.split("/product/");
  return parts[parts.length - 1];
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
