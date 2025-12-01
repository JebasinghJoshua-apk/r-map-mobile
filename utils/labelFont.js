export const getPlotLabelFontSize = (zoom) => {
  if (zoom >= 19 && zoom < 20) {
    return 11;
  }
  if (zoom >= 18 && zoom < 19) {
    return 9;
  }
  if (zoom >= 17.5 && zoom < 18) {
    return 8;
  }
  if (zoom >= 17.25 && zoom < 17.5) {
    return 7;
  }
  if (zoom >= 17 && zoom < 17.5) {
    return 6;
  }
  return 11;
};

export const getRoadLabelFontSize = (zoom) => {
  if (zoom >= 19 && zoom < 20) {
    return 11;
  }
  if (zoom >= 18 && zoom < 19) {
    return 9;
  }
  if (zoom >= 17.5 && zoom < 18) {
    return 8;
  }
  if (zoom >= 17.25 && zoom < 17.5) {
    return 7;
  }
  if (zoom >= 17 && zoom < 17.5) {
    return 6;
  }
  return 11;
};
