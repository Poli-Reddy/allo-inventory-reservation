import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function tailwindMerge(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export default cn;
