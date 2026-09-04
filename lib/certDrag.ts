/**
 * certDrag — flag bersama antara drag-pan dinding sertifikat
 * (CameraRig) dan resolver klik (CertificateWall). Mirror boardDrag:
 * `moved` = true bila pointer menggeser > ambang sejak pointerdown —
 * klik berikutnya DITEKAN (drag bukan klik). Konsumen me-reset lewat
 * pointerdown berikutnya.
 */
export const certDrag = {
  moved: false,
};
