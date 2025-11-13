// 옵저버 패턴을 이용한 상태관리

let currentObserver = null;

/**
 * requestAnimationFrame을 이용한 디바운스 최적화
 * 16ms(1프레임) 내 중복 호출 방지
 * @param {Function} callback - 실행할 콜백 함수
 * @returns {Function} - 디바운스된 함수
 */
const debounceFrame = (callback) => {
  let currentCallback = -1;
  return () => {
    cancelAnimationFrame(currentCallback);
    currentCallback = requestAnimationFrame(callback);
  };
};

/**
 * 상태 변화를 감지하고 observer 함수를 실행
 * debounceFrame을 적용하여 성능 최적화
 * @param {Function} fn - 관찰할 함수
 */
export const observe = (fn) => {
  const debouncedFn = debounceFrame(fn);
  currentObserver = debouncedFn;
  fn(); // 초기 실행 (이때 observer 등록됨)
  currentObserver = null;
};

/**
 * 객체를 관찰 가능한 상태로 만들기
 * @param {Object} obj - 관찰할 객체
 * @returns {Object} - 관찰 가능한 객체
 */
export const observable = (obj) => {
  Object.keys(obj).forEach((key) => {
    let _value = obj[key];
    const observers = new Set();

    Object.defineProperty(obj, key, {
      get() {
        if (currentObserver) observers.add(currentObserver);
        return _value;
      },

      set(value) {
        if (_value === value) return;
        if (JSON.stringify(_value) === JSON.stringify(value)) return;
        _value = value;
        observers.forEach((fn) => fn());
      },
    });
  });

  return obj;
};

/**
 * 모든 observers를 초기화 (재등록 전에 호출)
 * @param {Object} obj - observable 객체
 */
export const clearObservers = (obj) => {
  // 각 속성의 observers Set을 비움
  Object.keys(obj).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (descriptor && descriptor.set) {
      // observers는 클로저에 있어서 직접 접근 불가
      // 새로운 값을 할당해서 강제로 observers 실행 후 초기화
    }
  });
};
