import '@testing-library/jest-dom/vitest';

/**
 * Polyfills de jsdom necessários para testar componentes Radix UI
 * (`Select`, usado nos filtros de `/tickets` e no formulário de
 * `/tickets/novo`, SPEC-06) via Testing Library — jsdom não implementa
 * `hasPointerCapture`/`scrollIntoView`, usados internamente pelo Radix.
 */
if (!window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
