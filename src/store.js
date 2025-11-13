import { getCategories, getProduct, getProducts } from "./api/productApi.js";
import { Store } from "./core/Store.js";

export const store = new Store({
  state: {
    products: [],
    categories: [],
    cart: [],
    filters: {
      search: "",
      categories: [],
      category1: "",
      category2: "",
      isSubItem: false,
      limit: 20,
      sort: "price_asc",
    },
    currentPage: 1,
    totalCount: 0,
    hasNext: true,
    hasPrev: false,
    isLoading: false,
    detailProduct: {},
    relatedProducts: [],
    isMain: true,
  },

  mutations: {
    SET_PRODUCTS(state, products) {
      state.products = products;
    },

    SET_CATEGORIES(state, categories) {
      state.categories = categories;
    },

    SET_CART(state, cart) {
      state.cart = cart;
    },

    ADD_TO_CART(state, cartItem) {
      // cartItem = { productId, quantity, name, price, image, ... }
      const existingIndex = state.cart.findIndex((item) => item.productId === cartItem.productId);
      if (existingIndex === -1) {
        state.cart = [...state.cart, cartItem];
      }
    },

    UPDATE_CART_ITEM(state, { productId, quantity }) {
      state.cart = state.cart.map((item) => (item.productId === productId ? { ...item, quantity } : item));
    },

    REMOVE_FROM_CART(state, productId) {
      state.cart = state.cart.filter((item) => item.productId !== productId);
    },

    TOGGLE_CART_ITEM_SELECTED(state, productId) {
      state.cart = state.cart.map((item) =>
        item.productId === productId ? { ...item, selected: !item.selected } : item,
      );
    },

    SET_CART_ITEM_SELECTED(state, { productId, selected }) {
      state.cart = state.cart.map((item) => (item.productId === productId ? { ...item, selected } : item));
    },

    SELECT_ALL_CART_ITEMS(state, selected) {
      state.cart = state.cart.map((item) => ({ ...item, selected }));
    },

    SET_FILTERS(state, filters) {
      state.filters = { ...state.filters, ...filters };
    },

    SET_CURRENT_PAGE(state, page) {
      state.currentPage = page;
    },

    SET_TOTAL_COUNT(state, count) {
      state.totalCount = count;
    },

    SET_HAS_NEXT(state, hasNext) {
      state.hasNext = hasNext;
    },

    SET_HAS_PREV(state, hasPrev) {
      state.hasPrev = hasPrev;
    },

    SET_IS_LOADING(state, isLoading) {
      state.isLoading = isLoading;
    },

    SET_DETAIL_PRODUCT(state, product) {
      state.detailProduct = product;
    },

    SET_IS_MAIN(state, isMain) {
      state.isMain = isMain;
    },

    APPEND_PRODUCTS(state, products) {
      state.products = [...state.products, ...products];
    },

    SET_RELATED_PRODUCTS(state, products) {
      state.relatedProducts = products;
    },

    SET_FILTER_CATEGORIES(state, categories) {
      state.filters.categories = categories;
    },

    SET_IS_SUB_ITEM(state, isSubItem) {
      state.filters.isSubItem = isSubItem;
    },
  },

  actions: {
    async loadProducts({ commit, state }) {
      commit("SET_IS_LOADING", true);
      try {
        const response = await getProducts({
          page: state.currentPage,
          ...state.filters,
        });

        if (state.currentPage === 1) {
          commit("SET_PRODUCTS", response.products);
        } else {
          commit("APPEND_PRODUCTS", response.products);
        }
        commit("SET_TOTAL_COUNT", response.pagination.total);
        commit("SET_HAS_NEXT", response.pagination.hasNext);
        commit("SET_HAS_PREV", response.pagination.hasPrev);
      } catch (error) {
        console.error("상품을 불러오는데 실패했습니다:", error);
      } finally {
        commit("SET_IS_LOADING", false);
      }
    },

    async loadCategories({ commit }) {
      try {
        const categories = await getCategories();
        commit("SET_CATEGORIES", categories);
        commit("SET_FILTER_CATEGORIES", Object.keys(categories));
        commit("SET_IS_SUB_ITEM", false);
      } catch (error) {
        console.error("카테고리를 불러오는데 실패했습니다:", error);
      }
    },

    async loadDetailProduct({ commit }, productId) {
      commit("SET_IS_LOADING", true);
      try {
        const product = await getProduct(productId);
        const relatedProducts = await getProducts({ category2: product.category2 });
        commit("SET_DETAIL_PRODUCT", product);
        commit("SET_RELATED_PRODUCTS", relatedProducts);
      } catch (error) {
        console.error("상품 상세를 불러오는데 실패했습니다:", error);
      } finally {
        commit("SET_IS_LOADING", false);
      }
    },

    async loadProductDetail({ commit }, productId) {
      commit("SET_IS_LOADING", true);
      try {
        const product = await getProduct(productId);
        commit("SET_DETAIL_PRODUCT", product);
      } catch (error) {
        console.error("상품 상세를 불러오는데 실패했습니다:", error);
      } finally {
        commit("SET_IS_LOADING", false);
      }
    },

    initCart({ commit }) {
      const localStorageCart = window.localStorage.getItem("shopping_cart");
      const cart = localStorageCart ? JSON.parse(localStorageCart) : [];
      commit("SET_CART", cart);
    },

    addToCart({ commit, state }, { productId, quantity, product }) {
      // 같은 상품, 같은 수량이 이미 있으면 추가하지 않음
      const existingItem = state.cart.find((item) => item.productId === productId);

      if (existingItem && existingItem.quantity === quantity) {
        return false;
      }

      if (existingItem) {
        // 수량만 업데이트
        commit("UPDATE_CART_ITEM", { productId, quantity });
      } else {
        // 새 아이템 추가 - 전체 상품 정보 저장
        const cartItem = {
          productId: product.productId,
          name: product.title || product.name,
          price: parseInt(product.lprice),
          image: product.image,
          quantity: quantity,
          selected: false,
        };
        commit("ADD_TO_CART", cartItem);
      }

      window.localStorage.setItem("shopping_cart", JSON.stringify(state.cart));
      return true;
    },
  },
});
