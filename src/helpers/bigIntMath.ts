
export const bigIntMath = {
  // eval required because babel translate ** to Math.pow

  pow: (value: BigInt, pow: number) => BigInt(eval(`BigInt(${value}) ** BigInt(${pow})`)),
};
