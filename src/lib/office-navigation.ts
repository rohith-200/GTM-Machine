/** Keep the destination and its camera transition visible after submitting a long form. */
export function scrollToOffice() {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
}
