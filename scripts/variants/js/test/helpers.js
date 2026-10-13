/**
 * @template T
 * @param {number} failures
 * @param {T} value
 */
export function failTimes(failures, value, message = "boom") {
  let calls = 0;
  /** @returns {Promise<T>} */
  const fn = async () => {
    calls++;
    if (calls <= failures) throw new Error(`${message} #${calls}`);
    return value;
  };
  return { fn, calls: () => calls };
}
