export const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(() => resolve(0), milliseconds))
