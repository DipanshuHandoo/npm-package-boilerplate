export function failTimes<T>(failures: number, value: T, message = "boom") {
  let calls = 0;
  const fn = async (): Promise<T> => {
    calls++;
    if (calls <= failures) throw new Error(`${message} #${calls}`);
    return value;
  };
  return { fn, calls: () => calls };
}
