export function getThemeVariable(variableName) {
  return getComputedStyle(document.getElementsByClassName('page-content')[0])
    .getPropertyValue(variableName)
}
