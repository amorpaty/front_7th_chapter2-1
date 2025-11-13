# URL Utils 사용 가이드

## 개요

`urlUtils.js`는 URL 관리를 체계적으로 하기 위한 유틸리티 함수 모음입니다.

## 주요 함수

### 1. getQueryParams()
현재 URL의 쿼리 파라미터를 객체로 반환합니다.

```javascript
// URL: http://localhost:5173/?category1=생활/건강&category2=생활용품&sort=price_asc

const params = getQueryParams();
console.log(params);
// { category1: "생활/건강", category2: "생활용품", sort: "price_asc" }
```

### 2. buildQueryString(params)
객체를 쿼리 스트링으로 변환합니다.

```javascript
const params = {
  category1: "생활/건강",
  category2: "생활용품",
  sort: "price_asc",
  limit: 20
};

const queryString = buildQueryString(params);
console.log(queryString);
// "?category1=%EC%83%9D%ED%99%9C%2F%EA%B1%B4%EA%B0%95&category2=%EC%83%9D%ED%99%9C%EC%9A%A9%ED%92%88&sort=price_asc&limit=20"
```

**특징:**
- 빈 값(`""`, `null`, `undefined`)은 자동으로 제외됩니다
- URL 인코딩이 자동으로 적용됩니다

### 3. buildMainPageUrl(filters)
필터 조건으로 메인 페이지 URL을 생성합니다.

```javascript
const filters = {
  category1: "생활/건강",
  category2: "생활용품",
  sort: "price_desc",
  limit: 50
};

const url = buildMainPageUrl(filters);
console.log(url);
// "/?category1=%EC%83%9D%ED%99%9C%2F%EA%B1%B4%EA%B0%95&category2=%EC%83%9D%ED%99%9C%EC%9A%A9%ED%92%88&sort=price_desc&limit=50"
```

**특징:**
- 기본값(`sort: "price_asc"`, `limit: 20`)은 URL에 포함하지 않습니다
- 불필요한 파라미터를 줄여 URL을 깔끔하게 유지합니다

### 4. buildProductDetailUrl(productId)
상품 상세 페이지 URL을 생성합니다.

```javascript
const url = buildProductDetailUrl("12345");
console.log(url);
// "/product/12345"
```

### 5. isMainPage() / isProductDetailPage()
현재 페이지 타입을 확인합니다.

```javascript
if (isMainPage()) {
  console.log("메인 페이지입니다");
}

if (isProductDetailPage()) {
  console.log("상품 상세 페이지입니다");
}
```

### 6. getProductIdFromUrl()
URL에서 상품 ID를 추출합니다.

```javascript
// URL: http://localhost:5173/product/12345

const productId = getProductIdFromUrl();
console.log(productId); // "12345"
```

### 7. navigateTo(url, state)
URL을 변경하고 히스토리에 추가합니다.

```javascript
// 기본 사용
navigateTo("/");

// state와 함께 사용
navigateTo("/product/12345", { from: "search" });
```

### 8. updateUrlWithFilters(filters)
현재 필터 상태를 URL에 반영합니다.

```javascript
// store.state.filters를 URL에 반영
updateUrlWithFilters(store.state.filters);
```

## 사용 예시

### 검색 기능 구현

```javascript
import { updateUrlWithFilters } from "./util/urlUtils.js";

document.addEventListener("search", async (event) => {
  const searchTerm = event.target.value;
  
  // Store 업데이트
  store.commit("SET_FILTERS", { search: searchTerm });
  
  // URL 자동 업데이트
  updateUrlWithFilters(store.state.filters);
  
  // 데이터 로드
  await store.dispatch("loadProducts");
});
```

### 카테고리 필터 구현

```javascript
import { updateUrlWithFilters } from "./util/urlUtils.js";

document.addEventListener("click", (event) => {
  if (event.target.matches(".category-btn")) {
    const category1 = event.target.dataset.category1;
    const category2 = event.target.dataset.category2;
    
    store.commit("SET_FILTERS", { category1, category2 });
    updateUrlWithFilters(store.state.filters);
    
    await store.dispatch("loadProducts");
  }
});
```

### 페이지 진입 시 URL 파라미터 읽기

```javascript
import { getQueryParams } from "./util/urlUtils.js";

async function initPage() {
  const params = getQueryParams();
  
  // URL 파라미터를 store에 반영
  if (params.category1 || params.category2 || params.search) {
    store.commit("SET_FILTERS", {
      category1: params.category1 || "",
      category2: params.category2 || "",
      search: params.search || "",
      sort: params.sort || "price_asc",
      limit: params.limit ? parseInt(params.limit) : 20
    });
  }
  
  await store.dispatch("loadProducts");
}
```

### 상품 상세 페이지 이동

```javascript
import { buildProductDetailUrl, navigateTo } from "./util/urlUtils.js";

document.addEventListener("click", (event) => {
  if (event.target.matches(".product-card")) {
    const productId = event.target.dataset.productId;
    
    // URL 생성 및 이동
    const url = buildProductDetailUrl(productId);
    navigateTo(url);
    
    // 페이지 렌더링
    navigate();
  }
});
```

## 장점

1. **중복 코드 제거**: URL 생성 로직이 한 곳에 모여있어 유지보수가 쉽습니다
2. **일관성**: 모든 URL이 동일한 규칙으로 생성됩니다
3. **안전성**: URL 인코딩이 자동으로 처리되어 특수문자 관련 버그를 방지합니다
4. **가독성**: 함수 이름만으로 의도를 명확히 알 수 있습니다
5. **테스트 용이성**: 각 함수를 독립적으로 테스트할 수 있습니다

## 마이그레이션 가이드

### Before (직접 URL 조작)
```javascript
history.pushState(null, "", "/?category1=" + encodeURIComponent(category1) 
  + (category2 ? "&category2=" + encodeURIComponent(category2) : ""));
```

### After (urlUtils 사용)
```javascript
import { updateUrlWithFilters } from "./util/urlUtils.js";

store.commit("SET_FILTERS", { category1, category2 });
updateUrlWithFilters(store.state.filters);
```

훨씬 간결하고 읽기 쉬워졌습니다!
