/**
 * boardDrag — flag bersama antara drag-pan kamera (CameraRig) dan
 * resolver klik papan (Chalkboard). `moved` = true bila pointer
 * menggeser lebih dari ambang sejak pointerdown terakhir → klik
 * berikutnya harus DITEKAN (drag bukan klik). Konsumen wajib
 * me-reset flag setelah memakainya.
 */
export const boardDrag = {
  moved: false,
};
