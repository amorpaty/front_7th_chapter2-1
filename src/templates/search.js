// 검색 및 필터 템플릿
export const searchTemplates = {
  searchInput: (value = "") => /* html */ `
    <div class="mb-4">
      <div class="relative">
        <input type="text" 
               id="search-input" 
               placeholder="상품명을 검색해보세요..." 
               value="${value}"
               class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg
                      focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
      </div>
    </div>
  `,

  categorySection: (categories = []) => /* html */ `
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-600">카테고리:</label>
        <button data-breadcrumb="reset" class="text-xs hover:text-blue-800 hover:underline">전체</button>
      </div>
      ${
        categories.length == 0
          ? `<div class="text-sm text-gray-500 italic">카테고리 로딩 중...</div>`
          : `${categories.map((category) => searchTemplates.categoryButton(category)).join("")}`
      }
    </div>
  `,

  categoryButton: (category, isSelected = false) => /* html */ `
    <button class="category1-filter-btn text-left px-3 py-2 text-sm rounded-md border transition-colors
                   bg-white border-gray-300 ${isSelected ? "font-bold" : "text-gray-700"}  hover:text-blue-800 hover:underline">
      ${category}
    </button>
  `,

  sortAndLimit: (sort = "price_asc", limit = 20) => /* html */ `
    <div class="flex gap-2 items-center justify-between">
      <!-- 페이지당 상품 수 -->
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-600">개수:</label>
        <select id="limit-select"
                class="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
          <option value="10" ${limit === 10 ? "selected" : ""}>10개</option>
          <option value="20" ${limit === 20 ? "selected" : ""}>20개</option>
          <option value="50" ${limit === 50 ? "selected" : ""}>50개</option>
          <option value="100" ${limit === 100 ? "selected" : ""}>100개</option>
        </select>
      </div>
      <!-- 정렬 -->
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-600">정렬:</label>
        <select id="sort-select" 
                class="text-sm border border-gray-300 rounded px-2 py-1
                       focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
          <option value="price_asc" ${sort === "price_asc" ? "selected" : ""}>가격 낮은순</option>
          <option value="price_desc" ${sort === "price_desc" ? "selected" : ""}>가격 높은순</option>
          <option value="name_asc" ${sort === "name_asc" ? "selected" : ""}>이름순</option>
          <option value="name_desc" ${sort === "name_desc" ? "selected" : ""}>이름 역순</option>
        </select>
      </div>
    </div>
  `,

  filterBox: (filters = {}) => /* html */ `
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      ${searchTemplates.searchInput(filters.search)}
      <!-- 필터 옵션 -->
      <div class="space-y-3">
        <!-- 카테고리 필터 -->
        ${searchTemplates.categorySection(filters.categories, filters.isSubItem)}
        <!-- 기존 필터들 -->
        ${searchTemplates.sortAndLimit(filters.sort, filters.limit)}
      </div>
    </div>
  `,
};
