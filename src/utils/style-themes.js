export function getThemeVariable(variableName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
}
